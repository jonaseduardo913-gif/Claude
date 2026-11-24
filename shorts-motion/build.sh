#!/usr/bin/env bash
# Full pipeline: soundtrack -> frames -> MP4 (1080x1920, 30fps, H.264 + AAC)
set -euo pipefail
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
python3 audio.py soundtrack.wav
rm -rf frames && node render.js --workers "${WORKERS:-4}"
mkdir -p output
ffmpeg -loglevel error -y -framerate 30 -i frames/%05d.jpg -i soundtrack.wav \
  -c:v libx264 -preset slow -crf 20 -profile:v high -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest output/pulso-short.mp4
echo "-> output/pulso-short.mp4"
