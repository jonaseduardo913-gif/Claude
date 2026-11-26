#!/usr/bin/env python3
"""Word-level alignment of a provided narration file (ElevenLabs, human voice-over...).

  python3 tools/align.py <episode_id> [--model small.en]

Reads episodes/<id>/<narration_audio.file> and writes episodes/<id>/alignment.json
([{w, start, end}, ...]) using faster-whisper. Prints the transcript so it can be checked
against the script. Scenes are then placed with each scene's "starts_with" phrase.
"""
import argparse
import json
import subprocess
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--model", default=None, help="faster-whisper model (default: small.en for English, small otherwise)")
    a = ap.parse_args()
    d = ROOT / "episodes" / a.episode
    ep = json.loads((d / "episode.json").read_text())
    na = ep["narration_audio"]
    lang = ep.get("language", "en-US")[:2]
    model = a.model or ("small.en" if lang == "en" else "small")
    from faster_whisper import WhisperModel
    m = WhisperModel(model, device="cpu", compute_type="int8")
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(d / na["file"]), "-f", "f32le", "-ac", "1", "-ar", "16000", "-"],
                         capture_output=True, check=True).stdout
    audio = np.frombuffer(raw, np.float32)
    segs, _ = m.transcribe(audio, word_timestamps=True, beam_size=5, language=None if model.endswith(".en") else lang)
    words = [{"w": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3)} for s in segs for w in s.words]
    (d / na.get("alignment", "alignment.json")).write_text(json.dumps(words, indent=0))
    print(f"{len(words)} words, {words[-1]['end']:.2f}s")
    print(" ".join(w["w"] for w in words))


if __name__ == "__main__":
    main()
