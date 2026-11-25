#!/usr/bin/env python3
"""Rank ODDLY concepts and write ranking JSON + Markdown.

Usage: python3 rank_concepts.py <concepts.json> <out_dir> [top_n]
"""
import json
import sys
from pathlib import Path

WEIGHTS = {"originality": 0.40, "visual_appeal": 0.35, "feasibility": 0.25}


def score(c):
    s = c["scores"]
    return round(sum(s[k] * w for k, w in WEIGHTS.items()), 2)


def main():
    src, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
    top_n = int(sys.argv[3]) if len(sys.argv) > 3 else 20
    data = json.loads(src.read_text())
    concepts = data["concepts"]

    ids = [c["id"] for c in concepts]
    titles = [c["title"].lower() for c in concepts]
    assert len(set(ids)) == len(ids), "duplicate concept IDs"
    assert len(set(titles)) == len(titles), "duplicate titles"

    for c in concepts:
        c["weighted_score"] = score(c)
    # Tie-breaks: originality, then visual appeal, then ID order.
    ranked = sorted(
        concepts,
        key=lambda c: (-c["weighted_score"], -c["scores"]["originality"],
                       -c["scores"]["visual_appeal"], c["id"]),
    )

    top = [
        {
            "rank": i + 1,
            "id": c["id"],
            "title": c["title"],
            "format": c["format"],
            "category": c["category"],
            "scores": c["scores"],
            "weighted_score": c["weighted_score"],
            "status": "greenlight_candidate",
        }
        for i, c in enumerate(ranked[:top_n])
    ]
    (out_dir / "RANKING_TOP20.json").write_text(
        json.dumps({"weights": WEIGHTS, "top": top}, indent=2) + "\n")

    lines = [
        "# ODDLY — Concept Ranking (Batch 001)",
        "",
        f"Weighted score = originality x{WEIGHTS['originality']} + "
        f"visual appeal x{WEIGHTS['visual_appeal']} + feasibility x{WEIGHTS['feasibility']}.",
        "",
        "| # | ID | Title | Format | Category | Orig | Visual | Feas | Score |",
        "|---|----|-------|--------|----------|------|--------|------|-------|",
    ]
    for t in top:
        s = t["scores"]
        lines.append(
            f"| {t['rank']} | {t['id']} | {t['title']} | {t['format']} | {t['category']} | "
            f"{s['originality']} | {s['visual_appeal']} | {s['feasibility']} | {t['weighted_score']:.2f} |")
    lines += ["", "## Full list (all 50, ranked)", "",
              "| # | ID | Title | Format | Score |", "|---|----|-------|--------|-------|"]
    for i, c in enumerate(ranked):
        lines.append(f"| {i + 1} | {c['id']} | {c['title']} | {c['format']} | {c['weighted_score']:.2f} |")
    (out_dir / "RANKING_TOP20.md").write_text("\n".join(lines) + "\n")

    for t in top:
        print(f"{t['rank']:>2}. {t['id']} {t['title']:<34} {t['format']:<5} {t['weighted_score']:.2f}")


if __name__ == "__main__":
    main()
