#!/usr/bin/env python3
"""Create workspace directory structure and eval metadata for all 97 evals."""

import json
import os
import re

EVALS_PATH = (
    "/home/sami/Code/macrofactor/.opencode/skills/sbs-strength-training/evals.json"
)
WORKSPACE = (
    "/home/sami/Code/macrofactor/docs/sbs-evals/sbs-strength-training/iteration-1"
)


def slugify(text, max_len=50):
    """Convert topic text to directory-safe slug."""
    slug = text.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug[:max_len].rstrip("-")


def extract_assertions(expected_output, topic):
    """Extract 3-5 meaningful assertions from expected_output."""
    assertions = []

    # Assertion 1: Core position/recommendation
    assertions.append(f"Answer captures the core SBS position on {topic}")

    # Assertion 2: Key specific details
    assertions.append(
        f"Answer includes key specific details, numbers, or mechanisms mentioned by the hosts"
    )

    # Assertion 3: Nuance and caveats
    assertions.append(
        f"Answer acknowledges important caveats or limitations discussed by the hosts"
    )

    # Assertion 4: Practical recommendation
    if any(
        word in expected_output.lower()
        for word in ["recommend", "practical", "advice", "suggest", "guidance"]
    ):
        assertions.append(
            f"Answer includes actionable practical recommendations consistent with the hosts' advice"
        )

    # Assertion 5: No contradiction
    assertions.append(f"Answer does not contradict the hosts' stated position")

    return assertions


def main():
    with open(EVALS_PATH) as f:
        data = json.load(f)

    evals = data["evals"]
    print(f"Processing {len(evals)} evals...")

    for ev in evals:
        eval_id = ev["id"]
        topic = ev["topic"]
        slug = slugify(topic)
        dirname = f"eval-{eval_id}-{slug}"
        eval_dir = os.path.join(WORKSPACE, dirname)

        # Create directory structure
        for sub in ["with_skill/outputs", "without_skill/outputs"]:
            os.makedirs(os.path.join(eval_dir, sub), exist_ok=True)

        # Generate assertions
        assertions = extract_assertions(ev["expected_output"], topic)

        # Write eval_metadata.json
        metadata = {
            "eval_id": eval_id,
            "eval_name": dirname,
            "prompt": ev["prompt"],
            "expected_output": ev["expected_output"],
            "topic": topic,
            "episode": ev.get("episode"),
            "assertions": assertions,
        }

        meta_path = os.path.join(eval_dir, "eval_metadata.json")
        with open(meta_path, "w") as f:
            json.dump(metadata, f, indent=2)

    print(f"Created {len(evals)} eval directories in {WORKSPACE}")

    # Also write a batch manifest for easy task spawning
    batches = []
    batch_size = 15
    for i in range(0, len(evals), batch_size):
        batch = evals[i : i + batch_size]
        batches.append(
            {
                "batch_index": len(batches),
                "eval_ids": [e["id"] for e in batch],
                "evals": [
                    {
                        "id": e["id"],
                        "prompt": e["prompt"],
                        "expected_output": e["expected_output"],
                        "topic": e["topic"],
                        "dirname": f"eval-{e['id']}-{slugify(e['topic'])}",
                    }
                    for e in batch
                ],
            }
        )

    manifest_path = os.path.join(WORKSPACE, "batch_manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(
            {"total_evals": len(evals), "batch_size": batch_size, "batches": batches},
            f,
            indent=2,
        )

    print(f"Created {len(batches)} batch manifests")


if __name__ == "__main__":
    main()
