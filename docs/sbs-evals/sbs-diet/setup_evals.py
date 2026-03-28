#!/usr/bin/env python3
"""Create workspace directory structure + eval_metadata.json for all 63 sbs-diet evals."""

import json
import os
import re

WORKSPACE = "/home/sami/Code/macrofactor/docs/sbs-evals/sbs-diet"
EVALS_PATH = "/home/sami/Code/macrofactor/.opencode/skills/sbs-diet/evals.json"

# Assertions per eval — tailored to the SBS hosts' actual answers
ASSERTIONS = {
    1: [
        "Answer states maintenance phases are NOT physiologically required between bulk and cut",
        "Answer frames maintenance as optional/preference-based rather than biologically mandatory",
        "Answer acknowledges practical benefits of maintenance (adherence, comfort, scale stability)",
        "Answer does NOT claim maintenance is always necessary or always recommended",
    ],
    2: [
        "Answer frames muscle retention priority as preference-dependent, not a universal rule",
        "Answer recommends basics: avoid extreme deficits, keep protein reasonable, continue resistance training",
        "Answer mentions that lifters often overestimate muscle loss during cuts",
        "Answer does NOT present muscle loss during cutting as catastrophic or inevitable",
    ],
    3: [
        "Answer says weekly averaging for fat intake is generally fine",
        "Answer mentions covering essential fatty acids and fat-soluble vitamin absorption",
        "Answer does NOT insist on identical daily fat intake as mandatory",
    ],
    4: [
        "Answer frames TRT as a medical decision requiring physician oversight",
        "Answer mentions that normalizing testosterone from very low levels can increase hypertrophy potential",
        "Answer suggests higher training volume/frequency may be tolerated with TRT",
        "Answer emphasizes individual variability based on baseline status",
    ],
    5: [
        "Answer argues fitness misinformation is NOT improving and may be worsening",
        "Answer mentions structural incentives in academia and industry that reward overstatement",
        "Answer discusses social media amplification and commercial incentives as force multipliers",
        "Answer recommends prioritizing evidence quality and skepticism",
    ],
    6: [
        "Answer states Eric noticed no meaningful performance or recovery change after going vegan",
        "Answer mentions protein-source diversity (pea, rice, soy) for amino acid coverage",
        "Answer includes algae oil for EPA/DHA and B12 as important supplements",
        "Answer does NOT claim vegan diet is superior or inferior for performance",
    ],
    7: [
        "Answer states hypertrophy IS possible with type 2 diabetes, not 'off the table'",
        "Answer mentions reduced but not zero growth rate compared to non-diabetic populations",
        "Answer discusses metformin's possible small negative hypertrophy effect via AMPK/MTOR",
        "Answer acknowledges confounding factors (age, training volume) in diabetic study populations",
    ],
    8: [
        "Answer explains stimulant interactions depend on enzyme pathways, not just both being stimulants",
        "Answer mentions caffeine is metabolized through CYP1A2 and nicotine through CYP2A6/CYP2B6",
        "Answer notes smoking can induce CYP1A2, potentially shortening caffeine half-life",
        "Answer recommends treating multi-compound interactions as a pharmacist-level problem",
    ],
    9: [
        "Answer gives a clear yes: meaningful BMR differences between same-size people are real",
        "Answer mentions a spread on the order of hundreds of kcal/day between individuals",
        "Answer cites organ-size variability (liver, kidneys, heart) as a major reason",
        "Answer frames fast/slow metabolism as legitimate biological phenomena, not just tracking error",
    ],
    10: [
        "Answer says calorie reduction needed may be smaller than expected due to constrained energy expenditure",
        "Answer mentions appetite tends to downshift alongside activity reduction",
        "Answer recommends gradual step reduction with monitoring rather than one huge calorie cut",
        "Answer warns that dropping to fully sedentary can create worse appetite-expenditure mismatch",
    ],
    11: [
        "Answer acknowledges this is a personal/fun question about cooking preferences",
        "Answer mentions favorites like pizza, breads, biryani/chicken-and-rice, chicken shawarma",
        "Answer does NOT try to give heavy technical nutrition coaching for this question",
    ],
    12: [
        "Answer states heavy lifting itself is unlikely to directly prevent fat loss",
        "Answer mentions energy intake and total expenditure as the main drivers",
        "Answer suggests bodyweight performance targets (push-ups, pull-ups, dips) as motivation during weight loss",
        "Answer recommends involving qualified dietitian/clinical support for binge-eating concerns",
        "Answer is critical of the described coaching setup with limited progress over years",
    ],
    13: [
        "Answer explains metabolic adaptations from dieting tend to reverse as body mass comes back",
        "Answer mentions a plausible yo-yo mechanism: repeated cycles may restore fat faster than lean tissue",
        "Answer discusses behavioral/NEAT-related factors (less spontaneous movement, efficiency)",
        "Answer recommends spending time at maintenance before dieting again",
        "Answer advises going slower and/or not pushing as lean in subsequent diets",
    ],
    14: [
        "Answer recommends major compound movements (squat/press/hinge/row variants)",
        "Answer suggests starting around 8-12 sets per muscle per week",
        "Answer recommends protein roughly 1.5-2.0 g/kg/day for a 15-year-old",
        "Answer suggests a slow gain target around 1% body weight per month",
        "Answer mentions building bodyweight/calisthenic competence before heavy barbell loading",
    ],
    15: [
        "Answer advises not treating bulking as a simple on/off category or scheduling by calendar",
        "Answer recommends setting specific endpoints (lean mass goal, fat gain limit, timeline)",
        "Answer states larger surpluses should be shorter and used less often",
        "Answer gives a practical minimum bulk duration of about one month",
        "Answer notes that if surplus isn't producing muscle/strength gains, the bulk may no longer be effective",
    ],
    16: [
        "Answer says yes, BMI can misclassify very tall people",
        "Answer explains the traditional formula uses height squared which is an imperfect scaling exponent",
        "Answer mentions height^2.5 as a more appropriate scaling alternative",
        "Answer provides a concrete example showing how extreme height distorts BMI interpretation",
    ],
    17: [
        "Answer identifies elevated creatinine (not creatine) as the likely lab marker",
        "Answer explains creatine supplementation commonly raises creatinine since it's a breakdown product",
        "Answer recommends discussing context with physician and requesting follow-up kidney function tests",
        "Answer does NOT recommend simply stopping creatine based on creatinine alone",
    ],
    18: [
        "Answer pushes back on blanket claims that plant-based diets are categorically healthier",
        "Answer notes observational comparisons are heavily confounded by broader health behaviors",
        "Answer states calories and macronutrient setup drive body composition more than dietary label",
        "Answer says both vegan and omnivorous diets can work well when thoughtfully structured",
    ],
    19: [
        "Answer describes most personalization claims as low-impact for typical lifters",
        "Answer states standard whey or a basic blend is already effective and practical",
        "Answer mentions personalized blends may matter for specific constraints (vegan, lactose intolerance)",
        "Answer recommends against overcomplicating protein powder selection",
    ],
    20: [
        "Answer frames mass gainers as a convenience tool, not uniquely superior",
        "Answer notes most are basically protein plus simple carbohydrates",
        "Answer states the key criterion is adherence and total intake, not marketing claims",
    ],
    21: [
        "Answer emphasizes evaluating broader literature rather than anchoring to a single older review",
        "Answer notes research definitions of intermittent fasting vary significantly",
        "Answer states total energy intake is generally the dominant driver for fat loss",
    ],
    22: [
        "Answer presents creatine as the strongest general-purpose supplement for performance",
        "Answer mentions conditional value for vitamin D (when deficient), fish oil, magnesium",
        "Answer frames supplement value as incremental compared with training and nutrition fundamentals",
        "Answer recommends prioritizing proven basics over proprietary blends",
    ],
    23: [
        "Answer states concerns about high-protein harms are overstated in healthy people",
        "Answer gives a recommended target range of roughly 1.6-2.2 g/kg/day",
        "Answer notes going far beyond that range gives little added hypertrophy benefit",
        "Answer emphasizes consistent sufficient intake over extreme protein dosing",
    ],
    24: [
        "Answer reframes the issue as mostly a hardgainer problem, not a protein problem",
        "Answer states pushing protein higher beyond sufficiency won't fix poor gain rates",
        "Answer identifies higher total calories as the main solution for hardgainers",
        "Answer mentions the 1.6-2.2 g/kg/day range as sufficient",
    ],
    25: [
        "Answer describes sodium bicarbonate as one of the better-supported ergogenic supplements for high-intensity work",
        "Answer mentions extracellular buffering mechanism",
        "Answer warns about GI distress as the main downside",
        "Answer mentions a staged-loading protocol to reduce GI issues",
        "Answer cautions that chronic use may not improve long-term training adaptations",
    ],
    26: [
        "Answer declines a full point-by-point debate as low-value",
        "Answer states well-designed omnivorous and vegan diets can both support performance",
        "Answer criticizes the documentary's use of tiny demonstrations over robust evidence",
        "Answer recommends evaluating claims via higher-quality research methods",
    ],
    27: [
        "Answer rejects intentional misrepresentation of the film",
        "Answer provides specific film examples supporting the critique",
        "Answer mentions narrative sequencing implying plant-based eating improves fighting outcomes",
        "Answer discusses weak logic like gorilla comparisons",
    ],
    28: [
        "Answer says poor conditioning can limit lifting progress",
        "Answer notes a VO2 max around 25 ml/kg/min is low relative to typical sedentary averages (~35-40)",
        "Answer recommends adding dedicated aerobic work",
        "Answer suggests longer rest periods and possibly machine/single-joint exercises to manage systemic fatigue",
    ],
    29: [
        "Answer states non-nutritive sweeteners generally look fine in the evidence",
        "Answer gives a caffeine practical range of roughly 400-600 mg/day",
        "Answer recommends symptom-based caffeine management (jitters, sleep, headaches)",
        "Answer advises not burning every easy strategy in the offseason for use during hard prep",
    ],
    30: [
        "Answer recommends deloading as a diagnostic tool to distinguish overreaching from normal deficit-related loss",
        "Answer states if strength rebounds after deload, fatigue/overreaching was likely a contributor",
        "Answer mentions tracking bodyweight pull-up/dip rep maxes as a practical check",
        "Answer recommends using deload response and relative-performance context before assuming the cut is failing",
    ],
    31: [
        "Answer states no compelling evidence that calorie cycling is superior when weekly intake is equated",
        "Answer frames energy balance as a longer-game variable",
        "Answer says not to feel forced to cut intake on rest days for small calorie differences",
        "Answer acknowledges nonlinear intake can be useful for adherence or workout quality",
    ],
    32: [
        "Answer prioritizes lean protein first with strategic micronutrient-contributing sources",
        "Answer recommends broad rotation of fibrous vegetables for satiety and micronutrients",
        "Answer mentions a basic multivitamin as insurance",
        "Answer suggests fish oil or omega-3 source when fats are very low",
        "Answer gives a concrete practical meal example (like lentil soup)",
    ],
    33: [
        "Answer references FDA fish guidance with serving-based categories",
        "Answer distinguishes canned light tuna (lower mercury) from albacore/white and yellowfin",
        "Answer recommends limiting to a few servings per week, not multiple cans per day",
    ],
    34: [
        "Answer explains low energy availability disrupts multiple hormones (estrogen, testosterone, thyroid, IGF-1)",
        "Answer states hypertrophy and performance are likely impaired in that state",
        "Answer notes recovery is not all-or-none and can improve before full cycle restoration",
        "Answer recommends addressing energy availability and training stress first",
    ],
    35: [
        "Answer says yes, food-based nitrate intake can produce ergogenic benefits",
        "Answer mentions quality-control variability in some commercial beet supplements",
        "Answer suggests possible synergy from other compounds in the food matrix",
        "Answer recommends keeping nitrate-rich produce in the diet rather than relying solely on pills",
    ],
    36: [
        "Answer gives dosing of roughly 3-6 g/day for pure L-citrulline, with 6 g as practical target",
        "Answer mentions 6-8 g for citrulline malate",
        "Answer recommends timing about 1 hour pre-workout",
        "Answer cautions that effects are typically small, not transformative",
    ],
    37: [
        "Answer states drinking speed of protein shakes is not a key lever in mixed-meal contexts",
        "Answer mentions fiber, fat, meal composition affect amino acid appearance more than sip speed",
        "Answer recommends focusing on daily distribution of roughly 3-5 protein feedings",
    ],
    38: [
        "Answer distinguishes healthy people from those with pre-existing kidney disease",
        "Answer states current evidence does not strongly support high protein causing kidney disease in healthy people",
        "Answer recommends individualizing for those with kidney stone history",
        "Answer does NOT assume high protein is inherently dangerous for everyone",
    ],
    39: [
        "Answer frames L-theanine as useful for reducing caffeine jitters/anxiety",
        "Answer suggests a common range of about 100-200 mg with caffeine",
        "Answer notes individual response varies",
        "Answer recommends it as an optional complement rather than mandatory",
    ],
    40: [
        "Answer states direct aspirin-specific hypertrophy evidence is limited",
        "Answer considers blunting effects plausible via anti-inflammatory pathways at higher doses",
        "Answer discusses context-dependent findings (older vs younger populations)",
        "Answer advises against assuming chronic high-dose aspirin is adaptation-neutral",
    ],
    41: [
        "Answer confirms anti-nutrients are real (phytates, tannins, lectins, oxalates)",
        "Answer states the risk is often overstated",
        "Answer mentions cooking/processing methods reduce many anti-nutrient effects",
        "Answer advises against avoiding plant foods wholesale",
        "Answer recommends eating a varied diet with diverse food sources and preparation methods",
    ],
    42: [
        "Answer cites DRI targets of about 3.7 L/day for men and 2.7 L/day for women",
        "Answer notes these totals include water from food (~20%)",
        "Answer mentions hyponatremia as a risk of extreme water-chugging",
        "Answer recommends hydrating across the day rather than backloading",
    ],
    43: [
        "Answer states hydration timing matters, not magical differences between sipping and chugging",
        "Answer recommends starting hydration early and maintaining steadily",
        "Answer suggests tapering fluids 2-3 hours before bed if nocturia is an issue",
        "Answer mentions urine color as a simple day-to-day hydration heuristic",
    ],
    44: [
        "Answer confirms nicotine can suppress appetite but the effect habituates",
        "Answer states caffeine is usually the better pre-workout stimulant for performance",
        "Answer distinguishes harms of tobacco products from isolated nicotine gum/patch use",
        "Answer mentions nicotine's shorter half-life versus caffeine",
    ],
    45: [
        "Answer confirms cortisol is real and can influence body composition in extreme chronic elevations",
        "Answer mentions Cushing's syndrome as an example of pathological cortisol-driven fat patterns",
        "Answer states common fitness-level cortisol fluctuations are usually overinterpreted",
        "Answer distinguishes clinical extremes from normal daily stress/training variability",
    ],
    46: [
        "Answer draws a three-part distinction: normal fluctuations, severe chronic stress, and true endocrine pathology",
        "Answer states intervention target for persistent high stress is stress management, not cortisol supplements",
        "Answer notes cortisol follows diurnal rhythms so single snapshots can be misleading",
        "Answer provides a practical decision tree: don't panic about ordinary fluctuations, address persistent symptoms",
    ],
    47: [
        "Answer confirms contextual lab abnormalities are common and expected in trained lifters and contest prep",
        "Answer mentions elevated creatinine from muscle mass/diet/creatine use",
        "Answer discusses hormonal suppression during prep with recovery post-show",
        "Answer recommends interpreting labs through the lens of training phase and body composition status",
    ],
    48: [
        "Answer says yes, recomposition at maintenance calories is possible in the right context",
        "Answer mentions training status, current body composition, training stimulus quality, and protein as key factors",
        "Answer states people with more body fat are generally better candidates",
        "Answer notes a large caloric surplus is not always required to add muscle",
    ],
    49: [
        "Answer states evidence-based training does NOT mean overcomplicated or joyless training",
        "Answer acknowledges bro splits can still work well",
        "Answer says aggressive eating phases can help some lifters stop under-eating",
        "Answer pushes back on the idea that beginner gains are only tied to a short timeline",
    ],
    50: [
        "Answer gives concrete high-volume low-calorie food examples (cauliflower rice, shredded chicken, egg whites, etc.)",
        "Answer recommends maximizing fiber/water volume and protein density",
        "Answer mentions bulking up ground-beef meals with shredded cabbage (~1:1 ratio)",
        "Answer is practical and meal-prep oriented for deep cutting phases",
    ],
    51: [
        "Answer distinguishes older negative evidence from newer (2018 meta-analysis) showing small benefits",
        "Answer states glucosamine showed a small effect on stiffness, chondroitin on pain and function",
        "Answer emphasizes these are modest effects, not dramatic improvements",
        "Answer notes the evidence is mostly in osteoarthritis populations, not generalizable to everyone",
    ],
    52: [
        "Answer states the direct strength/hypertrophy penalty from imperfect food quality is probably small if basics are met",
        "Answer notes many concerns are about missing beneficial foods, not the mere presence of fun foods",
        "Answer recommends securing essentials (energy, protein, micronutrient adequacy) first",
        "Answer frames food-quality upgrades as context-dependent health and performance lever",
    ],
    53: [
        "Answer states lifting is the dominant driver of muscle protein synthesis, protein is permissive support",
        "Answer mentions even very reduced training volume (10-15% of normal) can help preserve muscle",
        "Answer notes protein-only interventions during immobilization are usually underwhelming",
        "Answer recommends keeping some safe muscle loading whenever possible, then optimizing protein on top",
    ],
    54: [
        "Answer states nutrition alone is usually weak for preventing detraining losses compared with loading",
        "Answer mentions very high leucine intakes (15-19 g/day) sometimes show partial benefit",
        "Answer recommends working closely with surgeon/clinical team for return-to-training timing",
        "Answer notes regaining lost strength is typically faster than building it the first time",
    ],
    55: [
        "Answer recommends controlling food environment when sleep deprived due to appetite effects",
        "Answer suggests biasing toward safer training options (machines, controlled movements) when fatigued",
        "Answer mentions short naps of 20-30 minutes as useful",
        "Answer advises keeping resistance training in place but with safety adjustments",
    ],
    56: [
        "Answer recommends adjusting meal planning upstream if calorie/protein conflicts are frequent",
        "Answer gives a baseline of about 1.6 g/kg/day protein as a practical middle target",
        "Answer leans toward prioritizing protein in deficits and accepting small calorie overshoot if rare",
        "Answer suggests splitting the difference in recomp/lean-bulk contexts",
    ],
    57: [
        "Answer mentions Greg's interest in a definitive human hyperplasia study",
        "Answer discusses a massive responder-variability project with rich omics data",
        "Answer mentions Eric wanting a creatine-caffeine interaction trial and nitrate/citrulline hypertrophy studies",
        "Answer identifies training during caloric deficits (maintain volume vs intensity) as a major gap",
    ],
    58: [
        "Answer states very low body fat makes performance and hypertrophy progress much harder",
        "Answer mentions practical signs: worse training quality, slower recovery, higher hunger, system slowdown",
        "Answer notes lean-mass gains are uncommon below roughly 8% body fat in men",
        "Answer recommends symptom-based and performance-based monitoring over chasing exact body-fat numbers",
    ],
    59: [
        "Answer says impact depends on goal hierarchy (health vs performance)",
        "Answer acknowledges session performance still matters for hypertrophy via mechanical tension",
        "Answer recommends a small pre-workout feeding if tolerated (at least ~20g carbohydrate)",
        "Answer suggests adapting timing/form rather than forcing a strategy that causes GI distress",
    ],
    60: [
        "Answer states yes, excess protein calories CAN contribute to fat storage",
        "Answer mentions thermic effect differs by macro (protein highest) but doesn't make protein calories free",
        "Answer is skeptical of self-reported intake in free-living overfeeding papers",
        "Answer references controlled metabolic-ward trials (like Bray et al.) showing overfeeding behaves as expected",
    ],
    61: [
        "Answer states the underlying evidence base for ashwagandha is not consistent enough for strong recommendation",
        "Answer highlights hard-to-generalize effect sizes in some studies",
        "Answer mentions weak mechanistic coherence across studies",
        "Answer recommends cautious use with modest expectations if someone is interested",
    ],
    62: [
        "Answer mentions Greg got weaker during the cut but attributes much to disrupted training from injury",
        "Answer discusses wrist/elbow injury limiting training for months",
        "Answer states strength rebounded quickly once consistent lifting resumed",
        "Answer frames consistency and acceptance as more important than chasing perfect in-cut numbers",
    ],
    63: [
        "Answer states no meaningful body-composition advantage of interval vs steady-state cardio",
        "Answer cites or references a meta-analysis showing both produced small similar changes",
        "Answer gives concrete interval options (30s hard/90s easy, 1min/1min, 2min/2min)",
        "Answer recommends choosing the modality you can adhere to safely",
    ],
}


def slugify(topic):
    """Convert topic string to directory-friendly slug."""
    slug = topic.lower()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


def main():
    with open(EVALS_PATH) as f:
        data = json.load(f)

    evals = data["evals"]
    iteration_dir = os.path.join(WORKSPACE, "iteration-1")
    os.makedirs(iteration_dir, exist_ok=True)

    created = 0
    for ev in evals:
        eid = ev["id"]
        topic = ev["topic"]
        slug = slugify(topic)
        eval_dir_name = f"eval-{eid}-{slug}"
        eval_dir = os.path.join(iteration_dir, eval_dir_name)

        # Create directory structure
        for config in ["with_skill", "without_skill"]:
            outputs_dir = os.path.join(eval_dir, config, "outputs")
            os.makedirs(outputs_dir, exist_ok=True)

        # Get assertions for this eval
        assertions = ASSERTIONS.get(
            eid,
            [
                f"Answer addresses the core question about {topic}",
                "Answer provides specific, actionable recommendations",
                "Answer includes relevant caveats and nuance",
            ],
        )

        # Write eval_metadata.json
        metadata = {
            "eval_id": eid,
            "eval_name": eval_dir_name,
            "prompt": ev["prompt"],
            "expected_output": ev["expected_output"],
            "topic": topic,
            "episode": ev.get("episode"),
            "assertions": assertions,
        }
        meta_path = os.path.join(eval_dir, "eval_metadata.json")
        with open(meta_path, "w") as f:
            json.dump(metadata, f, indent=2)

        created += 1

    print(f"Created {created} eval directories in {iteration_dir}")
    print(f"Total assertions: {sum(len(v) for v in ASSERTIONS.values())}")


if __name__ == "__main__":
    main()
