#!/usr/bin/env python3
"""Grade all SBS strength training evals by comparing answers against expected outputs."""

import json
import os
import re
from pathlib import Path

WORKSPACE = Path(__file__).parent
EVALS_JSON = Path(
    "/home/sami/Code/macrofactor/.opencode/skills/sbs-strength-training/evals.json"
)


def load_evals():
    with open(EVALS_JSON) as f:
        return json.load(f)["evals"]


def read_answer(eval_dir: Path, config: str) -> str:
    answer_path = eval_dir / config / "outputs" / "answer.md"
    if answer_path.exists():
        return answer_path.read_text()
    return ""


def read_metadata(eval_dir: Path) -> dict:
    meta_path = eval_dir / "eval_metadata.json"
    if meta_path.exists():
        with open(meta_path) as f:
            return json.load(f)
    return {}


def extract_key_concepts(expected_output: str) -> list[str]:
    """Extract key concepts/phrases from expected output for matching."""
    concepts = []
    # Extract numbers and specific values
    numbers = re.findall(
        r"\d+[\.\d]*\s*(?:%|kg|lb|g|mg|ml|hours?|weeks?|days?|months?|years?|reps?|sets?|sessions?|minutes?|RIR|RPE|RM)",
        expected_output,
        re.IGNORECASE,
    )
    concepts.extend(numbers)
    # Extract quoted or emphasized terms
    quoted = re.findall(r'"([^"]+)"', expected_output)
    concepts.extend(quoted)
    # Extract key technical terms
    terms = re.findall(
        r"\b(?:MEV|MAV|MRV|RIR|RPE|1RM|FFMI|VO2\s*max|HIIT|DOMS|AMPK|MTOR|NSAID|TRT|PED|GI|ROM|DEXA|BMI)\b",
        expected_output,
        re.IGNORECASE,
    )
    concepts.extend(list(set(terms)))
    return concepts


def normalize(text: str) -> str:
    return (
        text.lower()
        .replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )


def check_assertion(
    assertion: str, answer: str, expected_output: str, topic: str
) -> dict:
    """Check a single assertion against the answer. Returns {text, passed, evidence}."""
    answer_lower = normalize(answer)
    expected_lower = normalize(expected_output)

    if "core SBS position" in assertion or "core position" in assertion:
        # Check if the answer captures the main thrust of the expected output
        # Extract the first sentence or main conclusion from expected output
        sentences = re.split(r"[.!?]\s+", expected_output)
        main_points = sentences[:3] if len(sentences) >= 3 else sentences
        # Check for key words from the main points
        key_words = set()
        for sent in main_points:
            words = re.findall(r"\b[a-z]{4,}\b", sent.lower())
            key_words.update(words)
        # Remove common words
        common = {
            "that",
            "this",
            "they",
            "their",
            "with",
            "from",
            "were",
            "said",
            "also",
            "have",
            "been",
            "some",
            "when",
            "more",
            "most",
            "than",
            "about",
            "would",
            "could",
            "should",
            "into",
            "over",
            "does",
            "very",
            "both",
            "each",
            "which",
            "what",
            "there",
            "will",
            "your",
            "them",
            "then",
            "just",
            "like",
            "make",
            "made",
            "only",
            "much",
            "well",
            "even",
            "still",
            "because",
            "often",
            "noted",
            "many",
            "such",
            "especially",
            "rather",
            "whether",
            "being",
            "different",
            "specific",
            "practical",
            "general",
            "based",
            "effect",
            "effects",
            "people",
            "example",
            "versus",
        }
        key_words -= common
        if not key_words:
            return {
                "text": assertion,
                "passed": True,
                "evidence": "Answer addresses the topic adequately.",
            }
        matches = sum(1 for w in key_words if w in answer_lower)
        ratio = matches / len(key_words) if key_words else 0
        passed = ratio >= 0.25
        evidence = f"Answer contains {matches}/{len(key_words)} key concepts from the expected core position."
        if passed:
            # Find a specific matching phrase
            matched_words = [w for w in key_words if w in answer_lower][:5]
            evidence += f" Key matches: {', '.join(matched_words)}."
        else:
            missing = [w for w in key_words if w not in answer_lower][:5]
            evidence += f" Missing concepts include: {', '.join(missing)}."
        return {"text": assertion, "passed": passed, "evidence": evidence}

    elif (
        "specific details" in assertion
        or "numbers" in assertion
        or "mechanisms" in assertion
    ):
        concepts = extract_key_concepts(expected_output)
        if not concepts:
            return {
                "text": assertion,
                "passed": True,
                "evidence": "No specific numbers/details to check in expected output.",
            }
        matches = sum(1 for c in concepts if c.lower() in answer_lower)
        ratio = matches / len(concepts) if concepts else 0
        passed = ratio >= 0.15  # At least 15% of specific details present
        matched = [c for c in concepts if c.lower() in answer_lower][:5]
        evidence = (
            f"Found {matches}/{len(concepts)} specific details from expected output."
        )
        if matched:
            evidence += f" Matched: {', '.join(matched[:3])}."
        return {"text": assertion, "passed": passed, "evidence": evidence}

    elif "caveats" in assertion or "limitations" in assertion:
        # Check for hedging language and caveats
        caveat_markers = [
            "however",
            "caveat",
            "limitation",
            "but",
            "although",
            "though",
            "not always",
            "not necessarily",
            "depends",
            "individual",
            "vary",
            "uncertain",
            "limited",
            "mixed",
            "equivocal",
            "may not",
            "context",
            "speculative",
            "tentative",
            "plausible",
            "unclear",
            "not strong enough",
            "not definitive",
            "insufficient",
        ]
        matches = sum(1 for m in caveat_markers if m in answer_lower)
        passed = matches >= 2
        evidence = f"Found {matches} caveat/limitation markers in the answer."
        if passed:
            found = [m for m in caveat_markers if m in answer_lower][:4]
            evidence += f" Examples: {', '.join(found)}."
        return {"text": assertion, "passed": passed, "evidence": evidence}

    elif "practical recommendations" in assertion or "actionable" in assertion:
        # Check for actionable advice
        action_markers = [
            "recommend",
            "suggest",
            "should",
            "try",
            "start with",
            "aim for",
            "use",
            "keep",
            "maintain",
            "focus on",
            "prioritize",
            "avoid",
            "practical",
            "bottom line",
            "takeaway",
            "in practice",
            "specifically",
            "protocol",
            "approach",
            "strategy",
        ]
        matches = sum(1 for m in action_markers if m in answer_lower)
        passed = matches >= 3
        evidence = f"Found {matches} actionable recommendation markers."
        if passed:
            found = [m for m in action_markers if m in answer_lower][:4]
            evidence += f" Examples: {', '.join(found)}."
        return {"text": assertion, "passed": passed, "evidence": evidence}

    elif "does not contradict" in assertion:
        # Check for direct contradictions - this is hard to do heuristically
        # We'll check if the answer's conclusions align with the expected direction
        # Look for strong opposing statements
        contradiction_found = False
        evidence = "No obvious contradictions detected with the expected position."

        # Check a few common contradiction patterns
        if (
            "not" in expected_lower
            or "unlikely" in expected_lower
            or "limited" in expected_lower
        ):
            # Expected output is negative/skeptical - check if answer is overly positive
            strong_positive = [
                "clearly works",
                "definitely helps",
                "proven to",
                "strongly recommend",
                "no doubt",
                "universally",
            ]
            for phrase in strong_positive:
                if phrase in answer_lower and phrase not in expected_lower:
                    contradiction_found = True
                    evidence = f"Answer contains strong positive claim '{phrase}' that may contradict the expected skeptical position."
                    break

        passed = not contradiction_found
        return {"text": assertion, "passed": passed, "evidence": evidence}

    else:
        # Generic assertion - do basic content overlap check
        expected_words = set(re.findall(r"\b[a-z]{5,}\b", expected_lower))
        answer_words = set(re.findall(r"\b[a-z]{5,}\b", answer_lower))
        common = {
            "about",
            "their",
            "there",
            "these",
            "those",
            "would",
            "could",
            "should",
            "which",
            "other",
            "being",
            "after",
            "before",
            "between",
            "through",
            "during",
            "because",
            "while",
            "where",
        }
        expected_words -= common
        overlap = expected_words & answer_words
        ratio = len(overlap) / len(expected_words) if expected_words else 0
        passed = ratio >= 0.2
        evidence = f"Content overlap: {len(overlap)}/{len(expected_words)} key terms shared ({ratio:.0%})."
        return {"text": assertion, "passed": passed, "evidence": evidence}


def grade_eval(eval_data: dict, eval_dir: Path, config: str) -> dict:
    """Grade a single eval for a given config."""
    answer = read_answer(eval_dir, config)
    if not answer:
        return {
            "summary": {"pass_rate": 0.0, "passed": 0, "failed": 0, "total": 0},
            "expectations": [],
        }

    metadata = read_metadata(eval_dir)
    assertions = metadata.get(
        "assertions",
        [
            f"Answer captures the core SBS position on {eval_data.get('topic', 'the topic')}",
            "Answer includes key specific details, numbers, or mechanisms mentioned by the hosts",
            "Answer acknowledges important caveats or limitations discussed by the hosts",
            "Answer includes actionable practical recommendations consistent with the hosts' advice",
            "Answer does not contradict the hosts' stated position",
        ],
    )

    expected_output = eval_data.get("expected_output", "")
    topic = eval_data.get("topic", "")

    expectations = []
    for assertion in assertions:
        result = check_assertion(assertion, answer, expected_output, topic)
        expectations.append(result)

    passed = sum(1 for e in expectations if e["passed"])
    failed = len(expectations) - passed
    total = len(expectations)
    pass_rate = passed / total if total > 0 else 0.0

    return {
        "summary": {
            "pass_rate": round(pass_rate, 4),
            "passed": passed,
            "failed": failed,
            "total": total,
        },
        "expectations": expectations,
    }


def find_eval_dir(eval_id: int, topic: str) -> Path | None:
    """Find the eval directory for a given eval."""
    # Try direct match
    for d in sorted(WORKSPACE.glob("eval-*")):
        if d.name.startswith(f"eval-{eval_id}-"):
            return d
    return None


def main():
    evals = load_evals()
    configs = ["with_skill", "without_skill"]

    total_graded = 0
    total_skipped = 0

    for eval_data in evals:
        eval_id = eval_data["id"]
        topic = eval_data.get("topic", "")
        eval_dir = find_eval_dir(eval_id, topic)

        if eval_dir is None:
            print(f"  SKIP eval-{eval_id}: directory not found")
            total_skipped += 1
            continue

        for config in configs:
            grading = grade_eval(eval_data, eval_dir, config)

            if grading["summary"]["total"] == 0:
                print(f"  SKIP eval-{eval_id}/{config}: no answer found")
                total_skipped += 1
                continue

            # Write to run-1/grading.json for aggregate script compatibility
            run_dir = eval_dir / config / "run-1"
            run_dir.mkdir(parents=True, exist_ok=True)
            grading_path = run_dir / "grading.json"
            with open(grading_path, "w") as f:
                json.dump(grading, f, indent=2)

            pr = grading["summary"]["pass_rate"]
            p = grading["summary"]["passed"]
            t = grading["summary"]["total"]
            print(f"  eval-{eval_id}/{config}: {p}/{t} passed ({pr:.0%})")
            total_graded += 1

    print(f"\nDone: {total_graded} graded, {total_skipped} skipped")


if __name__ == "__main__":
    main()
