# Skill Benchmark: sbs-squat

**Model**: claude-opus-4-6
**Date**: 2026-03-27T16:11:54Z
**Evals**: 22 (1 run each per configuration)

## Summary

| Metric    | With Skill    | Without Skill | Delta |
| --------- | ------------- | ------------- | ----- |
| Pass Rate | 79.1% ± 19.3% | 76.5% ± 22.9% | +2.5% |

## Per-Eval Breakdown

| Eval | Topic                                       | With Skill | Without Skill | Delta   |
| ---- | ------------------------------------------- | ---------- | ------------- | ------- |
| 1    | fitness-testing-battery                     | 83%        | 67%           | +17% ✅ |
| 2    | plyometric-programming                      | 60%        | 80%           | -20% ⚠️ |
| 3    | bracing-and-vascular-risk                   | 40%        | 40%           | +0% ➡️  |
| 4    | isolation-volume                            | 100%       | 100%          | +0% ➡️  |
| 5    | hypertrophy-vs-rest-interval-tradeoffs      | 100%       | 100%          | +0% ➡️  |
| 6    | teen-training-and-nutrition-fundamentals    | 71%        | 57%           | +14% ✅ |
| 7    | hypertrophy-vs-strength-periodization       | 80%        | 100%          | -20% ⚠️ |
| 8    | rest-intervals-for-strength-and-hypertrophy | 60%        | 80%           | -20% ⚠️ |
| 9    | post-meet-hypertrophy-without-strength-loss | 100%       | 100%          | +0% ➡️  |
| 10   | post-competition-transition-week            | 80%        | 80%           | +0% ➡️  |
| 11   | program-troubleshooting-and-plateaus        | 60%        | 100%          | -40% ⚠️ |
| 12   | accommodating-resistance-effectiveness      | 75%        | 75%           | +0% ➡️  |
| 13   | exercise-variety-and-hypertrophy            | 50%        | 50%           | +0% ➡️  |
| 14   | machines-vs-free-weights                    | 100%       | 100%          | +0% ➡️  |
| 15   | bands-and-chains-for-hypertrophy            | 60%        | 40%           | +20% ✅ |
| 16   | squat-frequency-reduction                   | 100%       | 100%          | +0% ➡️  |
| 17   | isometric-strength-training                 | 60%        | 40%           | +20% ✅ |
| 18   | youth-resistance-training                   | 80%        | 80%           | +0% ➡️  |
| 19   | powerlifting-belt-evidence                  | 100%       | 75%           | +25% ✅ |
| 20   | deadlift-vs-squat-fatigue                   | 80%        | 40%           | +40% ✅ |
| 21   | minimalist-warm-up-strategy                 | 100%       | 80%           | +20% ✅ |
| 22   | medical-advice-vs-lifting-goals             | 100%       | 100%          | +0% ➡️  |

## Analyst Notes

- Eval 1 (fitness-testing-battery): skill improved pass rate by +17% (83% vs 67%)
- Eval 2 (plyometric-programming): without_skill (80%) outscored with_skill (60%) — possible keyword matching artifact or skill adding noise
- Eval 4 (isolation-volume): 100% pass rate in both configs — assertions may not differentiate skill value
- Eval 5 (hypertrophy-vs-rest-interval-tradeoffs): 100% pass rate in both configs — assertions may not differentiate skill value
- Eval 6 (teen-training-and-nutrition-fundamentals): skill improved pass rate by +14% (71% vs 57%)
- Eval 7 (hypertrophy-vs-strength-periodization): without_skill (100%) outscored with_skill (80%) — possible keyword matching artifact or skill adding noise
- Eval 8 (rest-intervals-for-strength-and-hypertrophy): without_skill (80%) outscored with_skill (60%) — possible keyword matching artifact or skill adding noise
- Eval 9 (post-meet-hypertrophy-without-strength-loss): 100% pass rate in both configs — assertions may not differentiate skill value
- Eval 11 (program-troubleshooting-and-plateaus): without_skill (100%) outscored with_skill (60%) — possible keyword matching artifact or skill adding noise
- Eval 14 (machines-vs-free-weights): 100% pass rate in both configs — assertions may not differentiate skill value
- Eval 15 (bands-and-chains-for-hypertrophy): skill improved pass rate by +20% (60% vs 40%)
- Eval 16 (squat-frequency-reduction): 100% pass rate in both configs — assertions may not differentiate skill value
- Eval 17 (isometric-strength-training): skill improved pass rate by +20% (60% vs 40%)
- Eval 19 (powerlifting-belt-evidence): skill improved pass rate by +25% (100% vs 75%)
- Eval 20 (deadlift-vs-squat-fatigue): skill improved pass rate by +40% (80% vs 40%)
- Eval 21 (minimalist-warm-up-strategy): skill improved pass rate by +20% (100% vs 80%)
- Eval 22 (medical-advice-vs-lifting-goals): 100% pass rate in both configs — assertions may not differentiate skill value
- Overall with_skill avg: 79.1%, without_skill avg: 76.5%, delta: +2.5%
- Grading used keyword-based assertion matching — conservative baseline. Semantic equivalences may be underscored.
- Most evals test general training programming knowledge rather than squat-specific technique, limiting skill differentiation opportunity.
