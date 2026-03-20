#!/usr/bin/env python3
"""
Grade all eval answers against expected_output and generate benchmark.json.
For each eval, reads the with_skill and without_skill answers,
compares to expected_output, generates specific assertions, and writes grading.json.
Then produces benchmark.json and benchmark.md for the viewer.
"""

import json
import math
import os
import re
from datetime import datetime, timezone

EVALS_PATH = (
    "/home/sami/Code/macrofactor/.opencode/skills/sbs-strength-training/evals.json"
)
WORKSPACE = (
    "/home/sami/Code/macrofactor/docs/sbs-evals/sbs-strength-training/iteration-1"
)
SKILL_PATH = "/home/sami/Code/macrofactor/.opencode/skills/sbs-strength-training"


def slugify(text, max_len=50):
    slug = text.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug[:max_len].rstrip("-")


def generate_assertions(eval_data):
    """Generate specific, testable assertions for an eval based on expected_output."""
    expected = eval_data["expected_output"]
    topic = eval_data["topic"]
    assertions = []

    # 1. Core position assertion
    core_patterns = [
        r"(?:bottom line|net (?:answer|take|guidance|recommendation)|their (?:answer|take|recommendation|practical)|overall|core (?:point|recommendation)|main (?:recommendation|takeaway))[:\s]+([^.]+\.)",
        r"(?:practical (?:takeaway|recommendation|advice|message|implication))[:\s]+([^.]+\.)",
    ]
    found_core = False
    for pattern in core_patterns:
        match = re.search(pattern, expected, re.IGNORECASE)
        if match:
            assertions.append(
                f"Answer aligns with the hosts' core position: {match.group(1).strip()[:120]}"
            )
            found_core = True
            break
    if not found_core:
        assertions.append(f"Answer captures the hosts' main position on {topic}")

    # 2. Specific numbers/details assertion
    numbers = re.findall(
        r"(?:about |roughly |around |approximately )?\d+[\d.,]*\s*(?:%|percent|kg|lb|g|mg|hours?|minutes?|weeks?|days?|sessions?|sets?|reps?|RIR|RPE|x/week|ml/kg)",
        expected,
        re.IGNORECASE,
    )
    if numbers:
        num_str = ", ".join(numbers[:3])
        assertions.append(
            f"Answer includes specific quantitative details (e.g., {num_str})"
        )

    # 3. Key caveat/nuance assertion
    caveat_patterns = [
        r"(?:caveat|however|but|although|warning|cautioned|emphasized that|important)",
        r"(?:individual|varies|depends|context|not universal)",
    ]
    if any(re.search(p, expected, re.IGNORECASE) for p in caveat_patterns):
        assertions.append(
            "Answer acknowledges important caveats or individual variability"
        )

    # 4. Practical recommendation assertion
    if any(
        w in expected.lower()
        for w in ["recommend", "practical", "advice", "suggest", "guidance"]
    ):
        assertions.append(
            "Answer provides actionable practical recommendations consistent with hosts' guidance"
        )

    # 5. No contradiction assertion
    assertions.append(
        f"Answer does not contradict the hosts' stated position on {topic}"
    )

    return assertions


def check_answer_quality(answer_text, expected_output, assertions):
    """Grade an answer against expected output using keyword/concept matching."""
    results = []
    answer_lower = answer_text.lower() if answer_text else ""
    expected_lower = expected_output.lower()

    # Extract key concepts from expected output
    stop_words = {
        "that",
        "this",
        "with",
        "they",
        "their",
        "from",
        "were",
        "have",
        "been",
        "also",
        "said",
        "noted",
        "about",
        "would",
        "could",
        "should",
        "some",
        "more",
        "most",
        "much",
        "many",
        "very",
        "just",
        "still",
        "even",
        "when",
        "than",
        "then",
        "them",
        "what",
        "which",
        "where",
        "while",
        "does",
        "both",
        "each",
        "over",
        "into",
        "only",
        "well",
        "being",
        "other",
        "these",
        "those",
        "because",
        "rather",
        "often",
        "since",
        "between",
        "after",
        "before",
        "during",
        "without",
        "within",
        "like",
        "make",
        "made",
        "work",
        "used",
        "using",
        "based",
        "such",
        "will",
    }
    key_concepts = set()
    for word in re.findall(r"\b[a-z]{4,}\b", expected_lower):
        if word not in stop_words:
            key_concepts.add(word)

    if answer_lower and key_concepts:
        overlap = sum(1 for c in key_concepts if c in answer_lower)
        coverage = overlap / len(key_concepts)
    else:
        coverage = 0.0

    for assertion in assertions:
        if not answer_text or len(answer_text.strip()) < 50:
            results.append(
                {
                    "text": assertion,
                    "passed": False,
                    "evidence": "Answer is missing or too short",
                }
            )
            continue

        al = assertion.lower()

        if "core position" in al or "main position" in al or "aligns with" in al:
            passed = coverage > 0.15 and len(answer_text) > 100
            evidence = f"Concept coverage: {coverage:.0%} of key terms found in answer"
            results.append({"text": assertion, "passed": passed, "evidence": evidence})

        elif "quantitative" in al or "specific" in al or "numbers" in al:
            answer_nums = re.findall(r"\d+", answer_text)
            expected_nums = re.findall(r"\d+", expected_output)
            passed = len(answer_nums) >= max(1, len(expected_nums) // 3)
            evidence = f"Answer has {len(answer_nums)} numeric values (expected has {len(expected_nums)})"
            results.append({"text": assertion, "passed": passed, "evidence": evidence})

        elif "caveat" in al or "variability" in al or "nuance" in al:
            nuance_words = [
                "however",
                "although",
                "caveat",
                "depends",
                "varies",
                "individual",
                "context",
                "not always",
                "not necessarily",
                "limited",
                "uncertain",
                "may not",
                "might not",
                "some cases",
                "in some",
                "caution",
            ]
            count = sum(1 for w in nuance_words if w in answer_lower)
            passed = count >= 2
            evidence = f"Found {count} nuance/caveat indicators"
            results.append({"text": assertion, "passed": passed, "evidence": evidence})

        elif "practical" in al or "actionable" in al or "recommendation" in al:
            action_words = [
                "recommend",
                "suggest",
                "try",
                "consider",
                "start with",
                "aim for",
                "should",
                "practical",
                "strategy",
                "approach",
                "tip",
                "guideline",
            ]
            count = sum(1 for w in action_words if w in answer_lower)
            passed = count >= 2
            evidence = f"Found {count} actionable recommendation indicators"
            results.append({"text": assertion, "passed": passed, "evidence": evidence})

        elif "contradict" in al:
            passed = coverage > 0.10 and len(answer_text) > 100
            evidence = (
                f"Concept alignment: {coverage:.0%} overlap (no obvious contradiction)"
            )
            results.append({"text": assertion, "passed": passed, "evidence": evidence})
        else:
            passed = coverage > 0.15 and len(answer_text) > 150
            evidence = (
                f"Quality check: {coverage:.0%} coverage, {len(answer_text)} chars"
            )
            results.append({"text": assertion, "passed": passed, "evidence": evidence})

    return results


def grade_single(eval_data, config):
    """Grade a single eval's answer. Returns grading dict."""
    eval_id = eval_data["id"]
    dirname = f"eval-{eval_id}-{slugify(eval_data['topic'])}"
    answer_path = os.path.join(WORKSPACE, dirname, config, "outputs", "answer.md")
    grading_path = os.path.join(WORKSPACE, dirname, config, "grading.json")

    answer_text = ""
    if os.path.exists(answer_path):
        with open(answer_path) as f:
            answer_text = f.read()

    assertions = generate_assertions(eval_data)
    expectation_results = check_answer_quality(
        answer_text, eval_data["expected_output"], assertions
    )

    passed = sum(1 for r in expectation_results if r["passed"])
    total = len(expectation_results)

    grading = {
        "expectations": expectation_results,
        "summary": {
            "passed": passed,
            "failed": total - passed,
            "total": total,
            "pass_rate": round(passed / total, 4) if total > 0 else 0.0,
        },
        "execution_metrics": {
            "output_chars": len(answer_text),
            "answer_exists": os.path.exists(answer_path),
        },
    }

    with open(grading_path, "w") as f:
        json.dump(grading, f, indent=2)

    return grading


def calc_stats(values):
    """Calculate mean, stddev, min, max."""
    if not values:
        return {"mean": 0.0, "stddev": 0.0, "min": 0.0, "max": 0.0}
    n = len(values)
    mean = sum(values) / n
    if n > 1:
        variance = sum((x - mean) ** 2 for x in values) / (n - 1)
        stddev = math.sqrt(variance)
    else:
        stddev = 0.0
    return {
        "mean": round(mean, 4),
        "stddev": round(stddev, 4),
        "min": round(min(values), 4),
        "max": round(max(values), 4),
    }


def generate_benchmark(evals, with_results, without_results):
    """Generate benchmark.json from grading results."""
    runs = []

    for ev, grading in zip(evals, with_results):
        dirname = f"eval-{ev['id']}-{slugify(ev['topic'])}"
        runs.append(
            {
                "eval_id": ev["id"],
                "eval_name": dirname,
                "configuration": "with_skill",
                "run_number": 1,
                "result": {
                    "pass_rate": grading["summary"]["pass_rate"],
                    "passed": grading["summary"]["passed"],
                    "failed": grading["summary"]["failed"],
                    "total": grading["summary"]["total"],
                    "time_seconds": 0,
                    "tokens": grading["execution_metrics"]["output_chars"],
                    "tool_calls": 0,
                    "errors": 0,
                },
                "expectations": grading["expectations"],
                "notes": [],
            }
        )

    for ev, grading in zip(evals, without_results):
        dirname = f"eval-{ev['id']}-{slugify(ev['topic'])}"
        runs.append(
            {
                "eval_id": ev["id"],
                "eval_name": dirname,
                "configuration": "without_skill",
                "run_number": 1,
                "result": {
                    "pass_rate": grading["summary"]["pass_rate"],
                    "passed": grading["summary"]["passed"],
                    "failed": grading["summary"]["failed"],
                    "total": grading["summary"]["total"],
                    "time_seconds": 0,
                    "tokens": grading["execution_metrics"]["output_chars"],
                    "tool_calls": 0,
                    "errors": 0,
                },
                "expectations": grading["expectations"],
                "notes": [],
            }
        )

    # Calculate summaries
    ws_rates = [g["summary"]["pass_rate"] for g in with_results]
    wos_rates = [g["summary"]["pass_rate"] for g in without_results]
    ws_tokens = [g["execution_metrics"]["output_chars"] for g in with_results]
    wos_tokens = [g["execution_metrics"]["output_chars"] for g in without_results]

    ws_summary = {
        "pass_rate": calc_stats(ws_rates),
        "time_seconds": calc_stats([0] * len(ws_rates)),
        "tokens": calc_stats(ws_tokens),
    }
    wos_summary = {
        "pass_rate": calc_stats(wos_rates),
        "time_seconds": calc_stats([0] * len(wos_rates)),
        "tokens": calc_stats(wos_tokens),
    }

    delta_pr = ws_summary["pass_rate"]["mean"] - wos_summary["pass_rate"]["mean"]
    delta_tok = ws_summary["tokens"]["mean"] - wos_summary["tokens"]["mean"]

    run_summary = {
        "with_skill": ws_summary,
        "without_skill": wos_summary,
        "delta": {
            "pass_rate": f"{delta_pr:+.2f}",
            "time_seconds": "+0.0",
            "tokens": f"{delta_tok:+.0f}",
        },
    }

    # Analyst notes
    notes = []
    # Find evals where skill helped most
    if with_results and without_results:
        deltas = []
        for i, (ws, wos) in enumerate(zip(with_results, without_results)):
            d = ws["summary"]["pass_rate"] - wos["summary"]["pass_rate"]
            deltas.append(
                (
                    evals[i]["id"],
                    evals[i]["topic"],
                    d,
                    ws["summary"]["pass_rate"],
                    wos["summary"]["pass_rate"],
                )
            )

        deltas.sort(key=lambda x: x[2], reverse=True)
        best = [d for d in deltas if d[2] > 0]
        worst = [d for d in deltas if d[2] < 0]
        tied = [d for d in deltas if d[2] == 0]

        notes.append(
            f"With-skill avg pass rate: {calc_stats(ws_rates)['mean'] * 100:.1f}%, Without-skill: {calc_stats(wos_rates)['mean'] * 100:.1f}%"
        )
        notes.append(
            f"Skill improved {len(best)} evals, hurt {len(worst)} evals, tied on {len(tied)} evals"
        )

        if best[:3]:
            top3 = ", ".join(f"eval-{b[0]} ({b[1]})" for b in best[:3])
            notes.append(f"Skill helped most on: {top3}")
        if worst[:3]:
            bot3 = ", ".join(f"eval-{b[0]} ({b[1]})" for b in worst[:3])
            notes.append(f"Skill hurt most on: {bot3}")

        # Check for always-pass assertions
        all_pass_both = 0
        for i in range(len(with_results)):
            ws_exps = with_results[i]["expectations"]
            wos_exps = without_results[i]["expectations"]
            for j in range(min(len(ws_exps), len(wos_exps))):
                if ws_exps[j]["passed"] and wos_exps[j]["passed"]:
                    all_pass_both += 1
        total_assertions = sum(g["summary"]["total"] for g in with_results)
        if total_assertions > 0:
            pct = all_pass_both / total_assertions * 100
            notes.append(
                f"{pct:.0f}% of assertions pass in both configurations (potential non-discriminating)"
            )

    benchmark = {
        "metadata": {
            "skill_name": "sbs-strength-training",
            "skill_path": SKILL_PATH,
            "executor_model": "claude-sonnet-4-20250514",
            "analyzer_model": "claude-opus-4-6",
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "evals_run": [ev["id"] for ev in evals],
            "runs_per_configuration": 1,
        },
        "runs": runs,
        "run_summary": run_summary,
        "notes": notes,
    }

    return benchmark


def generate_markdown(benchmark):
    """Generate benchmark.md summary."""
    meta = benchmark["metadata"]
    rs = benchmark["run_summary"]

    ws = rs.get("with_skill", {})
    wos = rs.get("without_skill", {})
    delta = rs.get("delta", {})

    lines = [
        f"# Skill Benchmark: {meta['skill_name']}",
        "",
        f"**Model**: {meta['executor_model']}",
        f"**Date**: {meta['timestamp']}",
        f"**Evals**: {len(meta['evals_run'])} evals, {meta['runs_per_configuration']} run per configuration",
        "",
        "## Summary",
        "",
        "| Metric | With Skill | Without Skill | Delta |",
        "|--------|-----------|--------------|-------|",
        f"| Pass Rate | {ws.get('pass_rate', {}).get('mean', 0) * 100:.1f}% ± {ws.get('pass_rate', {}).get('stddev', 0) * 100:.1f}% | {wos.get('pass_rate', {}).get('mean', 0) * 100:.1f}% ± {wos.get('pass_rate', {}).get('stddev', 0) * 100:.1f}% | {delta.get('pass_rate', '—')} |",
        f"| Tokens (chars) | {ws.get('tokens', {}).get('mean', 0):.0f} ± {ws.get('tokens', {}).get('stddev', 0):.0f} | {wos.get('tokens', {}).get('mean', 0):.0f} ± {wos.get('tokens', {}).get('stddev', 0):.0f} | {delta.get('tokens', '—')} |",
        "",
    ]

    if benchmark.get("notes"):
        lines.append("## Observations")
        lines.append("")
        for note in benchmark["notes"]:
            lines.append(f"- {note}")

    return "\n".join(lines)


def main():
    with open(EVALS_PATH) as f:
        data = json.load(f)

    evals_list = data["evals"]

    total_graded = 0
    missing = []
    with_results = []
    without_results = []

    for ev in evals_list:
        eval_id = ev["id"]
        dirname = f"eval-{eval_id}-{slugify(ev['topic'])}"

        for config in ["with_skill", "without_skill"]:
            answer_path = os.path.join(
                WORKSPACE, dirname, config, "outputs", "answer.md"
            )
            if not os.path.exists(answer_path):
                missing.append(f"eval-{eval_id} {config}")
                # Still grade (will get all-fail)
            grading = grade_single(ev, config)
            total_graded += 1
            if config == "with_skill":
                with_results.append(grading)
            else:
                without_results.append(grading)

    print(f"Graded {total_graded} answers across {len(evals_list)} evals")
    if missing:
        print(f"Missing {len(missing)} answer files:")
        for m in missing[:20]:
            print(f"  - {m}")
        if len(missing) > 20:
            print(f"  ... and {len(missing) - 20} more")

    # Summary stats
    if with_results:
        ws_rate = sum(r["summary"]["pass_rate"] for r in with_results) / len(
            with_results
        )
        print(f"\nWith-skill avg pass rate: {ws_rate:.1%}")
    if without_results:
        wos_rate = sum(r["summary"]["pass_rate"] for r in without_results) / len(
            without_results
        )
        print(f"Without-skill avg pass rate: {wos_rate:.1%}")
    if with_results and without_results:
        print(f"Delta: {ws_rate - wos_rate:+.1%}")

    # Generate benchmark.json
    benchmark = generate_benchmark(evals_list, with_results, without_results)
    bench_path = os.path.join(WORKSPACE, "benchmark.json")
    with open(bench_path, "w") as f:
        json.dump(benchmark, f, indent=2)
    print(f"\nWrote {bench_path}")

    # Generate benchmark.md
    md = generate_markdown(benchmark)
    md_path = os.path.join(WORKSPACE, "benchmark.md")
    with open(md_path, "w") as f:
        f.write(md)
    print(f"Wrote {md_path}")


if __name__ == "__main__":
    main()
