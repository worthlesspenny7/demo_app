#!/usr/bin/env bash
# Grab reference frames from the Great Race rally school videos.
# Usage: scripts/grab-frames.sh docs/research/transcripts/urls.txt docs/research/transcripts/screenshots.txt out/
# Env: JS_RUNTIME=deno[:/path/to/deno] (yt-dlp needs a JS runtime for YouTube; node <22 does not work).
# urls.txt: one "key = https://youtube.com/watch?v=..." per line (keys: 2026, 2024, classen1, croker2, clock, start,
#           delay, makeup, reading, prepcharts, xcupcharts, timewise, hacking). Needs yt-dlp and ffmpeg on PATH.
set -euo pipefail
URLS=${1:?urls.txt}; LIST=${2:?screenshots.txt}; OUT=${3:-frames}
mkdir -p "$OUT/video"
# xargs chokes on apostrophes in the free-text columns, so trim with sed
trim() { printf '%s' "$1" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'; }
# bash 3.2 (macOS) has no associative arrays, so look URLs up in the file instead
url_for() { awk -F= -v k="$1" '{key=$1; gsub(/^[ \t]+|[ \t]+$/,"",key); if (key==k) {sub(/^[^=]*=/,""); gsub(/^[ \t]+|[ \t]+$/,""); print; exit}}' "$URLS"; }
while IFS='=' read -r k v; do
  k=$(trim "$k"); [[ -z "$k" || "$k" == \#* ]] && continue
  f="$OUT/video/$k.mp4"
  if [[ ! -f "$f" ]]; then
    # 720p is enough to read a page; -S sorts by resolution cap; keep the file for re-grabs
    yt-dlp --js-runtimes "${JS_RUNTIME:-deno}" -R 50 --fragment-retries 50 --retry-sleep 5 -S "res:720" --merge-output-format mp4 -o "$f" "$(url_for "$k")" </dev/null
  fi
done < "$URLS"
while IFS='|' read -r key ts what why; do
  key=$(trim "$key"); ts=$(trim "$ts"); what=$(trim "$what")
  [[ -z "$key" || "$key" == \#* ]] && continue
  f="$OUT/video/$key.mp4"; [[ -f "$f" ]] || { echo "no video for $key"; continue; }
  slug=$(echo "$what" | tr -cs 'A-Za-z0-9' '-' | cut -c1-48 | sed 's/-$//')
  if [[ "$ts" == "every30" ]]; then
    ffmpeg -nostdin -loglevel error -y -i "$f" -vf fps=1/30 "$OUT/${key}-%03d.png"
    continue
  fi
  mm=${ts%%:*}; ss=${ts##*:}; sec=$((10#$mm * 60 + 10#$ss))
  # three frames: 3 s before, on, and 4 s after the cue, because the timestamps come from speech
  for d in -3 0 4; do
    t=$((sec + d)); [[ $t -lt 0 ]] && t=0
    ffmpeg -nostdin -loglevel error -y -ss "$t" -i "$f" -frames:v 1 "$OUT/${key}-${mm}m${ss}s${d:+$( [[ $d -ge 0 ]] && echo +$d || echo $d )}-${slug}.png"
  done
done < "$LIST"
echo "frames in $OUT"
