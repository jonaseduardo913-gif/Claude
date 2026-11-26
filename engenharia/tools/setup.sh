#!/usr/bin/env bash
# Prepare a fresh machine for the production pipeline.
set -euo pipefail
cd "$(dirname "$0")/.."
npm install
pip install -q numpy scipy pillow piper-tts
mkdir -p /opt/tools/voices
for n in faber cadu jeff; do
  f=pt_BR-$n-medium
  [ -f /opt/tools/voices/$f.onnx ] && continue
  curl -sL -o /opt/tools/voices/$f.onnx "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/$n/medium/$f.onnx"
  curl -sL -o /opt/tools/voices/$f.onnx.json "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/$n/medium/$f.onnx.json"
done
command -v ffmpeg >/dev/null || echo "Instale ffmpeg (com libass)."
node -e "require('playwright')" 2>/dev/null || echo "Instale o Playwright com Chromium (npx playwright install chromium)."
echo "pronto"
