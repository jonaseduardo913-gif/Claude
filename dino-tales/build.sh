#!/usr/bin/env bash
# Full pipeline for one or more episodes: frames -> soundtrack -> MP4 (1920x1080, 30fps, H.264 + AAC)
#   ./build.sh 1 2 3
set -euo pipefail
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
mkdir -p output
NAMES=([1]="01-o-ovo-perdido" [2]="02-pedrao-e-o-fogo" [3]="03-vovo-zuza-e-o-peixao" [4]="04-the-lost-egg")
for s in "${@:-1 2 3}"; do
  rm -rf "frames/s$s" && node render.js --story "$s" --workers "${WORKERS:-4}"
  python3 audio.py "frames/s$s/cues.json" "frames/s$s/soundtrack.wav"
  FPS=$(python3 -c "import json;print(json.load(open('frames/s$s/cues.json')).get('fps',30))")
  ffmpeg -loglevel error -y -framerate $FPS -i "frames/s$s/%05d.jpg" -i "frames/s$s/soundtrack.wav" \
    -c:v libx264 -preset slow -crf 19 -profile:v high -pix_fmt yuv420p -r $FPS \
    -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest "output/${NAMES[$s]}.mp4"
  echo "-> output/${NAMES[$s]}.mp4"
done
