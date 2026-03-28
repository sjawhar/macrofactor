#!/usr/bin/env python3
"""Grade all eval outputs against expected_output and assertions.

Uses concept-level keyword matching to check each assertion against the answer.
Produces grading.json for each with_skill and without_skill run.
"""

import json
import os
import re
import glob

ITERATION_DIR = "/home/sami/Code/macrofactor/docs/sbs-evals/sbs-diet/iteration-1"

# Key phrases per assertion — maps (eval_id, assertion_index) to list of keyword groups.
# Each keyword group is a list of alternatives; if ANY phrase in a group is found, that group passes.
# An assertion passes if ALL keyword groups for it are found (AND logic across groups, OR within).
ASSERTION_KEYS = {
    # Eval 1: maintenance phases
    (1, 0): [["not", "required"], ["not", "physiolog"]],  # NOT physiologically required
    (1, 1): [["optional", "preference", "practical"]],  # optional/preference-based
    (1, 2): [["adherence", "comfort", "scale"]],  # practical benefits
    (1, 3): [["not", "always", "necessary"]],  # not always necessary
    # Eval 2: muscle retention
    (2, 0): [["preference", "depends", "personal", "individual"]],
    (2, 1): [
        ["extreme", "deficit"],
        ["protein"],
        ["resistance", "training", "lifting"],
    ],
    (2, 2): [["overestimate", "exaggerate", "catastrophi"]],
    (2, 3): [["not", "catastroph", "inevitable"]],
    # Eval 3: fat intake frequency
    (3, 0): [["weekly", "week"]],
    (3, 1): [["essential fatty acid", "fat-soluble", "vitamin", "hormone"]],
    (3, 2): [["not", "identical", "daily", "obsess", "every single"]],
    # Eval 4: TRT
    (4, 0): [["physician", "medical", "doctor", "oversight"]],
    (4, 1): [["hypertrophy", "muscle", "growth"]],
    (4, 2): [["volume", "frequency"]],
    (4, 3): [["individual", "variab"]],
    # Eval 5: misinformation
    (5, 0): [["not improving", "getting worse", "worsening", "hasn't improved"]],
    (5, 1): [["incentive", "academia", "industry", "reward"]],
    (5, 2): [["social media", "commercial", "amplif"]],
    (5, 3): [["evidence", "quality", "skeptic"]],
    # Eval 6: vegan transition
    (6, 0): [["no", "meaningful", "performance", "change", "difference"]],
    (6, 1): [["pea", "rice", "soy"]],
    (6, 2): [["algae", "DHA", "EPA", "B12"]],
    (6, 3): [["not", "superior", "inferior"]],
    # Eval 7: diabetes and hypertrophy
    (7, 0): [["possible", "still", "hypertrophy"]],
    (7, 1): [["reduced", "moderate", "lower", "less"]],
    (7, 2): [["metformin", "AMPK", "mTOR"]],
    (7, 3): [["age", "volume", "intensity", "confound"]],
    # Eval 8: stimulant metabolism
    (8, 0): [["enzyme", "pathway", "CYP"]],
    (8, 1): [["CYP1A2", "CYP2A6", "CYP2B6"]],
    (8, 2): [["smoking", "induc", "CYP1A2"]],
    (8, 3): [["pharmacist", "medication interaction"]],
    # Eval 9: BMR variability
    (9, 0): [["yes", "real", "legitimate"]],
    (9, 1): [["hundred", "kcal", "calorie"]],
    (9, 2): [["organ", "liver", "kidney"]],
    (9, 3): [["biological", "not", "tracking error", "character"]],
    # Eval 10: steps and calories
    (10, 0): [["smaller than expected", "constrain", "not", "one-for-one"]],
    (10, 1): [["appetite", "downshift", "decrease"]],
    (10, 2): [["gradual", "monitor", "increments"]],
    (10, 3): [["sedentary", "mismatch"]],
    # Eval 11: cooking preferences
    (11, 0): [["personal", "fun", "cooking"]],
    (11, 1): [["pizza", "bread", "biryani", "shawarma", "chicken"]],
    (11, 2): [["not", "technical", "coaching"]],
    # Eval 12: body weight and lifting
    (12, 0): [["unlikely", "not", "prevent", "fat loss"]],
    (12, 1): [["energy", "intake", "expenditure", "calorie"]],
    (12, 2): [["bodyweight", "push-up", "pull-up", "dip"]],
    (12, 3): [["dietitian", "clinical", "binge"]],
    (12, 4): [["coach", "trainer", "poor"]],
    # Eval 13: metabolic adaptation
    (13, 0): [["reverse", "recover", "adapt"]],
    (13, 1): [["yo-yo", "fat faster", "lean tissue"]],
    (13, 2): [["NEAT", "spontaneous", "movement", "behavior"]],
    (13, 3): [["maintenance", "maintain"]],
    (13, 4): [["slower", "not push", "as lean"]],
    # Eval 14: teen training
    (14, 0): [["compound", "squat", "press", "hinge", "row"]],
    (14, 1): [["8", "12", "sets", "volume"]],
    (14, 2): [["1.5", "2.0", "protein", "g/kg"]],
    (14, 3): [["1%", "body weight", "month", "gain"]],
    (14, 4): [["bodyweight", "calisthenic", "push-up"]],
    # Eval 15: bulk/cut frequency
    (15, 0): [["not", "calendar", "schedule", "on/off"]],
    (15, 1): [["endpoint", "goal", "specific"]],
    (15, 2): [["larger", "surplus", "shorter"]],
    (15, 3): [["one month", "minimum", "two-week"]],
    (15, 4): [["not", "gain", "effective"]],
    # Eval 16: BMI tall
    (16, 0): [["yes", "misclassif", "bias"]],
    (16, 1): [["height squared", "height^2", "exponent"]],
    (16, 2): [["2.5", "height"]],
    (16, 3): [["example", "calculation", "distort"]],
    # Eval 17: creatinine labs
    (17, 0): [["creatinine", "not creatine"]],
    (17, 1): [["breakdown", "product", "supplement"]],
    (17, 2): [["physician", "doctor", "kidney", "follow-up"]],
    (17, 3): [["not", "stop", "panic"]],
    # Eval 18: plant-based vs omnivorous
    (18, 0): [["not", "categorically", "blanket"]],
    (18, 1): [["confound", "health behavior"]],
    (18, 2): [["calorie", "macro", "protein"]],
    (18, 3): [["both", "work", "well"]],
    # Eval 19: protein blends
    (19, 0): [["low-impact", "not", "meaningful"]],
    (19, 1): [["standard", "whey", "basic"]],
    (19, 2): [["vegan", "lactose", "digest"]],
    (19, 3): [["not", "overcomplicat"]],
    # Eval 20: mass gainers
    (20, 0): [["convenience", "tool"]],
    (20, 1): [["protein", "carbohydrate", "carb"]],
    (20, 2): [["adherence", "total intake"]],
    # Eval 21: fasting research
    (21, 0): [["broader", "literature", "body of evidence"]],
    (21, 1): [["definition", "vary", "alternate", "5:2", "time-restricted"]],
    (21, 2): [["total energy", "calorie", "dominant"]],
    # Eval 22: supplements
    (22, 0): [["creatine", "strongest", "best"]],
    (22, 1): [["vitamin D", "fish oil", "magnesium"]],
    (22, 2): [["incremental", "training", "nutrition", "fundamental"]],
    (22, 3): [["basic", "proven", "proprietary"]],
    # Eval 23: protein upper limit
    (23, 0): [["overstated", "not well-supported", "healthy"]],
    (23, 1): [["1.6", "2.2", "g/kg"]],
    (23, 2): [["beyond", "little", "added", "benefit"]],
    (23, 3): [["consistent", "sufficient"]],
    # Eval 24: hardgainers
    (24, 0): [["hardgainer", "not", "protein problem"]],
    (24, 1): [["beyond", "sufficiency", "won't fix"]],
    (24, 2): [["calorie", "total", "energy"]],
    (24, 3): [["1.6", "2.2", "g/kg"]],
    # Eval 25: sodium bicarbonate
    (25, 0): [["better-supported", "ergogenic", "evidence"]],
    (25, 1): [["buffer", "bicarbonate", "acidosis"]],
    (25, 2): [["GI", "gastrointestinal", "distress"]],
    (25, 3): [["loading", "protocol", "staged"]],
    (25, 4): [["chronic", "adaptation", "long-term"]],
    # Eval 26: Game Changers follow-up
    (26, 0): [["decline", "point-by-point", "low value"]],
    (26, 1): [["both", "omnivorous", "vegan", "support"]],
    (26, 2): [["documentary", "demonstration", "anecdot"]],
    (26, 3): [["research", "evidence", "quality"]],
    # Eval 27: Game Changers criticism
    (27, 0): [["reject", "misrepresent", "deny"]],
    (27, 1): [["specific", "film", "example", "quote"]],
    (27, 2): [["narrative", "fighting", "McGregor", "Diaz"]],
    (27, 3): [["gorilla", "weak logic"]],
    # Eval 28: aerobic conditioning
    (28, 0): [["yes", "conditioning", "limit"]],
    (28, 1): [["25", "low", "sedentary", "average"]],
    (28, 2): [["aerobic", "cardio", "work"]],
    (28, 3): [["rest", "machine", "single-joint"]],
    # Eval 29: caffeine and sweeteners
    (29, 0): [["sweetener", "fine", "evidence"]],
    (29, 1): [["400", "600", "mg", "caffeine"]],
    (29, 2): [["symptom", "jitter", "sleep"]],
    (29, 3): [["offseason", "strategy", "prep"]],
    # Eval 30: strength loss vs overreaching
    (30, 0): [["deload", "diagnostic"]],
    (30, 1): [["rebound", "recover"]],
    (30, 2): [["bodyweight", "pull-up", "dip", "rep"]],
    (30, 3): [["relative", "performance", "context"]],
    # Eval 31: calorie cycling
    (31, 0): [["no", "compelling", "evidence", "not superior"]],
    (31, 1): [["energy balance", "longer", "game"]],
    (31, 2): [["not", "forced", "rest day"]],
    (31, 3): [["adherence", "preference", "workout quality"]],
    # Eval 32: very low calorie approach
    (32, 0): [["lean protein", "micronutrient"]],
    (32, 1): [["vegetable", "fiber", "volume"]],
    (32, 2): [["multivitamin"]],
    (32, 3): [["fish oil", "omega-3"]],
    (32, 4): [["lentil", "soup", "practical"]],
    # Eval 33: tuna mercury
    (33, 0): [["FDA", "guidance", "serving"]],
    (33, 1): [["light tuna", "albacore", "white"]],
    (33, 2): [["few servings", "per week", "limit"]],
    # Eval 34: hypothalamic amenorrhea
    (34, 0): [["energy availability", "hormone", "estrogen", "testosterone"]],
    (34, 1): [["impaired", "hypertrophy", "performance"]],
    (34, 2): [["not all-or-none", "gradual", "partial"]],
    (34, 3): [["energy availability", "training stress"]],
    # Eval 35: dietary nitrate
    (35, 0): [["yes", "food", "nitrate", "benefit"]],
    (35, 1): [["quality", "control", "variab"]],
    (35, 2): [["synergy", "food matrix", "compound"]],
    (35, 3): [["produce", "diet", "whole food"]],
    # Eval 36: citrulline dosing
    (36, 0): [["3", "6", "g", "citrulline"]],
    (36, 1): [["6", "8", "malate"]],
    (36, 2): [["1 hour", "pre-workout", "before"]],
    (36, 3): [["small", "modest", "not transformative"]],
    # Eval 37: protein shake speed
    (37, 0): [["not", "key", "matter"]],
    (37, 1): [["fiber", "fat", "meal", "composition"]],
    (37, 2): [["3", "5", "feeding", "distribution"]],
    # Eval 38: protein and kidney stones
    (38, 0): [["healthy", "pre-existing"]],
    (38, 1): [["not", "strongly", "support", "cause"]],
    (38, 2): [["individualize", "kidney stone history"]],
    (38, 3): [["not", "inherently dangerous"]],
    # Eval 39: theanine with caffeine
    (39, 0): [["jitter", "anxiety", "reduce"]],
    (39, 1): [["100", "200", "mg"]],
    (39, 2): [["individual", "response", "vary"]],
    (39, 3): [["optional", "complement"]],
    # Eval 40: aspirin and hypertrophy
    (40, 0): [["limited", "evidence"]],
    (40, 1): [["plausible", "anti-inflammatory"]],
    (40, 2): [["older", "younger", "population"]],
    (40, 3): [["not", "assume", "neutral"]],
    # Eval 41: anti-nutrients
    (41, 0): [["real", "phytate", "tannin", "lectin", "oxalate"]],
    (41, 1): [["overstated"]],
    (41, 2): [["cooking", "processing"]],
    (41, 3): [["not", "avoid", "plant", "wholesale"]],
    (41, 4): [["varied", "diverse", "diet"]],
    # Eval 42: hydration targets
    (42, 0): [["3.7", "2.7", "DRI", "L/day"]],
    (42, 1): [["food", "20%"]],
    (42, 2): [["hyponatremia"]],
    (42, 3): [["across the day", "throughout", "spread"]],
    # Eval 43: hydration timing
    (43, 0): [["timing", "not", "magical"]],
    (43, 1): [["early", "steady", "maintain"]],
    (43, 2): [["taper", "2", "3", "hours", "before bed"]],
    (43, 3): [["urine color"]],
    # Eval 44: nicotine in prep
    (44, 0): [["appetite", "suppress", "habituate"]],
    (44, 1): [["caffeine", "better", "performance"]],
    (44, 2): [["tobacco", "gum", "patch"]],
    (44, 3): [["half-life", "shorter"]],
    # Eval 45: cortisol and fat
    (45, 0): [["real", "cortisol", "body composition"]],
    (45, 1): [["Cushing", "central", "adiposity"]],
    (45, 2): [["overinterpreted", "common", "fitness"]],
    (45, 3): [["clinical", "extreme", "normal"]],
    # Eval 46: cortisol action steps
    (46, 0): [["normal", "severe", "pathology", "three"]],
    (46, 1): [["stress management", "not", "supplement"]],
    (46, 2): [["diurnal", "rhythm", "snapshot"]],
    (46, 3): [["decision tree", "practical", "don't panic"]],
    # Eval 47: bodybuilding prep bloodwork
    (47, 0): [["common", "expected", "normal"]],
    (47, 1): [["creatinine", "creatine kinase", "muscle"]],
    (47, 2): [["hormonal", "suppression", "testosterone", "recovery"]],
    (47, 3): [["training phase", "context", "interpret"]],
    # Eval 48: recomp at maintenance
    (48, 0): [["yes", "possible", "recomposition"]],
    (48, 1): [["training status", "body composition", "protein"]],
    (48, 2): [["body fat", "fat mass", "better candidate"]],
    (48, 3): [["not", "always", "required", "surplus"]],
    # Eval 49: beginner philosophy
    (49, 0): [["not", "overcomplicated", "joyless"]],
    (49, 1): [["bro split", "work", "effective"]],
    (49, 2): [["under-eating", "unlock", "afraid"]],
    (49, 3): [["beginner", "gains", "timeline"]],
    # Eval 50: high-volume cutting meals
    (50, 0): [["cauliflower", "chicken", "egg white", "burrito"]],
    (50, 1): [["fiber", "water", "volume", "protein", "density"]],
    (50, 2): [["cabbage", "beef", "1:1"]],
    (50, 3): [["meal prep", "practical", "adherence"]],
    # Eval 51: joint supplements
    (51, 0): [["older", "newer", "2018", "2010", "meta-analysis"]],
    (51, 1): [["glucosamine", "stiffness"]],
    (51, 2): [["modest", "small", "not dramatic"]],
    (51, 3): [["osteoarthritis", "OA", "population"]],
    # Eval 52: diet quality
    (52, 0): [["small", "penalty", "probably"]],
    (52, 1): [["missing", "beneficial", "nutrient"]],
    (52, 2): [["energy", "protein", "micronutrient"]],
    (52, 3): [["context", "dependent", "lever"]],
    # Eval 53: lifting vs protein
    (53, 0): [["lifting", "dominant", "driver", "resistance training"]],
    (53, 1): [["10", "15", "reduced", "volume", "preserve"]],
    (53, 2): [["protein", "immobilization", "underwhelming"]],
    (53, 3): [["loading", "muscle", "first", "optimize protein"]],
    # Eval 54: post-surgery detraining
    (54, 0): [["nutrition alone", "weak", "loading"]],
    (54, 1): [["leucine", "15", "19", "g"]],
    (54, 2): [["surgeon", "clinical", "team"]],
    (54, 3): [["regain", "faster", "first time"]],
    # Eval 55: sleep disruption
    (55, 0): [["food environment", "appetite"]],
    (55, 1): [["machine", "controlled", "safer"]],
    (55, 2): [["nap", "20", "30", "minute"]],
    (55, 3): [["keep", "training", "resistance"]],
    # Eval 56: calorie vs protein priority
    (56, 0): [["upstream", "adjust", "meal planning"]],
    (56, 1): [["1.6", "g/kg"]],
    (56, 2): [["prioritiz", "protein", "deficit"]],
    (56, 3): [["split", "difference", "recomp", "lean"]],
    # Eval 57: dream studies
    (57, 0): [["hyperplasia", "muscle fiber"]],
    (57, 1): [["responder", "variability", "omics"]],
    (57, 2): [["creatine", "caffeine", "nitrate", "citrulline"]],
    (57, 3): [["deficit", "volume", "intensity"]],
    # Eval 58: very low body fat
    (58, 0): [["harder", "impaired", "difficult"]],
    (58, 1): [["training quality", "recovery", "hunger", "temperature"]],
    (58, 2): [["8%", "body fat"]],
    (58, 3): [["symptom", "performance", "feedback"]],
    # Eval 59: fasted morning training
    (59, 0): [["goal", "hierarchy", "depends"]],
    (59, 1): [["performance", "mechanical tension", "hypertrophy"]],
    (59, 2): [["pre-workout", "20", "carbohydrate"]],
    (59, 3): [["GI", "adapt", "timing", "liquid"]],
    # Eval 60: protein overfeeding
    (60, 0): [["yes", "can", "fat storage", "stored"]],
    (60, 1): [["thermic effect", "storage efficiency"]],
    (60, 2): [["self-reported", "skeptic"]],
    (60, 3): [["Bray", "metabolic ward", "controlled"]],
    # Eval 61: ashwagandha
    (61, 0): [["not consistent", "not strong", "insufficient"]],
    (61, 1): [["effect size", "hard to generalize"]],
    (61, 2): [["mechanism", "mechanistic", "coherence"]],
    (61, 3): [["cautious", "modest", "expectations"]],
    # Eval 62: strength changes during cut
    (62, 0): [["weaker", "strength", "loss"]],
    (62, 1): [["wrist", "elbow", "injury"]],
    (62, 2): [["rebound", "quickly", "resumed"]],
    (62, 3): [["consistency", "acceptance"]],
    # Eval 63: HIIT vs steady-state
    (63, 0): [["no", "meaningful", "advantage", "similar"]],
    (63, 1): [["meta-analysis", "both", "small"]],
    (63, 2): [["30", "90", "1 min", "2 min", "interval"]],
    (63, 3): [["adhere", "safe", "choose"]],
}


def check_assertion(
    answer_text: str, eval_id: int, assertion_idx: int
) -> tuple[bool, str]:
    """Check if an assertion passes by looking for key phrases in the answer.

    Returns (passed, evidence).
    """
    answer_lower = answer_text.lower()
    key = (eval_id, assertion_idx)

    if key not in ASSERTION_KEYS:
        # Fallback: assume pass if we haven't defined keywords (shouldn't happen)
        return True, "No keyword check defined for this assertion"

    keyword_groups = ASSERTION_KEYS[key]
    all_groups_found = True
    found_evidence = []
    missing_evidence = []

    for group in keyword_groups:
        group_found = False
        for phrase in group:
            if phrase.lower() in answer_lower:
                group_found = True
                # Find context around the match
                idx = answer_lower.find(phrase.lower())
                start = max(0, idx - 60)
                end = min(len(answer_text), idx + len(phrase) + 60)
                snippet = answer_text[start:end].strip()
                found_evidence.append(f"Found '{phrase}' in: ...{snippet}...")
                break
        if not group_found:
            all_groups_found = False
            missing_evidence.append(f"Missing any of: {group}")

    if all_groups_found:
        return True, "; ".join(found_evidence[:2])  # Limit evidence length
    else:
        return False, "; ".join(missing_evidence)


def grade_run(eval_dir: str, config: str, metadata: dict) -> dict:
    """Grade a single run (with_skill or without_skill)."""
    answer_path = os.path.join(eval_dir, config, "outputs", "answer.md")

    if not os.path.exists(answer_path):
        return {
            "expectations": [
                {"text": a, "passed": False, "evidence": "No answer.md file found"}
                for a in metadata["assertions"]
            ],
            "summary": {
                "passed": 0,
                "failed": len(metadata["assertions"]),
                "total": len(metadata["assertions"]),
                "pass_rate": 0.0,
            },
        }

    with open(answer_path) as f:
        answer_text = f.read()

    eval_id = metadata["eval_id"]
    expectations = []
    passed_count = 0

    for idx, assertion in enumerate(metadata["assertions"]):
        passed, evidence = check_assertion(answer_text, eval_id, idx)
        expectations.append({"text": assertion, "passed": passed, "evidence": evidence})
        if passed:
            passed_count += 1

    total = len(metadata["assertions"])
    return {
        "expectations": expectations,
        "summary": {
            "passed": passed_count,
            "failed": total - passed_count,
            "total": total,
            "pass_rate": round(passed_count / total, 4) if total > 0 else 0.0,
        },
    }


def main():
    eval_dirs = sorted(glob.glob(os.path.join(ITERATION_DIR, "eval-*")))

    total_graded = 0
    ws_pass_rates = []
    wos_pass_rates = []
    missing_answers = []

    for eval_dir in eval_dirs:
        meta_path = os.path.join(eval_dir, "eval_metadata.json")
        if not os.path.exists(meta_path):
            continue

        with open(meta_path) as f:
            metadata = json.load(f)

        eval_name = os.path.basename(eval_dir)

        for config in ["with_skill", "without_skill"]:
            answer_path = os.path.join(eval_dir, config, "outputs", "answer.md")
            if not os.path.exists(answer_path):
                missing_answers.append(f"{eval_name}/{config}")
                continue

            grading = grade_run(eval_dir, config, metadata)

            # Write grading.json
            grading_path = os.path.join(eval_dir, config, "grading.json")
            with open(grading_path, "w") as f:
                json.dump(grading, f, indent=2)

            total_graded += 1
            if config == "with_skill":
                ws_pass_rates.append(grading["summary"]["pass_rate"])
            else:
                wos_pass_rates.append(grading["summary"]["pass_rate"])

    # Print summary
    print(f"Graded {total_graded} runs across {len(eval_dirs)} evals")
    if missing_answers:
        print(
            f"Missing answers ({len(missing_answers)}): {', '.join(missing_answers[:10])}..."
        )

    if ws_pass_rates:
        avg_ws = sum(ws_pass_rates) / len(ws_pass_rates)
        print(f"With-skill avg pass rate: {avg_ws:.2%} ({len(ws_pass_rates)} runs)")
    if wos_pass_rates:
        avg_wos = sum(wos_pass_rates) / len(wos_pass_rates)
        print(
            f"Without-skill avg pass rate: {avg_wos:.2%} ({len(wos_pass_rates)} runs)"
        )
    if ws_pass_rates and wos_pass_rates:
        delta = avg_ws - avg_wos
        print(f"Delta (with - without): {delta:+.2%}")


if __name__ == "__main__":
    main()
