---
name: sbs-diet
description: Evidence-based nutrition and dieting guidance for body composition and performance. Use this whenever users ask about nutrition, calories, macros, protein targets, fat loss, cutting, bulking, recomping, meal timing, intermittent fasting, keto/low-carb, processed foods, diet adherence, plateaus, metabolic adaptation, weight-change pacing, or food-choice tradeoffs. Trigger aggressively for questions about what/how much to eat, how to lose fat or gain muscle, or how to adjust diet plans over time—even when users do not explicitly ask for "diet coaching."
---

# SBS Diet Setup and Adjustment Skill

Use this as a practical, numbers-first coaching framework based on Eric Trexler's Stronger By Science diet guide.

## Core SBS Decision Framework (Use in this order)

1. **Set goal and pace**
   - Fat loss: aim for **0.25-1.0% bodyweight/week** (aggressive: **>1%/week**).
   - Gain: aim for **0.1-0.25% bodyweight/week** (aggressive: **>0.25%/week**).
   - Maintain/recomp: prioritize stable trend plus performance/recovery metrics.
2. **Set calories from a starting estimate** (then transition to observation).
3. **Set protein first** (highest priority macro).
4. **Set fat with a hard floor** (never below floor).
5. **Fill remaining calories with carbs** according to training demands and preference.
6. **Cover health basics**: fiber, micronutrients, hydration, essential fats.
7. **Track daily intake + standardized morning weigh-ins** and adjust with trend data.
8. **Iterate calmly**: react to sustained trend mismatch, not day-to-day noise.

## SBS Epistemic Style

When uncertain, say so. SBS distinguishes:

- "Strong evidence" (protein for muscle, calories for weight change)
- "Plausible mechanism, limited data" (meal timing, cortisol management)
- "Popular claim, weak evidence" (calorie cycling, specific supplement stacks)

Match this calibration in responses — don't present contested claims as settled.

## Calorie Starting Targets (Assume Method)

| Goal pace       | kcal/lb/day | kcal/kg/day |
| --------------- | ----------: | ----------: |
| Aggressive cut  |          11 |        24.2 |
| Moderate cut    |          13 |        28.6 |
| Maintain        |          15 |        33.0 |
| Moderate gain   |          17 |        37.4 |
| Aggressive gain |          19 |        41.8 |

Use as **starting points**, then individualize via observed weight trend.

## Deficit/Surplus Ranges (Estimate Method)

### Deficits for fat loss

- Conservative: **10-20% below TDEE** (or about **250-500 kcal/day** below maintenance).
- Moderate: about **500-750 kcal/day** below maintenance.
- Aggressive: **30-40% below TDEE** (or about **750-1000 kcal/day** below).

### Surpluses for gain

- Conservative/lean-biased: **5-10% above TDEE** (or about **+125 to +250 kcal/day**).
- Moderate: **10-20% above TDEE** (or about **+250 to +375 kcal/day**).
- Aggressive: **15-20% above TDEE** (up to about **+500 kcal/day**).

Prefer percentage-based adjustments for very small/large people; flat kcal is less scalable.

## Protein Targets (Direct-use defaults)

### By training context

- **Lifters (muscle gain/retention focus): 1.6-2.2 g/kg/day** (total body mass).
- **Non-lifters: 1.2-1.8 g/kg/day** (total body mass).

### Body-composition-adjusted ranges

- If very high or very low body-fat, scale by fat-free mass: **2.0-2.75 g/kg FFM/day**.
- Practical broad range seen across healthy contexts: **1.25-3.1 g/kg FFM/day**
  (low end = sedentary, weight stable, higher body-fat; high end = lean, active, in deficit).

### Meal distribution targets

- Usually **3-6 protein feedings/day**.
- Aim each feeding for **>=0.3 g/kg protein** and **~2-3 g leucine**.
- Vegan/plant-heavy setups: prioritize complete EAA coverage and at least **3-4 substantial feedings/day**.

## Fat Targets and Floor

- Typical fat target: **20-35% of calories**.
- In very high/very low calorie contexts, practical target range: **0.7-1.5 g/kg/day**.

### Hard minimum fat floor (SBS height-based)

- If height **<150 cm**: floor = **30 g/day**.
- If height **>=150 cm**:

```text
fat_floor_g_per_day = ((height_cm - 150) * 0.5) + 30
```

This is a **minimum floor**, not a default target.

## Carbohydrate Targets by Context

- **Typical lifter with performance goals**: at least **3-4 g/kg/day** if calories permit.
- **Endurance-heavy training**: at least **6 g/kg/day**.
- **General balanced (non-performance-priority)**: about **40-60% of calories** from carbs.
- **Low-carb**: often **<=30% of calories** (commonly capped around **<=200 g/day**).
- **Keto**: usually **<=50-60 g/day**.

Low-carb/keto are viable for fat loss/maintenance, but not inherently superior for fat loss, hypertrophy, or cardiometabolic outcomes when protein and calories are matched.

## Plateau Protocol (SBS-style)

1. **Standardize data collection first**
   - Weigh daily, morning, post-restroom, same scale/conditions.
   - Log calories/macros daily.
2. **Check adherence and confounders before changing targets**
   - Sodium shifts, carb shifts, hydration, bowel-content shifts can mask progress.
3. **Wait for a meaningful trend window**
   - Do not react to day-to-day noise.
   - Use ~**1-2 weeks** of trend data (or at least a full week of consistent data) before deciding.
4. **If rate is slower than target**
   - **Cut:** lower calories mostly via carbs + fats.
   - Keep protein on target.
   - Reduce fat and carbs together until fat floor is reached, then mostly reduce carbs.
5. **If gain is slower than target**
   - Raise calories via carbs and/or fat according to preference and training demands.
   - For poor appetite in bulks: use more liquid calories and more palatable foods.
6. **Reassess after another trend window** and repeat as needed.

## Coaching Defaults (If-this-then-that)

| Scenario                                     | Default action                                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| User wants simple cut start                  | Use 13 kcal/lb (28.6 kcal/kg), or 11 kcal/lb if explicitly aggressive.                        |
| User wants simple bulk start                 | Use 17 kcal/lb (37.4 kcal/kg), or 19 kcal/lb if explicitly aggressive.                        |
| User is lifting and unsure on protein        | Start at 1.8 g/kg/day; keep in 1.6-2.2 range.                                                 |
| User is non-lifter and unsure on protein     | Start at 1.4-1.6 g/kg/day within 1.2-1.8 range.                                               |
| User is very lean in a cut                   | Bias protein upward (2.2+ g/kg TBM or toward high end of FFM range).                          |
| User is high body-fat and protein seems huge | Use FFM-based target (2.0-2.75 g/kg FFM).                                                     |
| Cut stalled but intake/adherence good        | Reduce calories via carbs+fat; do not cut protein first.                                      |
| Fat intake very low in a cut                 | Enforce height-based fat floor immediately.                                                   |
| High-intensity training performance dropping | Raise carbs toward >=3-4 g/kg (>=6 g/kg for endurance).                                       |
| User asks low-carb vs low-fat winner         | Explain adherence and calorie/protein matching drive outcomes; pick the one they can sustain. |

## Top 15 High-Priority SBS Points

1. Calories largely determine weight change direction and pace.
2. Protein is the first macro priority for muscle retention/gain.
3. Maintenance phases between bulk and cut are **optional**; there is no physiological requirement to include one.
4. Hardgainer problems are usually **calorie problems**, not protein problems.
5. BMI is useful at population level, but for taller lifters **height^2.5 is often more appropriate than height^2** for size-indexing context.
6. Mass gainers are **adherence tools** (easy calories), not physiologically superior to matched whole-food intake.
7. Calorie cycling (e.g., lower on rest days) is **not clearly evidence-supported** when weekly calories/macros are matched.
8. Keto is not magic — matched calories and protein drive most body-composition outcomes.
9. Diet pattern choice (TRF, IF, low-carb, etc.) should be based on sustainability and performance fit.
10. Daily scale weight is noisy; use trends across at least about 1-2 weeks.
11. In cuts, reduce carbs/fat first and keep protein high.
12. Enforce a fat floor; very low fat is not a badge of discipline.
13. Carbs support high-intensity performance; lower carbs only when tradeoff is intentional.
14. Recomp is most feasible in newer lifters and/or higher body-fat contexts.
15. If adherence is poor, simplify structure before making extreme macro changes.

## Quick Answers (Common Diet Questions)

| Question                                | SBS-consistent answer                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| How much protein?                       | Lifters: 1.6-2.2 g/kg/day. Non-lifters: 1.2-1.8 g/kg/day.                                               |
| Should protein change in a deficit?     | Usually yes, especially if lean and/or in large deficits. Bias upward.                                  |
| How fast should I lose?                 | Usually 0.25-1.0% bodyweight/week; >1% is aggressive with tradeoffs.                                    |
| How fast should I gain?                 | Usually 0.1-0.25% bodyweight/week; >0.25% is aggressive.                                                |
| Is intermittent fasting superior?       | Not superior when calories are matched; useful if it improves adherence.                                |
| Is time-restricted feeding superior?    | Mainly an adherence tool; if using it, keep enough protein feedings.                                    |
| Is keto/low-carb superior for fat loss? | No inherent advantage with matched calories/protein; can still be a viable preference-based option.     |
| Are processed foods always bad?         | No. Keep nutrient-dense staples high; highly processed foods are fine in moderation if targets are met. |
| Vegan for muscle gain?                  | Viable if protein quantity/quality, leucine/EAA distribution, and micronutrients are handled.           |
| Should supplement calories count?       | Count meaningful protein/carb/fat/amino-acid calories when precision matters.                           |

## Health Coverage Minimums

- **Fiber:** start around **14 g/1000 kcal** (or roughly **28 g/day women, 36 g/day men**), then individualize tolerance (many do well around 20-50 g/day).
- **Hydration:** baseline about **3-4 L/day** total water (women AI ~2.7 L, men AI ~3.7 L), adjusted for context.
- **Essential fats:** limit artificial trans fats; include adequate omega-3/omega-6 intake.
- **Micronutrients:** target RDA/AI, stay below UL; pay extra attention during hard training, low calories, or vegan-heavy diets.

## Response Pattern to Use in Chat

When users ask diet questions, answer in this order:

1. Clarify goal (cut/maintain/gain/recomp) and desired pace.
2. Give calorie start with one conservative and one aggressive option.
3. Set protein target with rationale.
4. Set fat floor + target.
5. Set carb target by training context.
6. Give adjustment trigger (what trend means increase/decrease calories).
7. Add 1-2 adherence tactics customized to preferences.

## Out of Scope

This skill covers diet, macros, calories, and food strategy. It does NOT cover:

- Supplement pharmacology (creatine, caffeine, citrulline, etc.) → see references/06-supplements-and-ergogenic-aids.md
- Hormones and health markers (cortisol, TRT, amenorrhea, bloodwork) → see references/07-health-markers-and-hormones.md
- Clinical conditions requiring medical advice
  For these: use the reference files if present, otherwise rely on general knowledge and flag uncertainty.

## Reference Files

- `references/01-energy-balance-and-calorie-targets.md`
- `references/02-protein-fat-carbs.md`
- `references/03-diet-patterns-and-meal-timing.md`
- `references/04-adherence-and-diet-adjustments.md`
- `references/05-micronutrients-fiber-hydration.md`
- `references/06-supplements-and-ergogenic-aids.md`
- `references/07-health-markers-and-hormones.md`
