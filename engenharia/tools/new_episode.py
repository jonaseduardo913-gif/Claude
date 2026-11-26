#!/usr/bin/env python3
"""Scaffold a new episode folder from the template.

  python3 tools/new_episode.py <slug> "<tema>"

Creates episodes/<slug>/episode.json (structure to fill in) and episodes/<slug>/scene.js
(skeleton using the shared kit). The content itself (research, script, 3D models,
animations) is written per topic - see .claude/skills/novo-episodio/SKILL.md.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    slug, tema = sys.argv[1], sys.argv[2]
    if not re.fullmatch(r"[a-z0-9\-]+", slug):
        sys.exit("slug must be lowercase letters, digits and hyphens")
    d = ROOT / "episodes" / slug
    if d.exists():
        sys.exit(f"{d} already exists")
    d.mkdir(parents=True)
    beats = [("S01", "GANCHO: imagem mais surpreendente do tema nos primeiros 2s", "zoomin", 1),
             ("S02", "Apresenta o objeto inteiro e o problema que ele resolve", "smoothup", 1),
             ("S03", "Corte transversal: revela as peças internas com etiquetas", "fade", 2),
             ("S04", "Mecanismo, passo 1", "fade", 2),
             ("S05", "Mecanismo, passo 2", "fade", 2),
             ("S06", "Mecanismo, passo 3 (cena principal)", "fade", 3),
             ("S07", "Consequência / resultado do mecanismo", "zoomin", 3),
             ("S08", "Contraste: o que acontece quando falha ou sem ele", "fadeblack", 2),
             ("S09", "Número / escala impressionante", "smoothup", 2),
             ("S10", "Contexto histórico ou curiosidade verificada", "fade", 1),
             ("S11", "Conclusão + plano heroico final", "none", 1)]
    ep = {
        "id": slug, "title": tema, "language": "pt-BR",
        "format": {"width": 1080, "height": 1920, "fps": 30},
        "voice": {"model": "pt_BR-faber-medium", "length_scale": 0.96},
        "music": {"bpm": 96, "key": "D", "mood": "tensão documental, pulsante, clara"},
        "research": {"summary": "TODO", "facts_checked": [], "sources": []},
        "scenes": [{"id": i, "narration": "TODO", "min_seconds": 3.5, "storyboard": b, "camera": "TODO",
                    "transition": tr, "music": m, "sfx": [{"u": 0.0, "type": "whoosh_in"}] if i == "S01" else []}
                   for i, b, tr, m in beats],
    }
    (d / "episode.json").write_text(json.dumps(ep, indent=2, ensure_ascii=False) + "\n")
    fns = "\n".join(f"    {i}(t, d) {{\n      // {b}\n      set(path([[0, orbit([0, 0.5, 0], 10, -20, 12)], [d, orbit([0, 0.5, 0], 9, 10, 10)]], t));\n    }},"
                    for i, b, _, _ in beats)
    (d / "scene.js").write_text(f"""// Episode: {tema}
// Build the 3D models once in build(); every scene function sets the full state for time t (seconds) of a scene of length d.
// Scenes must be deterministic: same (t, d) -> same frame. Never keep animation state between frames.
export async function build(ctx) {{
  const {{ THREE, kit, scene, camera, cut }} = ctx;
  const {{ mat, parts, brush, csg, capMaterial, Label, seg, smooth, easeOut, lerp, clamp, path, orbit, applyPose, springGeometry, rand }} = kit;
  const set = p => applyPose(camera, p);
  ctx.studio.floor.position.y = -1.2;

  // ---- models (replace with the real object; use csg() for holes/cavities and cut.add(mesh, capMaterial(color)) for section views)
  const placeholder = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat.steel());
  placeholder.castShadow = true; scene.add(placeholder);
  cut.add(placeholder, capMaterial(0x6f7884));

  function reset() {{
    cut.offset = 100;          // 100 = no section; 0 = cut through z=0
    ctx.grade.uniforms.fade.value = 0;
  }}

  const scenes = {{
{fns}
  }};
  return {{ reset, scenes }};
}}
""")
    print(f"created {d}/episode.json and scene.js")
    print("next: research -> fill episode.json -> model + animate scene.js -> preview stills -> produce.py")


if __name__ == "__main__":
    main()
