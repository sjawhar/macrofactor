#!/usr/bin/env python3
"""Generate batch prompt files for spawning eval tasks."""

import json
import re

EVALS_PATH = (
    "/home/sami/Code/macrofactor/.opencode/skills/sbs-strength-training/evals.json"
)
WORKSPACE = (
    "/home/sami/Code/macrofactor/docs/sbs-evals/sbs-strength-training/iteration-1"
)
SKILL_PATH = "/home/sami/Code/macrofactor/.opencode/skills/sbs-strength-training"
BATCH_SIZE = 15


def slugify(text, max_len=50):
    slug = text.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug[:max_len].rstrip("-")


def main():
    with open(EVALS_PATH) as f:
        data = json.load(f)

    evals = data["evals"]

    # Create batches
    batches = []
    for i in range(0, len(evals), BATCH_SIZE):
        batches.append(evals[i : i + BATCH_SIZE])

    for batch_idx, batch in enumerate(batches):
        # Build question list
        questions = []
        for ev in batch:
            dirname = f"eval-{ev['id']}-{slugify(ev['topic'])}"
            questions.append(
                {
                    "id": ev["id"],
                    "prompt": ev["prompt"],
                    "dirname": dirname,
                    "topic": ev["topic"],
                }
            )

        # WITH SKILL prompt
        q_lines_with = []
        for q in questions:
            path = f"{WORKSPACE}/{q['dirname']}/with_skill/outputs/answer.md"
            q_lines_with.append(
                f'{q["id"]}. Question: "{q["prompt"]}"\n   Topic: {q["topic"]}\n   Save answer to: {path}'
            )

        with_prompt = f"""TASK: Answer {len(batch)} listener questions about strength training and fitness, using the SBS strength training skill for guidance.

EXPECTED OUTCOME: {len(batch)} individual answer.md files, each 200-500 words, evidence-based and practical, drawing on the skill content.

REQUIRED TOOLS: Read, Write

MUST DO:
1. FIRST: Read the SKILL.md at {SKILL_PATH}/SKILL.md — read it completely
2. THEN: Read ALL 5 reference files in {SKILL_PATH}/references/ — read each one completely:
   - {SKILL_PATH}/references/01-progressive-overload-and-phase-progression.md
   - {SKILL_PATH}/references/02-volume-landmarks-and-weekly-set-targets.md
   - {SKILL_PATH}/references/03-frequency-splits-and-weekly-structure.md
   - {SKILL_PATH}/references/04-intensity-reps-and-exercise-selection.md
   - {SKILL_PATH}/references/05-fatigue-deloads-and-level-specific-decisions.md
3. For each question below, write a thorough answer (200-500 words) to the specified file path
4. When a question is directly relevant to the skill content, draw on specific recommendations, numbers, and frameworks from the skill
5. When a question is outside the skill's scope (e.g., supplements, lifestyle), still answer using general evidence-based knowledge
6. Be nuanced — include caveats, individual variability, and practical recommendations
7. Write answers as plain markdown without frontmatter

MUST NOT DO:
- Do NOT answer from memory/training data alone for topics the skill covers — USE the skill content
- Do NOT give generic/vague answers — be specific with numbers and mechanisms
- Do NOT skip any questions
- Do NOT write to any paths other than those specified

CONTEXT: These are real listener questions from the Stronger By Science podcast. The SBS skill encodes evidence-based strength training knowledge from Greg Nuckols' guides. Your answers should reflect the SBS approach: evidence-based, nuanced, practical, with appropriate caveats.

QUESTIONS:
{chr(10).join(q_lines_with)}"""

        # WITHOUT SKILL prompt
        q_lines_without = []
        for q in questions:
            path = f"{WORKSPACE}/{q['dirname']}/without_skill/outputs/answer.md"
            q_lines_without.append(
                f'{q["id"]}. Question: "{q["prompt"]}"\n   Topic: {q["topic"]}\n   Save answer to: {path}'
            )

        without_prompt = f"""TASK: Answer {len(batch)} listener questions about strength training and fitness using ONLY your general knowledge. Do NOT read any special skill files.

EXPECTED OUTCOME: {len(batch)} individual answer.md files, each 200-500 words, evidence-based and practical.

REQUIRED TOOLS: Write

MUST DO:
1. For each question below, write a thorough answer (200-500 words) to the specified file path
2. Use your general training and fitness knowledge — answer as an informed fitness enthusiast/coach would
3. Be evidence-based, nuanced, and practical
4. Include specific numbers, mechanisms, and caveats where appropriate
5. Write answers as plain markdown without frontmatter

MUST NOT DO:
- Do NOT read any skill files, training guides, or reference documents
- Do NOT use the Read tool to read anything in .opencode/skills/
- Do NOT give generic/vague answers — be specific
- Do NOT skip any questions
- Do NOT write to any paths other than those specified

CONTEXT: These are real listener questions about fitness and training. Answer from your general knowledge of exercise science.

QUESTIONS:
{chr(10).join(q_lines_without)}"""

        # Save prompts
        with open(f"{WORKSPACE}/batch_{batch_idx}_with_skill_prompt.txt", "w") as f:
            f.write(with_prompt)
        with open(f"{WORKSPACE}/batch_{batch_idx}_without_skill_prompt.txt", "w") as f:
            f.write(without_prompt)

    print(
        f"Generated {len(batches)} batch prompt pairs ({len(batches) * 2} total prompt files)"
    )
    print(f"Batch sizes: {[len(b) for b in batches]}")


if __name__ == "__main__":
    main()
