#!/usr/bin/env python3
"""Detect corrupted frames (rectangular pure-black tiles from the software rasterizer).

  python3 tools/check_frames.py <episode_id> [--step 2]

Scans every clip in output/<id>/clips/ and prints scenes with corrupted frames.
A frame is flagged when it contains >= 3 fully black 16x16 blocks that are not part of an
intentional fade (fades darken the whole frame, tiles are sharp-edged islands).
Exit code 1 if anything is flagged (re-render those scenes with --workers 1).
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
W, H = 270, 480


def frames(path, step):
    cmd = ["ffmpeg", "-v", "error", "-i", str(path), "-vf", f"select=not(mod(n\\,{step})),scale={W}:{H}", "-vsync", "0",
           "-f", "rawvideo", "-pix_fmt", "gray", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W)


def bad_blocks(f):
    """count sharp-edged pure-black 16x16 islands away from the frame border (vignette)"""
    if f.mean() < 25:                                   # intentional fade to black
        return 0
    bh, bw = H // 16, W // 16
    b = f[: bh * 16, : bw * 16].reshape(bh, 16, bw, 16)
    mx, mean = b.max(axis=(1, 3)), b.mean(axis=(1, 3))
    black = mx <= 3
    n = 0
    for y in range(2, bh - 2):
        for x in range(2, bw - 2):
            if not black[y, x]:
                continue
            neigh = [mean[y + dy, x + dx] for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1))]
            if max(neigh) > 70:                          # bright pixels right next to pure black = tile edge
                n += 1
    return n


def main():
    ep = sys.argv[1]
    step = int(sys.argv[sys.argv.index("--step") + 1]) if "--step" in sys.argv else 2
    clips = sorted((ROOT / "output" / ep / "clips").glob("*.mp4"))
    bad = {}
    for c in clips:
        fr = frames(c, step)
        hits = [i * step for i, f in enumerate(fr) if bad_blocks(f) >= 3]
        if hits:
            bad[c.stem] = hits
        print(f"{c.stem}: {len(fr)} frames checked, {len(hits)} corrupted" + (f" (e.g. frame {hits[:5]})" if hits else ""))
    print(json.dumps({"corrupted_scenes": sorted(bad)}))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
