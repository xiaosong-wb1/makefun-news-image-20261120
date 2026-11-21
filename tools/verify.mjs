// The gate as RULES.txt describes it, run locally: a whole PNG or JPEG, at most 1 MiB and
// at most 1024 by 1024 pixels, every PNG chunk with its checksum and the image data its
// header describes, or every JPEG segment through to its end marker.
//
//   node tools/verify.mjs out/entry.png

import { readFileSync } from 'node:fs';

const MAX_BYTES = 1048576;
const MAX_SIDE = 1024;

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

const problems = [];
const notes = [];
const fail = (m) => problems.push(m);

const file = process.argv[2] ?? 'entry.png';
const bytes = readFileSync(file);

notes.push(`file: ${file}, ${bytes.length} bytes`);
if (bytes.length > MAX_BYTES) fail(`${bytes.length} bytes: over the 1 MiB cap`);

const isPng = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;

let width = 0;
let height = 0;

if (isPng) {
  notes.push('format: PNG');
  let at = 8;
  let ihdr = null;
  let ended = false;
  const idat = [];
  let chunks = 0;
  while (at < bytes.length) {
    if (at + 12 > bytes.length) { fail(`truncated chunk header at byte ${at}`); break; }
    const len = bytes.readUInt32BE(at);
    const type = bytes.toString('latin1', at + 4, at + 8);
    const dataStart = at + 8;
    const dataEnd = dataStart + len;
    if (dataEnd + 4 > bytes.length) { fail(`chunk ${type} runs past the end of the file`); break; }
    const data = bytes.subarray(dataStart, dataEnd);
    const want = bytes.readUInt32BE(dataEnd);
    const got = crc32(bytes.subarray(at + 4, dataEnd));
    if (want !== got) fail(`chunk ${type} at byte ${at}: crc ${got.toString(16)} but the file says ${want.toString(16)}`);
    chunks++;
    if (chunks === 1) {
      if (type !== 'IHDR' || len !== 13) fail(`first chunk is ${type}/${len}, not IHDR/13`);
      else {
        ihdr = data;
        width = data.readUInt32BE(0);
        height = data.readUInt32BE(4);
        const [depth, color, comp, filt, inter] = [data[8], data[9], data[10], data[11], data[12]];
        if (comp !== 0 || filt !== 0) fail('IHDR: unknown compression or filter method');
        if (inter !== 0) fail('IHDR: interlaced PNG');
        const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color];
        if (channels === undefined) fail(`IHDR: unknown colour type ${color}`);
        notes.push(`ihdr: ${width}x${height}, ${depth}-bit, colour type ${color}`);
        ihdr.__packed = Math.ceil((width * channels * depth) / 8);
      }
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') { ended = true; at = dataEnd + 4; break; }
    at = dataEnd + 4;
  }
  if (!ihdr) fail('no IHDR');
  if (!idat.length) fail('no IDAT');
  if (!ended) fail('no IEND: the file is not a whole PNG');
  else if (at !== bytes.length) fail(`${bytes.length - at} bytes follow IEND`);
  if (ihdr && idat.length) {
    // The image data must be exactly what the header describes, and inflate cleanly.
    const { inflateSync } = await import('node:zlib');
    try {
      const raw = inflateSync(Buffer.concat(idat));
      const want = height * (1 + ihdr.__packed);
      if (raw.length !== want) fail(`IDAT inflates to ${raw.length} bytes; IHDR describes ${want}`);
      else notes.push(`idat: ${raw.length} bytes of scanlines, as the header describes`);
      for (let y = 0; y < height; y++) {
        const f = raw[y * (1 + ihdr.__packed)];
        if (f > 4) { fail(`scanline ${y} has filter type ${f}`); break; }
      }
    } catch (err) {
      fail(`IDAT does not inflate: ${err.message}`);
    }
  }
} else if (isJpeg) {
  notes.push('format: JPEG');
  let at = 2;
  let sawFrame = false;
  let sawScan = false;
  while (at < bytes.length) {
    if (bytes[at] !== 0xff) { fail(`expected a marker at byte ${at}`); break; }
    const marker = bytes[at + 1];
    const len = bytes.readUInt16BE(at + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      height = bytes.readUInt16BE(at + 5);
      width = bytes.readUInt16BE(at + 7);
      sawFrame = true;
      notes.push(`sof: ${width}x${height}`);
    }
    if (marker === 0xda) { sawScan = true; break; }
    at += 2 + len;
  }
  if (!sawFrame) fail('no SOF segment: no frame header');
  if (!sawScan) fail('no SOS segment: no scan');
  const eoi = bytes.lastIndexOf(Buffer.from([0xff, 0xd9]));
  if (eoi < 0) fail('no EOI marker');
  else if (eoi + 2 !== bytes.length) fail(`${bytes.length - eoi - 2} bytes follow EOI`);
} else {
  fail('neither a PNG nor a JPEG: the first bytes tell them apart');
}

if (width > MAX_SIDE || height > MAX_SIDE) fail(`${width}x${height}: over the 1024 by 1024 cap`);
if (width === 0 || height === 0) fail('no dimensions in the header');

for (const note of notes) console.log('  ' + note);
if (problems.length) {
  for (const p of problems) console.log('  FAIL ' + p);
  console.log('valid: 0');
  process.exit(1);
}
console.log(`valid: 1 (${width}x${height}, ${bytes.length} bytes)`);
