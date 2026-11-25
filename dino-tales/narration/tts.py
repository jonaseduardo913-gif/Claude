"""Generates the narrator track for "The Lost Egg" with Kokoro TTS and writes
src/narr4.json (line timings + scene boundaries) and narration/lines/*.wav.
Usage: python3 narration/tts.py <kokoro-v1.0.onnx> <voices-v1.0.bin> [voice]
"""
import sys, json, os
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
VOICE = sys.argv[3] if len(sys.argv) > 3 else 'am_michael'
BASE = 0.85
# (scene, lead) then lines: (text, gap_after, speed_mult)
SCRIPT = [
  ('forest', 4.5, [
    ("Deep in a magical forest, where colorful flowers danced in the breeze, and sunlight sparkled through the trees, lived a curious little boy named Tuca.", 1.1, 1),
    ("Tuca loved exploring. Every day, he discovered something new.", 0.9, 1),
    ("But one beautiful morning, he was about to experience an adventure unlike any other.", 2.2, 0.97)]),
  ('sound', 1.0, [
    ("As he walked through the forest, something strange caught his attention.", 1.2, 1),
    ("A soft sound came from behind a bush.", 1.6, 0.94),
    ("Curious, Tuca slowly approached.", 1.0, 0.94),
    ("He moved a few leaves aside... and couldn't believe his eyes.", 1.4, 0.96)]),
  ('egg', 0.8, [
    ("There, resting on the soft grass, was a little dinosaur egg.", 1.1, 0.96),
    ("It was beautiful, with tiny spots, and a warm golden glow.", 0.9, 1),
    ("But something was wrong.", 0.9, 0.92),
    ("The egg was all alone.", 1.4, 0.88),
    ("Tuca looked around, searching for its mother.", 0.5, 1),
    ("He checked behind the trees, looked beneath the bushes, and even listened carefully for any nearby sounds.", 1.3, 1),
    ("But the forest was silent.", 1.6, 0.9),
    ("He gently picked up the egg, and held it close.", 0.6, 0.95),
    ("He knew he couldn't just leave it there.", 0.9, 1),
    ("So, Tuca decided to find out where it belonged.", 1.6, 1)]),
  ('footprints', 1.0, [
    ("He followed a trail of enormous footprints, leading deeper into the forest.", 2.0, 1),
    ("Along the way, he crossed a small wooden bridge,", 3.2, 1),
    ("passed a sparkling waterfall,", 3.4, 1),
    ("and walked through a field filled with colorful flowers.", 3.5, 1)]),
  ('surprise', 0.6, [
    ("Suddenly, he heard a loud rustling sound.", 0.8, 1.04),
    ("Tuca stopped.", 0.9, 0.95),
    ("Something was moving in the bushes!", 1.1, 1.02),
    ("He took a small step backward.", 0.5, 1),
    ("But then... a tiny creature appeared.", 0.9, 0.95),
    ("It was a little dinosaur!", 1.3, 1),
    ("The baby dinosaur looked around with curious eyes.", 0.6, 1),
    ("Then, it noticed the egg in Tuca's arms.", 1.2, 1)]),
  ('hatch', 0.3, [
    ("The little dinosaur quickly approached, gently touching the egg with its nose.", 1.1, 1),
    ("And suddenly...", 0.9, 0.92),
    ("Crack!", 1.1, 1.0),
    ("A tiny piece of the eggshell fell to the ground.", 0.9, 1),
    ("The egg began to shake.", 1.7, 1),
    ("Tuca watched in amazement, as a tiny dinosaur head slowly appeared from inside.", 1.1, 0.95),
    ("It was a baby dinosaur!", 1.2, 1),
    ("The little creature blinked, looked at Tuca, and let out a tiny, happy squeak.", 1.5, 1),
    ("Tuca smiled. He had found the little dinosaur's family!", 1.3, 1),
    ("But there was still one important thing to do.", 0.6, 1),
    ("They needed to find its mother.", 1.8, 0.96)]),
  ('journey', 1.2, [
    ("Following the giant footprints again, Tuca and the baby dinosaur continued their journey.", 1.3, 1),
    ("The path became narrower, and the trees grew taller.", 0.7, 0.97),
    ("The little dinosaur stayed close to Tuca, taking tiny steps along the way.", 2.2, 1)]),
  ('roar', 0.8, [
    ("Then, from far away, they heard a deep and gentle roar.", 2.4, 0.95),
    ("The baby dinosaur immediately lifted its head.", 0.6, 1),
    ("It recognized that sound!", 1.1, 1),
    ("They hurried toward the noise, and finally reached a beautiful clearing.", 1.8, 1)]),
  ('reunion', 1.2, [
    ("And there she was.", 1.3, 0.9),
    ("A giant mother dinosaur stood near a large tree, looking worried, and searching everywhere.", 1.3, 1),
    ("When she saw the little dinosaur, her eyes filled with happiness.", 1.1, 0.97),
    ("The baby dinosaur ran toward her, as fast as its little legs could carry it.", 1.1, 1.03),
    ("The mother lowered her enormous head, and gently nuzzled her baby.", 1.3, 0.95),
    ("They were finally together again.", 2.8, 0.9)]),
  ('goodbye', 0.6, [
    ("Tuca watched the beautiful reunion with a big smile.", 1.1, 1),
    ("The mother dinosaur turned toward him, and gently lowered her head, as if saying thank you.", 1.3, 0.96),
    ("Tuca waved goodbye, as the little dinosaur looked back one last time.", 1.1, 0.97),
    ("And then, together, they disappeared into the magical forest.", 2.8, 0.95)]),
  ('lesson', 1.8, [
    ("That day, Tuca learned something important.", 1.3, 0.95),
    ("Sometimes, the greatest adventures aren't about discovering new places, or finding hidden treasures.", 1.1, 0.96),
    ("They're about helping someone, showing kindness, and making a difference.", 1.6, 0.94),
    ("And as the sun slowly set over the forest, Tuca knew that this was an adventure he would never forget.", 1.7, 0.95),
    ("Because every little act of kindness can lead to something truly magical.", 8.0, 0.9)]),
]

k = Kokoro(sys.argv[1], sys.argv[2])
os.makedirs(os.path.join(HERE, 'lines'), exist_ok=True)
t = 0.0; lines = []; scenes = []; n = 0
for scene, lead, ls in SCRIPT:
    s0 = t; t += lead * 1.4
    for text, gap, sp in ls:
        audio, sr = k.create(text, voice=VOICE, speed=BASE * sp, lang='en-us')
        # trim silence
        a = np.abs(audio); idx = np.where(a > 0.01)[0]
        audio = audio[max(0, idx[0] - int(0.02 * sr)): idx[-1] + int(0.08 * sr)]
        f = f'lines/{n:02d}.wav'; sf.write(os.path.join(HERE, f), audio, sr)
        d = len(audio) / sr
        lines.append({'id': n, 'scene': scene, 'text': text, 't': round(t, 3), 'd': round(d, 3), 'file': 'narration/' + f})
        t += d + gap * 1.3; n += 1
    scenes.append({'name': scene, 't0': round(s0, 3), 't1': round(t, 3)})
json.dump({'voice': VOICE, 'duration': round(t, 3), 'lines': lines, 'scenes': scenes}, open(os.path.join(HERE, '..', 'src', 'narr4.json'), 'w'), indent=1)
for s in scenes: print(f"{s['name']:11s} {s['t0']:7.1f} {s['t1']:7.1f}  ({s['t1']-s['t0']:.1f}s)")
print('total', round(t, 1))
