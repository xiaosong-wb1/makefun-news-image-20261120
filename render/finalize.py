#!/usr/bin/env python3
"""Downscale the 2x render to 1024x1024, pick the smallest palette PNG that keeps
the render faithful, and write entry.png. Prints the numbers the gate cares about."""
import sys
from PIL import Image, ImageChops, ImageStat

SRC = 'render/out/page@2x.png'
OUT = sys.argv[1] if len(sys.argv) > 1 else 'entry.png'
LIMIT = 1048576

im = Image.open(SRC).convert('RGB')
if im.size != (2048, 2048):
    raise SystemExit(f'unexpected render size {im.size}')
small = im.resize((1024, 1024), Image.LANCZOS)


def psnr(a, b):
    diff = ImageChops.difference(a, b)
    h = ImageStat.Stat(diff).rms
    mse = sum(v * v for v in h) / 3
    if mse == 0:
        return 99.0
    import math
    return 10 * math.log10(255 * 255 / mse)


cands = []
for colors in (64, 96, 128, 192, 256):
    q = small.quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE)
    path = f'render/out/p{colors}.png'
    q.save(path, optimize=True)
    cands.append((path, colors, len(open(path, 'rb').read()), psnr(small, q.convert('RGB'))))
path = 'render/out/rgb.png'
small.save(path, optimize=True)
cands.append((path, 0, len(open(path, 'rb').read()), 99.0))

for c in cands:
    print(f'  {c[0]:24s} colors={c[1]:3d} bytes={c[2]:7d} psnr={c[3]:5.2f}dB')

best = None
for c in cands:  # RGB first: no quantisation artefacts at all when it fits comfortably
    if c[1] == 0 and c[2] <= LIMIT * 0.85:
        best = c
        break
for c in cands:
    if best is None and c[2] <= LIMIT * 0.97 and c[3] >= 44:
        best = c
        break
if best is None:
    best = min(cands, key=lambda c: c[2] if c[2] <= LIMIT else 10 ** 9)
open(OUT, 'wb').write(open(best[0], 'rb').read())
print(f'wrote {OUT} from {best[0]} ({best[2]} bytes, psnr {best[3]:.2f} dB)')

# structure sanity: mean luminance per 16 bands, so a blank or broken render shows up
g = small.convert('L').resize((64, 64), Image.BOX)
px = list(g.getdata())
for band in range(8):
    rows = px[band * 512:(band + 1) * 512]
    print(f'  band {band}: mean {sum(rows)/len(rows):6.1f} min {min(rows):3d} max {max(rows):3d}')
