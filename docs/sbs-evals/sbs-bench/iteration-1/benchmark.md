# Skill Benchmark: sbs-bench

**Executor Model**: claude-sonnet-4-20250514
**Grader Model**: claude-opus-4-6
**Date**: 2026-03-27T16:05:47Z
**Evals**: 1-19 (1 run per configuration)

## Summary

| Metric    | With Skill    | Without Skill | Delta |
| --------- | ------------- | ------------- | ----- |
| Pass Rate | 79.0% ± 24.8% | 78.3% ± 22.5% | +0.7% |

## Per-Eval Results

| Eval | Topic                                 | With Skill | Without Skill | Delta   |
| ---- | ------------------------------------- | ---------- | ------------- | ------- |
| 1    | best-test-of-raw-strength             | 50%        | 50%           | ⚪ +0%  |
| 2    | fitness-testing-battery               | 71%        | 86%           | 🔴 -15% |
| 3    | low-incline-vs-flat-bench             | 40%        | 40%           | ⚪ +0%  |
| 4    | pump-vs-strength                      | 75%        | 75%           | ⚪ +0%  |
| 5    | isolation-volume                      | 100%       | 80%           | 🟢 +20% |
| 6    | teen-training-and-nutrition           | 86%        | 86%           | ⚪ +0%  |
| 7    | hypertrophy-vs-strength-periodization | 83%        | 83%           | ⚪ +0%  |
| 8    | rest-intervals                        | 80%        | 80%           | ⚪ +0%  |
| 9    | post-meet-hypertrophy                 | 100%       | 100%          | ⚪ +0%  |
| 10   | post-competition-transition           | 100%       | 100%          | ⚪ +0%  |
| 11   | program-troubleshooting               | 100%       | 100%          | ⚪ +0%  |
| 12   | accommodating-resistance              | 100%       | 100%          | ⚪ +0%  |
| 13   | machines-vs-free-weights              | 75%        | 100%          | 🔴 -25% |
| 14   | bands-chains-hypertrophy              | 80%        | 80%           | ⚪ +0%  |
| 15   | isometric-training                    | 100%       | 67%           | 🟢 +33% |
| 16   | youth-resistance-training             | 100%       | 100%          | ⚪ +0%  |
| 17   | minimalist-warmup                     | 100%       | 80%           | 🟢 +20% |
| 18   | bench-prime-mover                     | 40%        | 60%           | 🔴 -20% |
| 19   | strength-during-weight-loss           | 20%        | 20%           | ⚪ +0%  |

## Notes

- Eval 19 (strength during weight loss) failed almost all assertions for both configs - question asks for personal experience the SBS hosts shared, which neither config could reproduce.
- Eval 3 (low incline vs flat) had low pass rates for both configs - both incorrectly characterized incline as having SHORTER ROM when SBS hosts argued the opposite.
- Eval 13: with_skill incorrectly claimed free weights are 'superior' while expected answer and without_skill correctly stated 'neither universally superior.'
- Eval 18 (bench prime mover): with_skill INCORRECTLY described pecs as biarticular; without_skill correctly identified triceps as biarticular.
- Overall with_skill pass rate: 79.0% vs without_skill: 78.3% (delta: +0.7%)
- Skill provided strongest lift on: eval 5 (isolation volume, 100% vs 80%), eval 15 (isometrics, 100% vs 67%), eval 17 (warmup, 100% vs 80%)
- Skill performed worse on: eval 13 (machines/free weights, 75% vs 100%), eval 18 (bench prime mover, 40% vs 60%)
