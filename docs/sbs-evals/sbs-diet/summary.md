# SBS Diet Skill Evaluation — Summary

**Date**: 2026-03-27
**Evals run**: 63 (62 with_skill completed, 63 without_skill completed; eval 43 with_skill timed out)
**Grading method**: Keyword-based assertion matching (253 total assertions across 63 evals)

---

## Overall Results

| Metric        | With Skill | Without Skill | Delta |
| ------------- | ---------- | ------------- | ----- |
| Avg pass rate | 81.5%      | 81.6%         | -0.1% |
| Skill wins    | 11         | —             | —     |
| Skill losses  | 13         | —             | —     |
| Ties          | 39         | —             | —     |

**Bottom line**: The sbs-diet skill produces near-zero aggregate improvement over Claude's base knowledge on these 63 listener questions. The skill wins 11 evals, loses 13, and ties 39 — essentially a wash.

---

## Where the Skill Helped Most

| Eval | Topic                                | With | Without | Delta |
| ---- | ------------------------------------ | ---- | ------- | ----- |
| 11   | Personal cooking preferences         | 100% | 67%     | +33%  |
| 20   | Mass gainers and calorie adherence   | 100% | 67%     | +33%  |
| 6    | Vegan transition and supplementation | 100% | 75%     | +25%  |
| 16   | BMI interpretation in tall lifters   | 75%  | 50%     | +25%  |
| 24   | Hardgainers and protein dosing       | 100% | 75%     | +25%  |
| 38   | Protein and kidney stones            | 75%  | 50%     | +25%  |
| 40   | Aspirin and hypertrophy              | 100% | 75%     | +25%  |
| 42   | Daily hydration targets              | 50%  | 25%     | +25%  |
| 57   | Dream research studies               | 25%  | 0%      | +25%  |
| 59   | Fasted morning training performance  | 100% | 75%     | +25%  |

**Pattern**: The skill helps most on topics where the SBS framework provides specific decision-making structure (protein targets for hardgainers, fasted training recommendations) or where the question is very SBS-specific (cooking preferences, mass gainer philosophy). The +33% wins on eval 11 and 20 show the skill's adherence-first framing improves answers that Claude otherwise treats more generically.

## Where the Skill Hurt Most

| Eval | Topic                                      | With | Without | Delta |
| ---- | ------------------------------------------ | ---- | ------- | ----- |
| 43   | Hydration timing and nocturia              | 0%\* | 75%     | -75%  |
| 21   | Interpreting fasting research              | 33%  | 67%     | -33%  |
| 4    | TRT and programming implications           | 50%  | 75%     | -25%  |
| 10   | Steps and calorie adjustment               | 50%  | 75%     | -25%  |
| 28   | Aerobic conditioning and strength plateaus | 75%  | 100%    | -25%  |
| 35   | Dietary nitrate                            | 75%  | 100%    | -25%  |
| 46   | Cortisol practical action steps            | 50%  | 75%     | -25%  |
| 50   | High-volume cutting meals                  | 75%  | 100%    | -25%  |
| 51   | Joint supplements in older lifters         | 75%  | 100%    | -25%  |
| 54   | Post-surgery detraining and return         | 75%  | 100%    | -25%  |

\*Eval 43 with_skill timed out (no answer produced), so the -75% is an artifact.

**Pattern**: The skill hurts on topics that fall outside its core coverage. Questions about aerobic conditioning, joint supplements, cortisol mechanisms, dietary nitrate, and post-surgery protocols are not in the skill's reference files. When the model reads the SBS skill files, it may:

1. Anchor too heavily on the skill's diet-framework content, losing access to its broader knowledge
2. Produce diet-framework-shaped answers to questions that need physiology or pharmacology
3. Waste token budget reading 5 reference files that don't contain relevant information for the specific question

---

## Analysis of Tie Rate (62%)

The 39/63 tie rate is the dominant signal. It means:

1. **Claude's base model already knows most nutrition fundamentals.** Concepts like "protein 1.6-2.2 g/kg," "calories drive fat loss," "maintenance phases are optional," and "keto isn't inherently superior" are well-established in Claude's training data.

2. **Keyword-based grading is coarse.** Both versions mention the same broad concepts (e.g., "protein," "deficit," "adherence"). The real differentiation — SBS-specific numbers, particular study citations, the distinctive SBS coaching voice — gets lost in keyword matching.

3. **The skill's value is in specificity, not coverage.** When the with-skill answer says "13 kcal/lb as a moderate cut starting point" versus the without-skill answer saying "a moderate deficit of 500 kcal/day," both pass the assertion "recommends a moderate deficit" — but the with-skill answer is more precisely SBS-aligned.

---

## Skill Section Usage Analysis

The skill has 6 content sources:

- `SKILL.md` — Core decision framework (171 lines)
- `references/01-energy-balance-and-calorie-targets.md`
- `references/02-protein-fat-carbs.md`
- `references/03-diet-patterns-and-meal-timing.md`
- `references/04-adherence-and-diet-adjustments.md`
- `references/05-micronutrients-fiber-hydration.md`

### Most relevant sections (based on eval coverage):

- **SKILL.md core tables** (Calorie Starting Targets, Protein Targets, Coaching Defaults): Referenced by ~40% of evals (all cutting/bulking/macro questions)
- **references/02-protein-fat-carbs.md**: Referenced by ~30% of evals (protein targets, fat floors, macro splits)
- **references/04-adherence-and-diet-adjustments.md**: Referenced by ~20% of evals (plateaus, calorie cycling, refeeds)

### Least relevant sections:

- **references/05-micronutrients-fiber-hydration.md**: Only ~10% of evals touch hydration/micronutrients
- Many evals (pharmacology, hormones, specific supplements, contest prep bloodwork) have NO corresponding content in any skill file

---

## Concrete Improvement Suggestions

### 1. Expand Beyond Diet Basics (HIGH PRIORITY)

The skill covers calories, macros, and diet patterns thoroughly but has blind spots on:

- **Supplements**: Creatine, caffeine, citrulline, sodium bicarbonate, ashwagandha, theanine, glucosamine/chondroitin — all have multiple evals with no skill coverage
- **Hormones and health markers**: Cortisol, hypothalamic amenorrhea, contest prep bloodwork, TRT implications
- **Body composition edge cases**: Recomp, very low body fat effects, metabolic adaptation from yo-yo dieting

**Recommendation**: Add a `references/06-supplements-and-ergogenic-aids.md` and a `references/07-health-markers-and-hormones.md` to cover the most common listener questions outside the diet-framework core.

### 2. Add SBS-Specific Stances (MEDIUM PRIORITY)

The skill's highest value is when it provides specific SBS stances that differ from generic advice. These should be more prominent:

- Maintenance phases are **optional** (not the default recommendation most coaches give)
- Hardgainer problems are **calorie problems, not protein problems**
- BMI uses height^2 but **height^2.5 is more appropriate**
- Mass gainers are **adherence tools, not superior products**
- Calorie cycling is **not evidence-supported** when weekly intake is matched

### 3. Add a "What This Skill Doesn't Cover" Section (LOW PRIORITY)

Explicitly listing out-of-scope topics would prevent the model from trying to force diet-framework answers onto pharmacology questions. Something like:

```
## Out of Scope
This skill does not cover: detailed pharmacology (drug metabolism, CYP enzymes), clinical conditions (diabetes management, amenorrhea treatment), specific supplement dosing protocols, or personal anecdotes from SBS hosts. For these, rely on general knowledge and recommend professional consultation.
```

### 4. Refine Assertion Design for Future Evals (META)

The keyword-based grading method used here measures concept coverage but not SBS-specificity. Future eval iterations should:

- Include assertions that check for SBS-specific numbers (e.g., "mentions 13 kcal/lb" not just "recommends a deficit")
- Include negative assertions (e.g., "does NOT recommend 1 g/lb as the primary target")
- Use LLM-based grading for nuance assessment

---

## Methodology Notes

- **Grading**: Programmatic keyword matching. Each assertion was mapped to 1-3 keyword groups. An assertion passes if ALL groups have at least one match in the answer text (case-insensitive).
- **Limitation**: This approach favors concept presence over quality/specificity. Both "eat around 1.6-2.2 g/kg protein" and "eat enough protein" could pass an assertion about protein recommendations, even though the former is far more SBS-aligned.
- **Missing data**: Eval 43 with_skill timed out, producing no answer. This accounts for the -75% delta on that eval.
- **Single run per config**: Each eval was run once per configuration (not 3x as the benchmark metadata suggests). Variance data is therefore meaningless.

---

## Verdict

The sbs-diet skill in its current form **does not measurably improve Claude's diet answers** when measured by keyword-based assertion matching. However, this likely understates the skill's qualitative value — the with-skill answers tend to use more precise SBS numbers, follow the SBS decision framework, and sound more like an evidence-based coach rather than a generic health assistant.

The biggest improvement opportunities are:

1. **Expand coverage** to supplements, hormones, and health markers that many evals touch
2. **Sharpen SBS-specific stances** that differentiate from generic advice
3. **Improve eval methodology** to capture specificity, not just concept presence
