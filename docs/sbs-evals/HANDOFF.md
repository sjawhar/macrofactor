# SBS Skill Evaluation — Handoff Document

## What You're Doing

You are autonomously running the skill-creator evaluation loop for one of the five Stronger By Science (SBS) fitness skills. These skills encode evidence-based knowledge about diet, strength training, squatting, bench pressing, and deadlifting — sourced directly from Greg Nuckols' definitive guides at strongerbyscience.com.

The goal: measure how much better Claude answers real listener questions when the skill is loaded versus without it. The ground truth is what the SBS podcast hosts (Greg Nuckols, Pak, Milo) actually said in response to those exact listener questions.

---

## Key Paths

| Resource                   | Path                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| Skill to evaluate          | `/home/sami/Code/macrofactor/.opencode/skills/<skill-name>/SKILL.md`                               |
| Skill references           | `/home/sami/Code/macrofactor/.opencode/skills/<skill-name>/references/`                            |
| Evals file                 | `/home/sami/Code/macrofactor/.opencode/skills/<skill-name>/evals.json`                             |
| Your output workspace      | `/home/sami/Code/macrofactor/docs/sbs-evals/<skill-name>/`                                         |
| Skill-creator skill        | `/home/sami/.dotfiles/vendor/anthropic-skills/skills/skill-creator/SKILL.md`                       |
| Skill-creator scripts      | `/home/sami/.dotfiles/vendor/anthropic-skills/skills/skill-creator/scripts/`                       |
| Skill-creator viewer       | `/home/sami/.dotfiles/vendor/anthropic-skills/skills/skill-creator/eval-viewer/generate_review.py` |
| All other skills (context) | `/home/sami/Code/macrofactor/.opencode/skills/`                                                    |

---

## The Evals Format

Each eval in `evals.json` looks like:

```json
{
  "id": 3,
  "prompt": "Is it okay to treat minimum fat intake as a weekly target instead of hitting a minimum every single day?",
  "expected_output": "They said weekly averaging is generally fine. The practical goal is still to cover essential fatty acids, hormone support, and absorption of fat-soluble vitamins — and this is achievable on a weekly basis. The main caveat is not letting very low-fat days cluster together in ways that create multi-day deficits. Their general recommendation was daily minimums as a guideline rather than a hard rule, with weekly totals as the practical check.",
  "topic": "minimum fat intake frequency",
  "episode": 105,
  "files": []
}
```

- **`prompt`**: A real listener question from the SBS podcast, rephrased naturally.
- **`expected_output`**: What the SBS hosts actually said. This is your ground truth for grading.
- **`topic`**: Short label. Use this in directory names.
- **`episode`**: Source episode number, for traceability.

---

## The Evaluation Philosophy

**Do not constrain yourself.** You are trusted to define what a good answer looks like. Some guidance:

- The `expected_output` is the authoritative SBS answer. A good response from Claude should cover the key recommendations, include relevant specifics (numbers, mechanisms, caveats), and demonstrate the same level of nuance.
- You are comparing **Claude-with-skill vs Claude-without-skill**. The question is: does loading the skill materially improve the quality, specificity, and accuracy of the answer?
- Craft your assertions based on what actually matters for each question — don't use a one-size-fits-all rubric.
- It's fine for an answer to exceed the expected_output if it's genuinely better and grounded. It's not fine for it to miss the core recommendation.

---

## Environment Notes

- **HEADLESS**: No browser. Use `--static <output_path>` when calling `generate_review.py` to produce a standalone HTML file instead of launching a server.
- **Working directory**: `/home/sami/Code/macrofactor/`
- **Python**: `python3` (available at `/usr/bin/python3`)
- **Skill-creator scripts**: Run as `python3 /home/sami/.dotfiles/vendor/anthropic-skills/skills/skill-creator/scripts/aggregate_benchmark.py <workspace>/iteration-1 --skill-name <skill-name>`

---

## How to Run the Eval Loop

Follow the skill-creator skill instructions exactly. In brief:

1. **Read the skill-creator SKILL.md** in full — it has the complete process.
2. **Read the evals.json** for your assigned skill.
3. **Run ALL evals** (no limit — we want full coverage).
4. **Spawn with-skill and without-skill subagents in the same turn** for each eval. The with-skill subagent should read the skill's SKILL.md and relevant reference files before answering. The without-skill subagent should answer with no special context.
5. **Save outputs** to `<workspace>/iteration-1/eval-<id>-<topic>/with_skill/outputs/answer.md` and `.../without_skill/outputs/answer.md`.
6. **Grade** each output against the expected_output. Write specific assertions per eval — don't be generic.
7. **Aggregate** using the benchmark script.
8. **Generate static HTML review** with `--static <workspace>/review.html`.
9. **Write a summary** to `<workspace>/summary.md`:
   - Overall pass rate with-skill vs without-skill
   - Which questions the skill helped most / least
   - Which skill sections (SKILL.md vs reference files) were most referenced
   - Concrete suggestions for improving the skill

---

## Output Structure Expected

```
docs/sbs-evals/<skill-name>/
├── iteration-1/
│   ├── eval-1-<topic>/
│   │   ├── eval_metadata.json
│   │   ├── with_skill/
│   │   │   ├── outputs/answer.md
│   │   │   └── grading.json
│   │   └── without_skill/
│   │       ├── outputs/answer.md
│   │       └── grading.json
│   ├── eval-2-<topic>/
│   │   └── ...
│   ├── benchmark.json
│   └── benchmark.md
├── review.html          ← static HTML viewer
└── summary.md           ← your written analysis
```

---

## What Success Looks Like

- Every eval in `evals.json` has been run with both configurations.
- Grading is specific (assertions tied to actual content, not just "was it helpful?").
- The benchmark shows a meaningful delta (or tells us the skill needs work).
- `summary.md` contains actionable improvement suggestions — not just "the skill helped."
- Results are fully saved so the orchestrator can read them and synthesize across all 5 skills.
