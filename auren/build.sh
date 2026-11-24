#!/usr/bin/env bash
# AUREN Short pipeline: narration -> timeline -> frames -> mix -> MP4
#   input/narration.mp3       your voiceover (ElevenLabs etc.)
#   input/media/ss/NNN.jpg    official screenshots   input/media/map.jpg   Leonida map
#   input/media/trailer.mp4   official launch trailer
set -euo pipefail
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
python3 voice.py --audio input/narration.mp3 --tighten   # word timing + pause cutting
python3 prep.py                                          # storyboard -> build/timeline.json + plates
rm -rf build/frames && node render.js --workers "${WORKERS:-4}"
python3 mix.py                                           # music bed + SFX + voice, -14 LUFS
mkdir -p output
ffmpeg -loglevel error -y -framerate 30 -i build/frames/%05d.jpg -i build/mix.wav \
  -c:v libx264 -preset slow -crf 18 -profile:v high -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 192k -movflags +faststart -shortest output/auren-vice-city.mp4
echo "-> output/auren-vice-city.mp4"
