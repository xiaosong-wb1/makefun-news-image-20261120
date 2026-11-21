#!/usr/bin/env bash
# Local acceptance for the news-image entry, as far as it can be run without the house grader.
#
#   tools/check.sh
#
# 1. copies this repository to a scratch directory that the program cannot write to,
#    the way the grader mounts /bot read-only;
# 2. runs the program twice, each into its own fresh output directory, and compares the
#    two files byte for byte against each other and against the entry.png in the repo;
# 3. runs tools/verify.mjs over the output: PNG/JPEG whole file, chunk CRCs, image data that
#    matches its header, at most 1 MiB, at most 1024 by 1024 pixels.
set -uo pipefail
cd "$(dirname "$0")/.."
REPO=$PWD
SCRATCH=$(mktemp -d)
trap 'chmod -R u+w "$SCRATCH" 2>/dev/null; rm -rf "$SCRATCH"' EXIT

echo "== copy the repository to $SCRATCH/bot (read-only, as /bot is) =="
mkdir -p "$SCRATCH/bot"
cp -a main.ts entry.png LICENSE "$SCRATCH/bot"/
chmod -R a-w "$SCRATCH/bot"
ls -l "$SCRATCH/bot" | sed -n '2,9p'

fail=0
for run in 1 2; do
  out="$SCRATCH/out$run"
  mkdir -p "$out"
  echo "== run $run =="
  ( cd "$SCRATCH/bot" && MAKEFUN_OUTPUT_DIR="$out" node main.ts ) || { echo "  FAIL the program exited non-zero"; fail=1; }
done

echo "== the two runs, and the file in the repository =="
a=$(sha256sum "$SCRATCH/out1/entry.png" 2>/dev/null | cut -d' ' -f1)
b=$(sha256sum "$SCRATCH/out2/entry.png" 2>/dev/null | cut -d' ' -f1)
c=$(sha256sum "$REPO/entry.png" | cut -d' ' -f1)
echo "  run 1: ${a:-missing}"
echo "  run 2: ${b:-missing}"
echo "  repo : $c"
if [ -z "$a" ] || [ "$a" != "$b" ]; then echo "  FAIL the two runs differ"; fail=1; else echo "  identical: yes"; fi
if [ "$a" != "$c" ]; then echo "  FAIL the output is not the entry.png the repository holds"; fail=1; fi

echo "== the gate, as RULES.txt describes it =="
node tools/verify.mjs "$SCRATCH/out1/entry.png" || fail=1

echo
if [ "$fail" -eq 0 ]; then echo "PASS: byte-identical across two runs, and a valid image within the limits"; else echo "FAIL"; fi
exit "$fail"
