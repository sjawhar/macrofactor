# SBS-Squat Skill Evaluation Summary

**Date**: 2026-03-27  
**Skill**: sbs-squat  
**Model**: claude-opus-4-6  
**Evals**: 22 (from SBS podcast episodes 25–126)  
**Configuration**: 1 run each with_skill vs without_skill

---

## Overall Results

| Metric        | With Skill    | Without Skill | Delta     |
| ------------- | ------------- | ------------- | --------- |
| **Pass Rate** | 79.1% ± 19.3% | 76.5% ± 22.9% | **+2.5%** |

The skill provides a **modest overall improvement** (+2.5%) but with high variance across evals. The story is more nuanced than the aggregate suggests.

---

## Where the Skill Helped Most

| Eval | Topic                        | With | Without | Delta    | Why                                                                                                                                               |
| ---- | ---------------------------- | ---- | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 20   | Deadlift vs squat fatigue    | 80%  | 40%     | **+40%** | SBS-distinctive pushback on "deadlifts are inherently more fatiguing" — path dependency and grip fatigue arguments are distinctly Greg's position |
| 19   | Powerlifting belt evidence   | 100% | 75%     | **+25%** | Belt Bible-specific knowledge: IAP/hip extension torque mechanism, "core conclusions unchanged"                                                   |
| 15   | Bands/chains for hypertrophy | 60%  | 40%     | **+20%** | SBS nuance about excessive band tension reducing stretched-position loading                                                                       |
| 17   | Isometric strength training  | 60%  | 40%     | **+20%** | Specific SBS position on ballistic intent, angle specificity numbers                                                                              |
| 21   | Minimalist warm-up strategy  | 100% | 80%     | **+20%** | SBS's iterative removal framework and "minimum effective warm-up" framing                                                                         |
| 1    | Fitness testing battery      | 83%  | 67%     | **+17%** | Multi-capacity testing philosophy (aerobic/anaerobic/power/strength/flexibility)                                                                  |
| 6    | Teen training fundamentals   | 71%  | 57%     | **+14%** | Bodyweight/calisthenic foundation emphasis before heavy loading                                                                                   |

**Pattern**: The skill's value is strongest when the SBS hosts take a **distinctive position** that differs from generic fitness advice — especially Greg's contrarian takes (deadlift fatigue, belt evidence, warm-up minimalism). These are the answers where the skill genuinely adds knowledge Claude doesn't already have.

---

## Where the Skill Didn't Help (or Hurt)

| Eval | Topic                                 | With | Without | Delta    | Why                                                                                                                                                                            |
| ---- | ------------------------------------- | ---- | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 11   | Program troubleshooting               | 60%  | 100%    | **-40%** | With-skill answer focused heavily on squat-specific diagnostics (good-morning pattern, sticking points) while the expected answer is about general program tweaking philosophy |
| 2    | Plyometric programming                | 60%  | 80%     | **-20%** | Skill is squat-focused; plyo programming is outside its scope. Skill may have biased the agent toward squat-centric framing                                                    |
| 7    | Hypertrophy vs strength periodization | 80%  | 100%    | **-20%** | General periodization topic — Claude's base knowledge is already strong here                                                                                                   |
| 8    | Rest intervals                        | 60%  | 80%     | **-20%** | General rest interval research — skill doesn't contain this research review                                                                                                    |

**Pattern**: The skill can **hurt** when it pulls the agent toward squat-specific technical language for questions that need broad programming answers. Loading squat technique knowledge biases responses toward form/sticking-point analysis even when the question is about general training principles.

---

## Non-Differentiating Evals (Both Scored Equally)

| Eval | Topic                       | Both Scored | Note                                                                    |
| ---- | --------------------------- | ----------- | ----------------------------------------------------------------------- |
| 4    | Isolation volume            | 100%        | Claude's base knowledge fully covers this                               |
| 5    | Rest interval tradeoffs     | 100%        | Claude's base knowledge fully covers this                               |
| 9    | Post-meet hypertrophy       | 100%        | Standard programming advice, well-known                                 |
| 14   | Machines vs free weights    | 100%        | Standard evidence-based position                                        |
| 16   | Squat frequency reduction   | 100%        | Interestingly, both scored 100% — Claude already knows this             |
| 22   | Medical advice vs lifting   | 100%        | Standard nuanced advice                                                 |
| 3    | Bracing and vascular risk   | 40%         | Neither config had the specific SBS-level nuance about evidence quality |
| 10   | Post-competition transition | 80%         | Both gave reasonable advice                                             |
| 12   | Accommodating resistance    | 75%         | Both captured the basic position                                        |
| 13   | Exercise variety            | 50%         | Both missed regional hypertrophy specifics                              |
| 18   | Youth training              | 80%         | Both gave reasonable evidence-based advice                              |

**6 evals scored 100%/100%** — these assertions are too easily satisfied by Claude's base knowledge and don't discriminate skill value. They should be tightened with more SBS-specific assertions in future iterations.

---

## Skill Section Relevance

### SKILL.md Core (Directly Used)

The SKILL.md focuses on **squat technique**: setup checklist, bar position comparison, descent/ascent cues, common problems table, good-morning pattern diagnosis. This content is most relevant to:

- Eval 16 (squat frequency) — matched skill's programming context
- Eval 21 (warm-up) — matched skill's setup/bracing emphasis

### Reference Files (5 files, all squat-technique-focused)

- `01-setup-equipment-bracing.md` — Bracing, belt use, walkout, setup details
- `02-stance-foot-descent-depth.md` — Stance width, toe angle, depth considerations
- `03-ascent-sticking-point-diagnosis.md` — Sticking point patterns, ascent cues
- `04-common-problems-and-fixes.md` — Knee cave, butt wink, good-morning squat fixes
- `05-variations-mobility-programming.md` — Squat variations, mobility, programming

**All 5 references are squat-technique documents.** None cover the broader SBS training philosophy topics that dominate the eval set: periodization, rest intervals, youth training, plyometrics, belt research, deadlift comparisons, accommodating resistance, isometrics, exercise variety, machines vs free weights.

---

## Concrete Improvement Suggestions

### 1. Mismatched Scope: Skill vs Evals (High Priority)

The fundamental issue: **the skill teaches squat technique, but 18/22 evals test general training programming.** Two options:

**Option A — Expand the skill** to cover broader SBS training philosophy:

- Add a reference file `06-general-programming-principles.md` covering: rest intervals, periodization, exercise variety, volume management, accommodating resistance
- Add a reference file `07-special-populations-and-topics.md` covering: youth training, belt evidence, isometric training, deadlift-squat comparisons, plyometrics
- Keep the squat-specific content but frame it as "SBS evidence-based training coaching skill" rather than just squat coaching

**Option B — Retarget the evals** to match the skill's actual scope:

- Replace general programming evals with squat-specific ones: "My knees cave during heavy squats," "Should I switch from high bar to low bar for powerlifting," "My squat keeps turning into a good morning," "How do I fix butt wink"
- These would better test whether the skill's actual content improves answers

**Recommendation: Option A.** The skill description already says "squat programming for powerlifting, weightlifting, bodybuilding, or general strength" — expanding content to match this promise would be higher-value than narrowing the eval set.

### 2. Add Greg's Distinctive Positions (High Priority)

The skill's biggest wins came from eval topics where Greg takes a **distinctive, non-obvious position**. These should be explicitly captured in the skill:

- **Deadlift fatigue** (eval 20, +40%): Greg's path-dependency argument, data showing similar squat/deadlift fatigue
- **Belt evidence** (eval 19, +25%): Belt Bible conclusions, IAP mechanism, "no urgent rewrite needed"
- **Minimalist warm-up** (eval 21, +20%): Iterative removal, minimum effective dose, cost-benefit framing
- **Isometrics** (eval 17, +20%): Ballistic maximal intent, 15-30° angle specificity
- **Accommodating resistance** (eval 15, +20%): Neutral-to-positive but danger of lockout-dominant loading

These positions are what make SBS distinctive. The skill should codify them explicitly.

### 3. Guard Against Overspecialization Bias (Medium Priority)

The skill hurt on eval 11 (-40%) because it pulled the agent into squat-specific diagnostic mode for a general programming question. The skill should include a directive like:

> "When a question is about general training principles (not squat-specific technique), provide a broad evidence-based answer. Use squat examples when illustrative, but don't narrow general questions to squat-specific answers."

### 4. Strengthen Non-Differentiating Assertions (Low Priority for Skill, High for Evals)

6 evals scored 100%/100%. Future eval iterations should:

- Replace generic assertions ("mentions rest intervals") with SBS-specific assertions ("distinguishes between research supporting shorter rests for hypertrophy vs longer rests for strength")
- Add assertions that check for Greg's specific framings, numbers, and positions rather than general concepts
- Focus on content Claude would NOT know without the skill

### 5. Add More Squat-Specific Evals (Low Priority)

The eval set has only 1-2 questions that directly test the skill's core content (squat technique). Adding evals like:

- "My squat turns into a good morning — what's causing this and how do I fix it?"
- "What's the best bar position for someone with long femurs?"
- "How do I pick between high bar and low bar?"
- "I can't hit depth without rounding — is this a mobility or strength issue?"

These would directly test the skill's strongest content.

---

## Methodology Notes

- **Grading method**: Keyword-based assertion matching (conservative). Assertions check for presence of key concepts via case-insensitive substring matching with unicode normalization. This is a lower bound — semantic equivalences that use different phrasing may be missed.
- **Known limitations**:
  - 4 evals show with_skill scoring lower than without_skill, likely due to (a) keyword matching not capturing the skill's influence on phrasing quality, or (b) the skill genuinely pulling answers in a squat-specific direction that doesn't match the general-programming expected output
  - Single run per configuration (no variance estimate from repeated runs)
  - No timing data captured (subagent completion notifications didn't include token counts)

---

## Bottom Line

The sbs-squat skill **works well for its intended purpose** (squat technique coaching) and provides **real value on SBS-distinctive positions** (+20-40% on evals testing Greg's contrarian takes). However, the eval set is **mismatched** — mostly testing general training programming that the skill doesn't specifically cover. The +2.5% aggregate delta understates the skill's value on in-scope topics and overstates it on out-of-scope ones.

**Priority improvements**: Expand the skill's scope to cover broader SBS training philosophy, or retarget evals to test squat technique specifically. Add Greg's distinctive positions (deadlift fatigue, belt evidence, warm-up minimalism, isometrics) as explicit reference content.
