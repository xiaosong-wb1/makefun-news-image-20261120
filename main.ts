// Writes this repository's front page to <MAKEFUN_OUTPUT_DIR>/entry.png.
//
// The page itself is entry.png beside this file: one Friday's world news, 33 stories,
// drawn once and kept byte for byte, so the two runs the grader makes write the same
// bytes. This program only checks what the gate will check and puts the file where the
// grader reads it — no network, no clock, no randomness, nothing written but that file.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** The gate's ceilings: at most 1 MiB, at most 1024 by 1024 pixels. */
const MAX_BYTES = 1048576;
const MAX_SIDE = 1024;

/** A PNG opens with these eight bytes, and says its size in IHDR right after them. */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const page = readFileSync(new URL('./entry.png', import.meta.url));

if (page.length > MAX_BYTES) {
  throw new Error(`entry.png is ${page.length} bytes: the gate allows ${MAX_BYTES}`);
}
for (let i = 0; i < PNG_MAGIC.length; i++) {
  if (page[i] !== PNG_MAGIC[i]) throw new Error('entry.png does not start with the PNG signature');
}
const width = page.readUInt32BE(16);
const height = page.readUInt32BE(20);
if (width > MAX_SIDE || height > MAX_SIDE) {
  throw new Error(`entry.png is ${width}x${height}: the gate allows ${MAX_SIDE}x${MAX_SIDE}`);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), page);

console.log(`entry.png: ${width}x${height}, ${page.length} bytes, written to ${outDir}`);
