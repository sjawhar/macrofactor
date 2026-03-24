# SBS Bench Skill Evaluation — Summary

**Skill evaluated:** `sbs-bench`
**Date:** 2026-03-27
**Evals run:** 19 (all from evals.json)
**Configurations:** with_skill (Sonnet reads SKILL.md + 5 reference files) vs without_skill (Sonnet answers from general knowledge)
**Grader model:** claude-opus-4-6

---

## Overall Results

| Metric        | With Skill        | Without Skill     | Delta     |
| ------------- | ----------------- | ----------------- | --------- |
| **Pass Rate** | **79.0% ± 24.8%** | **78.3% ± 22.5%** | **+0.7%** |

**Bottom line: The sbs-bench skill provides near-zero aggregate improvement over baseline.** The delta of +0.7% is statistically negligible. The skill helps on a few specific questions but actively hurts on others, netting out to roughly even.

---

## Per-Eval Breakdown

| Eval | Topic                                 | With Skill | Without Skill | Delta    | Winner      |
| ---- | ------------------------------------- | ---------- | ------------- | -------- | ----------- |
| 1    | Best test of raw strength             | 50%        | 50%           | 0%       | Tie         |
| 2    | Fitness testing battery               | 71%        | 86%           | -15%     | **Without** |
| 3    | Low incline vs flat bench             | 40%        | 40%           | 0%       | Tie         |
| 4    | Pump vs strength                      | 75%        | 75%           | 0%       | Tie         |
| 5    | Isolation volume                      | 100%       | 80%           | **+20%** | **With**    |
| 6    | Teen training and nutrition           | 86%        | 86%           | 0%       | Tie         |
| 7    | Hypertrophy vs strength periodization | 83%        | 83%           | 0%       | Tie         |
| 8    | Rest intervals                        | 80%        | 80%           | 0%       | Tie         |
| 9    | Post-meet hypertrophy                 | 100%       | 100%          | 0%       | Tie         |
| 10   | Post-competition transition           | 100%       | 100%          | 0%       | Tie         |
| 11   | Program troubleshooting               | 100%       | 100%          | 0%       | Tie         |
| 12   | Accommodating resistance              | 100%       | 100%          | 0%       | Tie         |
| 13   | Machines vs free weights              | 75%        | 100%          | **-25%** | **Without** |
| 14   | Bands & chains for hypertrophy        | 80%        | 80%           | 0%       | Tie         |
| 15   | Isometric training                    | 100%       | 67%           | **+33%** | **With**    |
| 16   | Youth resistance training             | 100%       | 100%          | 0%       | Tie         |
| 17   | Minimalist warm-up                    | 100%       | 80%           | **+20%** | **With**    |
| 18   | Bench prime mover                     | 40%        | 60%           | **-20%** | **Without** |
| 19   | Strength during weight loss           | 20%        | 20%           | 0%       | Tie         |

---

## Where the Skill Helped Most

### Eval 15 — Isometric training (+33%)

The skill's reference material on training modalities helped the with-skill agent articulate **angle specificity (±15°)** and the importance of **high-intent maximal contractions** — specific SBS claims the baseline model didn't produce. The without-skill response recommended longer moderate holds (20-60s at 60-80% MVC) and missed the different fatigue profile from lack of eccentric loading.

### Eval 5 — Isolation volume (+20%)

The with-skill agent produced **more conservative, SBS-aligned volume recommendations** (2-4 sets per muscle group for smaller areas) matching the expected answer. The without-skill agent recommended substantially higher volumes (6-12 sets for delts, 6-12 for calves) that overshoot the SBS hosts' guidance.

### Eval 17 — Minimalist warm-up (+20%)

The with-skill agent specifically recommended **iterative troubleshooting (remove one element at a time)** — a distinctive SBS recommendation. The without-skill agent gave general guidelines but lacked this specific methodological approach.

---

## Where the Skill Hurt

### Eval 13 — Machines vs free weights (-25%)

**Critical failure.** The with-skill agent declared "Free weights are superior for hypertrophy in most contexts," directly contradicting the expected answer that "neither modality is universally superior." The without-skill agent nailed this with: "Neither is universally better." The skill's heavy bench-centric framing likely biased the agent toward free-weight superiority.

### Eval 18 — Bench prime mover (-20%)

**Factual error.** The with-skill agent **incorrectly** stated pecs are biarticular and triceps are monoarticular — the opposite of reality (the long head triceps is biarticular). The without-skill agent correctly identified triceps as biarticular. Neither cited Duffy's dissertation data. The skill apparently confused the agent's understanding of muscle mechanics.

### Eval 2 — Fitness testing battery (-15%)

The without-skill agent included **anaerobic running tests** (40-yard dash, shuttle) that matched the SBS hosts' recommendation, while the with-skill agent substituted bench-specific tests (5RM bench, scapular retraction screens) — over-indexing on the skill's bench focus instead of general athletic testing.

---

## Where Both Failed (Systemic Gaps)

### Eval 1 — Best test of raw strength (both 50%)

Neither configuration mentioned **odd-object lifting/strongman activities** (Husafell stone carry, irregular stone lifting) — the SBS hosts' actual answer. Both defaulted to the deadlift and multi-lift totals. The odd-object recommendation is a distinctive SBS opinion not well-represented in general training knowledge.

### Eval 3 — Low incline vs flat bench (both 40%)

Both configurations incorrectly characterized low incline as having **shorter ROM** than flat bench. The SBS hosts argued the opposite: low incline may provide **longer effective ROM** because the changed touch point can increase pec/triceps excursion. Both also failed to acknowledge Greg's personal preference for low incline with modest confidence.

### Eval 19 — Strength during weight loss (both 20%)

This question asked about **personal experience** (Greg's cut, his wrist/elbow injury, the psychological acceptance). Neither configuration could answer personally — both gave generic diet/training advice. This eval tests content that would need to be in the skill's reference files as specific anecdotes.

---

## Skill Sections Referenced vs Impact

### SKILL.md (main body)

The SKILL.md covers bench-specific technique extensively: setup, descent, bar path, elbow mechanics, shoulder safety, sticking points, and variation selection. This content is well-structured but **too narrow for the eval questions asked** — most evals cover general strength training topics (programming, periodization, accommodating resistance, machines vs free weights) that are only tangentially related to bench press technique.

### Reference files

The 5 reference files deepen bench technique:

1. `01-setup-arch-leg-drive-unrack.md` — referenced in with-skill answers for setup quality
2. `02-descent-touch-pause-ascent-bar-path.md` — bar path references appeared in several answers
3. `03-competition-vs-general-technique-tradeoffs.md` — helped with eval 7 (periodization)
4. `04-shoulder-safety-pain-and-risk-management.md` — helped with eval 10 (post-meet) and eval 3 (incline)
5. `05-errors-fixes-and-programming.md` — helped with eval 11 (troubleshooting) and eval 8 (rest intervals)

**Pattern:** The references provided the most value when questions directly overlapped with bench press technique (evals 11, 15, 17). They provided no value — or negative value — when questions required broad strength training knowledge that the bench-focused skill couldn't provide (evals 1, 2, 13).

---

## Concrete Suggestions for Improving the Skill

### 1. Add broader strength training content to reference files

The evals show that many SBS podcast questions span general strength training, not just bench technique. The skill needs reference material covering:

- **General programming principles** (progressive overload, periodization, program troubleshooting)
- **Accommodating resistance** (bands/chains — SBS has specific meta-analytic views)
- **Machines vs free weights** (SBS's nuanced "neither is universally better" position)
- **Recovery and rest intervals** (SBS's specific recommendations)

Without this, the with-skill agent sometimes produces _worse_ answers because the bench-focused framing biases responses away from correct general answers.

### 2. Add specific SBS host opinions and anecdotes

Several evals test for **distinctive SBS positions** that differ from mainstream training advice:

- Odd-object lifting as the best raw strength test (eval 1)
- Low incline having potentially longer effective ROM (eval 3)
- The long head triceps measurement artifact at max loads (eval 18)
- Greg's personal cut experience with wrist/elbow injury (eval 19)

These need to be explicitly documented in reference files because they're counter-intuitive or personal and won't emerge from general knowledge.

### 3. Add a "Common SBS positions" quick-reference

A reference file listing 10-15 distinctive SBS stances that differ from conventional wisdom would help the agent produce SBS-aligned answers. Examples:

- Neither machines nor free weights are universally superior for hypertrophy
- Odd-object lifting > barbell lifts as a raw strength test
- Low incline may be modestly better than flat for many lifters
- The triceps-as-prime-mover claim is overstated (measurement artifact of long head)
- Isometrics: ballistic max-intent > long moderate holds

### 4. Clarify biarticular mechanics for bench

The skill's current content may have confused the agent about which muscles are biarticular. Add an explicit note: "The **long head of the triceps** is biarticular (crosses shoulder and elbow). The pecs are NOT biarticular — they cross only the shoulder joint."

### 5. Reduce bench-technique bias for general questions

The skill's heavy bench-technique framing caused the with-skill agent to over-index on bench-specific advice when broader answers were needed (evals 2, 13). Consider either:

- Adding explicit guidance: "For general training questions, provide balanced answers — don't default to bench-centric framing"
- Or splitting general training content into a separate reference file that the skill points to for non-bench questions

---

## Verdict

The sbs-bench skill in its current form is **net-neutral** — it helps modestly on a few questions (isometrics, isolation volume, warm-ups) but actively hurts on others (machines vs free weights, bench prime mover) where its narrow bench focus or inaccurate content introduces errors. The skill needs broader strength training content and explicit documentation of distinctive SBS positions to justify its existence. Without those additions, Claude answers these questions roughly equally well from general knowledge.
