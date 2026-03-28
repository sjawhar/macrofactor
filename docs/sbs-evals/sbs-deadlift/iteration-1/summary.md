# sbs-deadlift Skill Evaluation — Iteration 1 Summary

## Headline Result

**Delta: +0.5 pp** — The skill has no meaningful effect on accuracy.

| Metric    | With Skill    | Without Skill | Delta         |
| --------- | ------------- | ------------- | ------------- |
| Pass Rate | 74.6% ± 23.2% | 74.1% ± 21.5% | +0.5 pp       |
| Avg Time  | 34.1s ± 11.3s | 23.3s ± 5.5s  | +10.8s (+46%) |

The skill adds ~11 seconds of response time (46% slower) for essentially zero accuracy improvement.

## Per-Eval Breakdown

| Eval | Topic                                 | With | Without | Delta | Winner    |
| ---- | ------------------------------------- | ---- | ------- | ----- | --------- |
| 1    | Fitness testing battery               | 40%  | 60%     | -20   | ✗ without |
| 2    | Deadlift on sloped platform           | 50%  | 50%     | 0     | = tied    |
| 3    | Bracing and vascular risk             | 75%  | 75%     | 0     | = tied    |
| 4    | Isolation volume                      | 100% | 75%     | +25   | ✓ with    |
| 5    | Progressive overload / body weight    | 40%  | 20%     | +20   | ✓ with    |
| 6    | Teen training nutrition               | 80%  | 80%     | 0     | = tied    |
| 7    | Hypertrophy vs strength periodization | 100% | 100%    | 0     | = tied    |
| 8    | Rest intervals                        | 60%  | 80%     | -20   | ✗ without |
| 9    | Deadlift necessity (bodybuilding)     | 100% | 100%    | 0     | = tied    |
| 10   | Post-meet hypertrophy                 | 100% | 75%     | +25   | ✓ with    |
| 11   | Post-competition transition           | 75%  | 75%     | 0     | = tied    |
| 12   | Program troubleshooting               | 100% | 100%    | 0     | = tied    |
| 13   | Accommodating resistance              | 67%  | 100%    | -33   | ✗ without |
| 14   | Isometric strength training           | 50%  | 50%     | 0     | = tied    |
| 15   | Youth resistance training             | 80%  | 100%    | -20   | ✗ without |
| 16   | Powerlifting belt evidence            | 100% | 67%     | +33   | ✓ with    |
| 17   | Teen strength expectations            | 100% | 75%     | +25   | ✓ with    |
| 18   | Deadlift vs squat fatigue             | 50%  | 75%     | -25   | ✗ without |
| 19   | Minimalist warmup                     | 50%  | 50%     | 0     | = tied    |

**Score: 5 wins / 5 losses / 9 ties** — perfectly balanced, which means no signal.

## Where the Skill Helped

- **Eval 4 (isolation volume)**: Skill produced the conservative 2–4 sets recommendation matching SBS guidance; without skill over-prescribed at 6–12 sets.
- **Eval 5 (progressive overload)**: Skill correctly identified suboptimal coaching and recommended clinical support for binge eating; without skill missed both.
- **Eval 10 (post-meet hypertrophy)**: Skill captured the over-warm single strategy; without skill missed it.
- **Eval 16 (belt evidence)**: Skill correctly identified the IAP → hip extension torque mechanism; without skill missed it.
- **Eval 17 (teen expectations)**: Skill used progression timescale (session/weekly/monthly) to classify training stage; without skill missed this SBS-specific framework.

## Where the Skill Hurt

- **Eval 1 (fitness testing)**: Skill over-focused on deadlift-centric tests (1RM, deficit pulls), missing aerobic/anaerobic running tests. Without skill included 5K and mile runs. The deadlift framing narrowed the response.
- **Eval 8 (rest intervals)**: Skill presented shorter rest as clearly better for hypertrophy; without skill correctly captured the mixed evidence. Neither mentioned supersets.
- **Eval 13 (accommodating resistance)**: Skill failed to cite research evidence; without skill did. The skill's practical-over-academic tone may have suppressed citation behavior.
- **Eval 15 (youth training)**: Without skill captured all 5 assertions including the running/jumping force comparison; skill missed that comparison.
- **Eval 18 (deadlift fatigue)**: Skill _reinforced_ the claim that deadlifts are more fatiguing — the exact opposite of what the SBS hosts argued (Zourdos data showing similar fatigue). The skill's deadlift-centric framing may have biased toward "deadlifts are special" rather than the evidence-based pushback.

## Systematic Failure Patterns (Both Configs)

These expectations were failed by both configurations, revealing baseline model limitations rather than skill issues:

1. **Missing specific SBS references**: Occupational epidemiology (eval 3), confounding variables like plate calibration (eval 2), iterative warm-up troubleshooting (eval 19). The model generates reasonable advice but misses the specific angles the hosts took.
2. **Over-confident prescriptions**: Both configs present programming parameters as well-established when hosts noted they're less standardized (eval 14: isometric dosing). Neither acknowledged research uncertainty.
3. **Missing cost-benefit framing**: Neither config framed minimalist warm-ups as a time-savings cost-benefit (eval 19). Both defaulted to "it depends" without the specific economic framing Greg used.
4. **Not challenging common claims**: Eval 18 required pushing back on "deadlifts are more fatiguing." The with-skill config actively reinforced the myth; without-skill at least partially pushed back.
5. **Missing bodyweight exercise recommendations**: Both configs missed recommending push-ups/pull-ups/dips as motivational targets (eval 5) and calisthenic precursors to barbell work (eval 6, 15).

## Diagnosis

The skill is **neutral-to-slightly-harmful** in its current form:

1. **Deadlift anchoring bias**: The skill's deadlift-centric framing narrows responses on general training topics (fitness testing, rest intervals, youth training). It pushes the model toward "make this about deadlifts" even when the question is broader.
2. **No accuracy signal**: +0.5 pp over 19 evals is noise. The wins and losses are symmetric.
3. **Time cost is real**: 46% slower with no accuracy benefit is pure overhead.
4. **The 5 wins are real but narrow**: The skill helps on SBS-specific frameworks (progression timescale, conservative volume, belt mechanisms) that the base model doesn't know. But these wins are offset by the anchoring losses.

## Recommendations for Iteration 2

1. **Reduce deadlift anchoring**: The skill should instruct the model to answer the question as asked, using SBS evidence-based principles, rather than always framing through a deadlift lens. Many SBS podcast topics are general training topics that happen to be discussed alongside deadlifts.
2. **Add explicit "pushback" guidance**: Several failures came from the model accepting common gym wisdom instead of challenging it with evidence (eval 18 especially). The skill should instruct: "When a common claim is presented, check whether SBS hosts actually agreed or pushed back."
3. **Add SBS-specific frameworks**: The skill wins came from teaching SBS-specific concepts (progression timescale, conservative isolation volume). Adding more of these (cost-benefit framing for warm-ups, occupational vs training epidemiology distinction, research uncertainty acknowledgment) could help.
4. **Trim or restructure**: If the skill can't overcome the anchoring problem, consider splitting into a general `sbs-training` skill (evidence-based principles) and a narrow `sbs-deadlift-technique` skill (form, setup, cues).
