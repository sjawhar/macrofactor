# SBS Deadlift Skill Evaluation — Summary

**Skill**: `sbs-deadlift`
**Iteration**: 1
**Evals**: 19 questions from SBS podcast episodes 25, 27, 39, 46, 50, 105, 106, 126, 144
**Date**: 2026-03-27

---

## Overall Pass Rates

| Configuration     | Mean Pass Rate | Std Dev |
| ----------------- | -------------- | ------- |
| **With skill**    | 74.6%          | ±23.2%  |
| **Without skill** | 74.1%          | ±21.5%  |
| **Delta**         | **+0.5pp**     | —       |

**The skill provides essentially zero net improvement.** Both configurations score nearly identically across the 19 evals. The high standard deviation (>20%) indicates wide per-eval variance, masking offsetting wins and losses.

---

## Where the Skill Helped Most

| Eval | Topic                      | With Skill | Without Skill | Delta     |
| ---- | -------------------------- | ---------- | ------------- | --------- |
| 16   | Powerlifting belt evidence | 100% (3/3) | 67% (2/3)     | **+33pp** |
| 17   | Teen strength expectations | 100% (4/4) | 75% (3/4)     | **+25pp** |
| 5    | Body weight / binge eating | 40% (2/5)  | 20% (1/5)     | **+20pp** |

**Why the skill helped:**

- **Eval 16 (belt evidence)**: The skill enabled the model to describe the specific IAP → hip extension torque mechanism that Greg cited. Without the skill, the model mentioned IAP generally but missed the hip extension torque connection.
- **Eval 17 (teen expectations)**: The skill provided the SBS-specific framework of classifying training stage by progression timescale (session-to-session vs weekly vs monthly), which the without-skill answer missed.
- **Eval 5 (body weight)**: The skill helped surface the coaching critique (poor trainer setup), though both configurations missed most key points from the expected output.

---

## Where the Skill Hurt

| Eval | Topic                     | With Skill | Without Skill | Delta     |
| ---- | ------------------------- | ---------- | ------------- | --------- |
| 13   | Accommodating resistance  | 67% (2/3)  | 100% (3/3)    | **-33pp** |
| 18   | Deadlift vs squat fatigue | 50% (2/4)  | 75% (3/4)     | **-25pp** |
| 1    | Fitness testing battery   | 40% (2/5)  | 60% (3/5)     | **-20pp** |
| 8    | Rest intervals            | 60% (3/5)  | 80% (4/5)     | **-20pp** |
| 15   | Youth resistance training | 80% (4/5)  | 100% (5/5)    | **-20pp** |

**Why the skill hurt:**

- **Eval 13 (accommodating resistance)**: The skill answer failed to cite research evidence showing bands/chains don't outperform conventional loading. The without-skill answer stated this clearly. The skill's deadlift-specific framing may have biased the model toward technique-focused advice rather than citing research.
- **Eval 18 (deadlift fatigue)**: The skill reinforced the "deadlifts are more fatiguing" narrative from its own content, causing the model to support the blanket claim rather than push back as Greg did (citing data showing similar fatigue outcomes). The without-skill answer was more nuanced.
- **Eval 1 (fitness battery)**: The skill caused a deadlift-centric test battery (deadlift 1RM, 5RM, deficit pull, grip strength) rather than the broad multi-capacity battery Greg proposed (aerobic, sprint, explosive, strength). The without-skill answer included 5K run, vertical jump, medicine ball throws — closer to the expected output.
- **Eval 8 (rest intervals)**: The skill answer presented shorter rest as clearly advantageous for hypertrophy, while Greg said the research is mixed. Neither answer mentioned supersets.
- **Eval 15 (youth training)**: The without-skill answer mentioned that training loads are less concerning than running/jumping impact forces — a specific point from Greg. The skill answer missed this.

---

## Tied Evals (14 of 19)

Both configurations scored identically on 14 evals. Most topics were general strength training questions where the skill's deadlift-specific content didn't provide an edge — or where both configurations missed the same SBS-specific details.

### Perfect Scores (both 100%): Evals 7, 9, 12

- **Hypertrophy vs strength periodization**: Both captured the progression, competition timing, and adherence points.
- **Deadlift necessity for bodybuilding**: Both gave clear affirmatives with alternatives.
- **Program troubleshooting**: Both captured the conservative iteration approach.

### Common Misses (both failed same assertions):

- **Eval 2 (sloped platform)**: Neither mentioned confounding variables (plate calibration, temperature) or suggested deliberate experimentation — both jumped to "fix it" advice.
- **Eval 3 (bracing/vascular)**: Neither mentioned occupational lifting epidemiology.
- **Eval 5 (body weight)**: Neither captured the calorie expenditure point or bodyweight performance targets.
- **Eval 6 (teen training)**: Neither specifically recommended bodyweight/calisthenic practice before barbell loading.
- **Eval 11 (post-competition)**: Neither said complete time off is acceptable/trivial.
- **Eval 14 (isometrics)**: Neither described high-intent ballistic maximal contractions or noted programming is less standardized.
- **Eval 19 (minimalist warm-up)**: Neither framed as cost-benefit for time or recommended iterative removal.

---

## Which Skill Sections Were Most/Least Referenced

### Most Referenced (by with_skill answers)

1. **"Setup quality is the force multiplier"** — cited in evals 2, 5, 10, 12, 17, 19. This principle appeared in nearly every deadlift-adjacent answer.
2. **"Deadlifts are disproportionately fatiguing"** — cited in evals 8, 10, 11, 18, 19. Frequently invoked and sometimes counterproductively (eval 18).
3. **Sticking point analysis** (off-floor, midrange, lockout) — cited in evals 12, 13. Useful for technique troubleshooting.
4. **Volume heuristic (50-67% of squat volume)** — cited in evals 10, 17, 18. Consistent SBS recommendation.

### Least Referenced

- **Reference files** (if any exist): The skill's reference material didn't surface in answers for general strength training questions (evals 3, 4, 7, 8, 15).
- **Conventional vs sumo comparison**: Only surfaced in evals 10 and 18.

---

## Concrete Suggestions for Improving the Skill

### 1. **Broaden the Scope or Accept the Niche**

The skill is narrowly deadlift-focused, but 12 of 19 eval questions are about general strength training (rest intervals, youth training, belts, accommodating resistance, etc.). The skill either needs to:

- **Expand to cover general SBS principles** (training philosophy, research interpretation style, nuance in claims) — making it more of an "SBS training" skill, or
- **Accept its narrow scope** and expect it only helps on deadlift-specific questions (evals 2, 9, 10, 17, 18).

### 2. **Add "Push Back" Heuristic**

The skill's "deadlifts are disproportionately fatiguing" content caused the model to reinforce this claim even when the expected output pushed back on it (eval 18). The skill should include Greg's actual nuance: "data shows similar fatigue outcomes; the perception is driven by training history and grip/back demands, not inherent biology."

### 3. **Include SBS Research Interpretation Style**

Greg consistently presents research as nuanced ("mixed," "limited," "sparse") rather than making strong claims. The skill should model this epistemological style. For example:

- Rest interval research for hypertrophy is "mixed" (not clearly favoring shorter)
- Accommodating resistance research shows "little to no clear advantage" (citing meta-analyses)
- Vascular bracing evidence is "sparse" with occupational lifting epidemiology as weak analogy

### 4. **Add Cross-Domain SBS Recommendations**

Several high-value SBS recommendations that appeared in expected outputs but were missed:

- **Bodyweight performance targets** during weight loss (push-ups, pull-ups, dips)
- **Iterative warm-up troubleshooting** (remove one element at a time)
- **Progression timescale classification** (session/weekly/monthly for novice/intermediate/advanced)
- **Complete rest is acceptable** (one week per year is trivial)
- **Growth plate loads vs sport impact forces** comparison

### 5. **Reduce Deadlift Tunnel Vision**

The skill's narrow focus caused tunnel vision on eval 1 (fitness testing battery) — the model built a deadlift-centric battery instead of the broad multi-capacity battery Greg proposed. For questions about general fitness, the skill should yield to broader reasoning rather than forcing every answer through a deadlift lens.

---

## Bottom Line

The sbs-deadlift skill in its current form is **net neutral**. It helps on a few deadlift-specific questions (belt mechanisms, teen progression classification) but hurts on questions where its deadlift-centric framing overrides the nuanced, research-aware perspective that SBS actually models. The skill needs broader SBS epistemological principles and less narrow deadlift-only content to be consistently beneficial.
