#!/usr/bin/env python3
"""
Aggregate Q&A pairs from all episode JSON files into per-skill evals.json
for the skill-creator evaluation framework.
"""

import json
from pathlib import Path

TRANSCRIPTS_DIR = Path("/home/sami/Code/macrofactor/docs/sbs-transcripts")
SKILLS_DIR = Path("/home/sami/Code/macrofactor/.opencode/skills")

SKILLS = [
    "sbs-diet",
    "sbs-strength-training",
    "sbs-squat",
    "sbs-bench",
    "sbs-deadlift",
]


def build_evals():
    # Load all episode Q&A files
    all_pairs = []
    for qa_file in sorted(TRANSCRIPTS_DIR.glob("ep*-qa.json")):
        data = json.loads(qa_file.read_text())
        ep = data["episode"]
        for pair in data["pairs"]:
            pair["_episode"] = ep
            all_pairs.append(pair)

    print(f"Total pairs loaded: {len(all_pairs)}")

    # Count by skill
    skill_counts = {s: 0 for s in SKILLS}
    for pair in all_pairs:
        for skill in pair.get("skills", []):
            if skill in skill_counts:
                skill_counts[skill] += 1

    print("Pairs per skill:")
    for skill, count in skill_counts.items():
        print(f"  {skill}: {count}")

    # Build evals.json per skill
    for skill in SKILLS:
        skill_pairs = [p for p in all_pairs if skill in p.get("skills", [])]

        evals = []
        for i, pair in enumerate(skill_pairs, 1):
            evals.append(
                {
                    "id": i,
                    "prompt": pair["question"],
                    "expected_output": pair["answer_summary"],
                    "topic": pair.get("topic", ""),
                    "episode": pair["_episode"],
                    "files": [],
                }
            )

        evals_json = {"skill_name": skill, "evals": evals}

        skill_dir = SKILLS_DIR / skill
        out_path = skill_dir / "evals.json"
        skill_dir.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(evals_json, indent=2, ensure_ascii=False))
        print(f"\nWrote {len(evals)} evals → {out_path}")

    # Also write a combined all-skills eval for general review
    combined = {"skill_name": "sbs-all", "evals": []}
    seen = set()
    eval_id = 1
    for pair in all_pairs:
        key = pair["question"][:80]
        if key not in seen:
            seen.add(key)
            combined["evals"].append(
                {
                    "id": eval_id,
                    "prompt": pair["question"],
                    "expected_output": pair["answer_summary"],
                    "topic": pair.get("topic", ""),
                    "skills": pair.get("skills", []),
                    "episode": pair["_episode"],
                    "files": [],
                }
            )
            eval_id += 1

    combined_path = TRANSCRIPTS_DIR / "evals-combined.json"
    combined_path.write_text(json.dumps(combined, indent=2, ensure_ascii=False))
    print(f"\nWrote {len(combined['evals'])} combined evals → {combined_path}")


if __name__ == "__main__":
    build_evals()
