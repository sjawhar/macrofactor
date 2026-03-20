#!/usr/bin/env python3
"""Generate eval_metadata.json for all 19 sbs-deadlift evals."""

import json, os

BASE = "/home/sami/Code/macrofactor/docs/sbs-evals/sbs-deadlift/iteration-1"

evals = [
    {
        "id": 1,
        "dir": "eval-1-fitness-testing-battery",
        "name": "fitness-testing-battery",
        "prompt": "The same listener asked for a hypothetical 'SBS combine': what tests should a generally strong/fit/athletic person repeat every ~12 weeks to track progress?",
        "assertions": [
            "Mentions aerobic capacity testing (e.g., 2-mile run, 5K, or similar endurance event)",
            "Mentions anaerobic or sprint testing (e.g., 400m, 800m, 40m dash, or 100m)",
            "Mentions explosive power testing (e.g., vertical jump, broad jump, or medicine ball throws)",
            "Mentions strength testing (e.g., squat/bench/deadlift max or rep max)",
            "Acknowledges this full battery may be better suited to longer intervals (e.g., annual) rather than every 12 weeks",
        ],
    },
    {
        "id": 2,
        "dir": "eval-2-deadlift-on-sloped-platform",
        "name": "deadlift-on-sloped-platform",
        "prompt": "A listener asked whether deadlifting on a garage platform with about a 5% incline could meaningfully hurt performance compared to deadlifting on a flat gym floor.",
        "assertions": [
            "Acknowledges the incline could genuinely affect performance (not just 'in your head')",
            "Mentions confounding variables like plate calibration differences or temperature effects",
            "Explains how the slope changes mechanics depending on bar/lifter orientation relative to slope (e.g., effective heel elevation, deficit-like effect, or block-pull-like effect)",
            "Suggests testing or experimenting with orientation/setup to isolate the variable",
        ],
    },
    {
        "id": 3,
        "dir": "eval-3-bracing-and-vascular-risk",
        "name": "bracing-and-vascular-risk",
        "prompt": "Is there evidence that long-term bracing/Val Salva in lifting damages blood vessels because of repeated blood pressure spikes?",
        "assertions": [
            "Distinguishes between acute risk in people with pre-existing vascular conditions vs. long-term causation in healthy lifters",
            "States that direct long-term causal evidence specifically linking normal lifting bracing to vascular damage is sparse or limited",
            "Mentions occupational lifting epidemiology but notes it differs substantially from strength training",
            "Recommends individualized caution for those with known medical risk rather than broad fear-based avoidance",
        ],
    },
    {
        "id": 4,
        "dir": "eval-4-isolation-volume",
        "name": "isolation-volume",
        "prompt": "After compounds, how much isolation work is enough for areas like forearms, calves, delts, biceps, and core without overdoing it?",
        "assertions": [
            "States there is no universal cap — optimal volume depends on goals, recovery, and time",
            "Provides a practical baseline range (approximately 2-4 sets per muscle group, 1-2x/week or similar concrete guidance)",
            "Notes that global/systemic recovery can become limiting even when local muscle stress seems modest",
            "Recommends starting conservative and scaling up based on outcomes/adaptation",
        ],
    },
    {
        "id": 5,
        "dir": "eval-5-progressive-overload-body-weight",
        "name": "progressive-overload-body-weight",
        "prompt": "I have deadlifted with a trainer for years and often test very heavy/1RM work. My body weight tends to stay close to my deadlift max, and I developed binge-eating/body-image struggles. Could weekly near-max lifting be defending my body weight and making intentional weight loss much harder?",
        "assertions": [
            "Clarifies that heavy lifting itself is unlikely to directly prevent fat loss — energy balance is the main driver",
            "Notes that switching from volume work to frequent 1RM attempts doesn't substantially change calorie expenditure",
            "Suggests or implies the coaching setup may be suboptimal (years of training with limited progress)",
            "Mentions bodyweight performance targets (push-ups, pull-ups, dips) as a motivational strategy during weight loss",
            "Recommends professional clinical support (dietitian or similar) for binge-eating concerns rather than just programming changes",
        ],
    },
    {
        "id": 6,
        "dir": "eval-6-teen-training-nutrition",
        "name": "teen-training-nutrition",
        "prompt": "What should a 15-year-old do to gain muscle and strength: exercise selection, weekly volume, reps/intensity/failure, and calories/macros?",
        "assertions": [
            "Recommends building around major compound movement patterns (squat, press, hinge, row or similar)",
            "Provides a starting volume recommendation (roughly 8-12 sets per muscle per week or similar concrete range)",
            "Addresses proximity to failure with specific guidance (e.g., 0-2 RIR, most sets near but not at failure)",
            "Provides protein guidance (approximately 1.5-2.0 g/kg/day or equivalent range)",
            "Mentions that beginners benefit from bodyweight/calisthenic practice for movement quality before heavy loading",
        ],
    },
    {
        "id": 7,
        "dir": "eval-7-hypertrophy-vs-strength-periodization",
        "name": "hypertrophy-vs-strength-periodization",
        "prompt": "In a good powerlifting program, how much training time should be hypertrophy-focused, and how should that change with training age and in-season vs off-season? Also, when is someone strong enough to start bodybuilding-style accessory work?",
        "assertions": [
            "States newer/less advanced lifters generally need more hypertrophy work, not less",
            "Describes a progression: learn lifts first, then build muscle phase, then shift toward more specific strength work as advancement increases",
            "Notes that high-rep bodybuilding-style work should be reduced close to competition (roughly last ~4 weeks)",
            "Mentions adherence/enjoyment as an important factor — a slightly suboptimal but sustainable approach still works well",
        ],
    },
    {
        "id": 8,
        "dir": "eval-8-rest-intervals",
        "name": "rest-intervals",
        "prompt": "As my lifts get stronger, my rest periods keep getting longer. What causes that, and what does the literature say about rest intervals for hypertrophy vs strength?",
        "assertions": [
            "Explains that heavier loads increase metabolic/oxygen cost per set, requiring longer recovery — this is a normal progression",
            "Notes research on rest intervals for hypertrophy is mixed (some favor longer, some shorter, some no difference)",
            "For strength, leans toward longer rest periods, especially for strong lifters on compound lifts",
            "Provides concrete rest period ranges (e.g., ~90s-2min for isolation/upper, ~3min common, ~5min+ for heavy compounds)",
            "Suggests non-interfering supersets as a time-saving strategy",
        ],
    },
    {
        "id": 9,
        "dir": "eval-9-deadlift-necessity-bodybuilding",
        "name": "deadlift-necessity-bodybuilding",
        "prompt": "From a bodybuilding standpoint, can I completely remove deadlifts and all deadlift variations? Can other posterior-chain exercises fully replace them?",
        "assertions": [
            "Gives a clear affirmative — deadlifts can be fully removed for bodybuilding purposes",
            "Lists specific alternative exercises covering the same muscle groups (e.g., hamstring curls, hip thrusts, rows, pull-ups, shrugs)",
            "Acknowledges deadlifts are time-efficient for loading multiple posterior muscles simultaneously",
            "Notes replacement is especially viable when lifters have injuries, poor tolerance, or strong preference against deadlifts",
        ],
    },
    {
        "id": 10,
        "dir": "eval-10-post-meet-hypertrophy",
        "name": "post-meet-hypertrophy",
        "prompt": "Any advice on easing into a high-volume hypertrophy-focused mesocycle after a powerlifting meet without losing my strength gains?",
        "assertions": [
            "Recommends keeping competition lifts in moderate strength-relevant rep ranges rather than going entirely high-rep",
            "Suggests a specific structure (e.g., mostly 5-10 rep range with periodic heavier work like triples)",
            "Mentions an over-warm or heavy single strategy (e.g., RPE 8 single) before volume work to maintain neural readiness",
            "Core message: maintain some heavy practice while accumulating hypertrophy volume",
        ],
    },
    {
        "id": 11,
        "dir": "eval-11-post-competition-transition",
        "name": "post-competition-transition",
        "prompt": "What do you personally do right after a meet—jump into the next block immediately or take time off?",
        "assertions": [
            "Frames the answer as context-dependent based on athlete motivation and recovery state",
            "If beat up, suggests an easier first week with reduced loading (roughly 70-80% range) and reduced volume",
            "Notes that complete time off is acceptable and one week off per year is trivial in the long run",
            "General preference: keep intensity present while temporarily reducing volume",
        ],
    },
    {
        "id": 12,
        "dir": "eval-12-program-troubleshooting",
        "name": "program-troubleshooting",
        "prompt": "How should I tweak a program that mostly works before deciding to switch programs entirely?",
        "assertions": [
            "Advises against changing things while progress is still occurring",
            "When plateau appears, recommends deciding whether the lift needs more stress or less stress",
            "Recommends small, targeted changes (volume, intensity, frequency, or exercise selection) evaluated individually over weeks",
            "Only switch programs entirely after serial targeted tweaks have failed",
        ],
    },
    {
        "id": 13,
        "dir": "eval-13-accommodating-resistance",
        "name": "accommodating-resistance",
        "prompt": "What do you think about bands and chains for building absolute strength? The logic sounds good—do they actually work?",
        "assertions": [
            "Explains the theoretical rationale: accommodating resistance matches the lift's force curve (lighter at bottom, heavier at lockout)",
            "Cites research evidence (including meta-analytic or review-level) showing little to no clear strength advantage over conventional loading",
            "Concludes they are fine as variation tools but not reliably superior for maximal strength",
        ],
    },
    {
        "id": 14,
        "dir": "eval-14-isometric-strength-training",
        "name": "isometric-strength-training",
        "prompt": "What's the current take on isometric training for maintaining strength on squat, bench, and deadlift when equipment is limited?",
        "assertions": [
            "States isometrics can work but the most effective style is high-intent ballistic maximal contractions (max force as fast as possible)",
            "Mentions strong angle specificity: gains transfer mostly to the trained joint angle, roughly 15-30 degrees in either direction",
            "Provides a practical example (e.g., pulling into safety pins at a chosen deadlift height)",
            "Notes that programming prescriptions (duration, frequency, weekly dose) are less standardized than conventional training",
        ],
    },
    {
        "id": 15,
        "dir": "eval-15-youth-resistance-training",
        "name": "youth-resistance-training",
        "prompt": "How should kids and adolescents train with weights? Is there a growth-plate risk, and should heavy singles be avoided?",
        "assertions": [
            "States current evidence does not show that lifting stunts growth",
            "Notes that typical training loads are likely less concerning for growth plates than everyday running/jumping impact forces",
            "Emphasizes close supervision, strict technique, and minimizing preventable injuries",
            "Recommends movement skill development before/during early puberty rather than chasing failure or maximal loads",
            "Notes training stress can be scaled up as puberty progresses",
        ],
    },
    {
        "id": 16,
        "dir": "eval-16-powerlifting-belt-evidence",
        "name": "powerlifting-belt-evidence",
        "prompt": "It's been years since the Belt Bible. Has the powerlifting belt evidence changed enough to require a rewrite?",
        "assertions": [
            "States core belt conclusions are largely unchanged and a full rewrite is not urgently needed",
            "Mentions at least one mechanism: higher intra-abdominal pressure can increase hip extension torque",
            "Concludes belts still make sense for many lifters and old guidance is mostly intact",
        ],
    },
    {
        "id": 17,
        "dir": "eval-17-teen-strength-expectations",
        "name": "teen-strength-expectations",
        "prompt": "I'm 16-19 and couldn't reach a 405 deadlift on linear progression. Does being younger hurt strength progress?",
        "assertions": [
            "Notes that by late teens, most lifters should be capable of solid strength gains (age is not the main limiter)",
            "Emphasizes huge individual variability in where linear progression stalls",
            "States a specific benchmark (like 405) is not a reliable readiness cutoff",
            "Recommends using progression timescale (weekly, monthly, etc.) rather than absolute load to classify training stage",
        ],
    },
    {
        "id": 18,
        "dir": "eval-18-deadlift-vs-squat-fatigue",
        "name": "deadlift-vs-squat-fatigue",
        "prompt": "Why are deadlifts considered more fatiguing than squats, and should deadlift volume usually be lower?",
        "assertions": [
            "Pushes back on the blanket claim that deadlifts are inherently more fatiguing, citing data showing similar fatigue outcomes",
            "Mentions practical contributors: hand/forearm grip stress, sumo vs conventional tolerance differences, and/or spinal flexion tolerance",
            "Highlights path dependency: lifters with more squat exposure may find deadlifts seem more fatiguing due to lower deadlift training history",
            "Recommends programming based on individual recovery patterns rather than assuming universal deadlift fragility",
        ],
    },
    {
        "id": 19,
        "dir": "eval-19-minimalist-warmup",
        "name": "minimalist-warmup",
        "prompt": "What do you think about minimalist warm-ups (mostly just barbell warm-up sets) instead of long activation/mobility routines?",
        "assertions": [
            "Answer is conditional: minimalist warm-ups are fine IF they reliably prepare you for the session",
            "Frames as cost-benefit, especially for time-limited lifters (cutting 30min to 5-10min adds productive training time)",
            "Warns against making minimalism the goal itself — under-warming can reduce readiness or increase risk",
            "Recommends iterative troubleshooting: remove elements one at a time, keep only what clearly helps session quality",
        ],
    },
]

for e in evals:
    path = os.path.join(BASE, e["dir"], "eval_metadata.json")
    data = {
        "eval_id": e["id"],
        "eval_name": e["name"],
        "prompt": e["prompt"],
        "assertions": e["assertions"],
    }
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Wrote {path}")

print(f"\nDone: {len(evals)} eval_metadata.json files written")
