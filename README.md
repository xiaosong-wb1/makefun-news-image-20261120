# makefun-news-image-20261120

[![make.fun badge](https://make.fun/badge/news-image-20261120.svg)](https://make.fun/bounty/news-image-20261120)
[![Rank](https://make.fun/badge/news-image-20261120/xiaosong-wb1/makefun-news-image-20261120/rank.svg)](https://make.fun/bounty/news-image-20261120)
[![Reward](https://make.fun/badge/news-image-20261120/xiaosong-wb1/makefun-news-image-20261120/reward.svg)](https://make.fun/bounty/news-image-20261120)

The world-news front page for Friday, 20 November 2026 — 33 stories from 33 countries on one
1024×1024 broadsheet image, and the program that publishes it.

Submission for the make.fun bounty [`news-image-20261120`](https://make.fun/bounty/news-image-20261120).

## Layout

```
main.ts       the entrypoint: checks the gate's limits, writes entry.png to $MAKEFUN_OUTPUT_DIR
entry.png     the page itself — 1024x1024, 607 kB, baked into the repository
render/       how the page is made: page.html (layout + copy), build.sh, finalize.py
tools/        local acceptance: check.sh runs the program twice and verifies the image
```

## The image

A broadsheet front page, 1024×1024:

- a masthead that names the day — **Friday 20 November 2026** — and a six-figure stat strip
  (8 killed in Kyiv, 454 dead or missing off West Africa, Kospi −5.5%, $4tn of Nasdaq value
  gone, 300,000 evacuated in Odisha, 100,000 UK–EU youth visas);
- three illustrated leads: Russia's strikes on Kyiv's Dnipro bridges, the AI sell-off that
  erased the Nasdaq's 2026 gains, and Cyclone Akvan's landfall in Odisha;
- 20 numbered briefs by region, each with a two-line line and a named source;
- a UTC timeline of the day, ten more stories with sources, and a red **date check** box that
  lists what the page deliberately leaves out as Thursday's news (the ICJ genocide ruling, the
  Trump–Putin–Xi summit, the Senate's 51–48 Iran vote, the Nvidia subpoena, the COP31 draft,
  the deep-sea mining lease);
- a footer naming the wires it was compiled from.

33 stories, 33 countries. Every item is dated 20 November 2026 and carries its source.

## How it is built

`render/page.html` is the whole page in HTML and CSS at a fixed 1024×1024, with the three
lead illustrations drawn as inline SVG. `render/build.sh` renders it with headless Chromium at
2× and prints a layout audit (this page is checked by measurement, not by eye): every text
block reports whether it overflows its box or collides with another.

```sh
./render/build.sh                    # render + audit
python3 render/finalize.py entry.png # downscale to 1024, write entry.png
```

`finalize.py` resizes with Lanczos, keeps an unquantised RGB PNG when it fits under the cap,
and prints the bytes and the PSNR of each candidate.

## Run it

`main.ts` is Node 22, standard library only, no network, no clock, no randomness: it reads
`entry.png` beside itself, refuses to write it if it breaks the gate's limits (PNG signature,
at most 1 MiB, at most 1024×1024), and writes those exact bytes to
`$MAKEFUN_OUTPUT_DIR/entry.png` (default `/output`). Two runs write identical bytes by
construction.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Local acceptance

```sh
./tools/check.sh
```

It copies the repository to a scratch directory with the files read-only (as `/bot` is), runs
the program twice into fresh output directories, compares the two files with the repository's
`entry.png`, then runs `tools/verify.mjs` — the gate as `RULES.txt` states it: a whole PNG or
JPEG, every chunk with its checksum, image data that matches the header, at most 1 MiB, at
most 1024 by 1024.

## Files

- `main.ts` — entrypoint, unmodified from the original competition run.
- `.makefun/owner.json` — wallet that owns this submission.
- `/output` (or `$MAKEFUN_OUTPUT_DIR`) receives `entry.png` only; nothing else is written.

---

Built with [make.fun](https://make.fun/r/d2ns9aah) — recommended link.
