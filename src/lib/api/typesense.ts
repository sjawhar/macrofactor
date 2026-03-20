import type { SearchFoodResult, FoodServing } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _env = typeof (import.meta as any)?.env === 'object' ? (import.meta as any).env : {};
function getTypesenseHost(): string {
  return _env.VITE_TYPESENSE_HOST ?? process.env.TYPESENSE_HOST ?? '';
}
function getTypesenseApiKey(): string {
  return _env.VITE_TYPESENSE_API_KEY ?? process.env.TYPESENSE_API_KEY ?? '';
}

export async function searchFoods(query: string): Promise<SearchFoodResult[]> {
  const resp = await fetch(`${getTypesenseHost()}/multi_search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-typesense-api-key': getTypesenseApiKey(),
    },
    body: JSON.stringify({
      searches: [
        {
          collection: 'common_foods',
          q: query,
          query_by: 'foodDesc',
          per_page: 10,
        },
        {
          collection: 'branded_foods',
          q: query,
          query_by: 'foodDesc,brandName',
          per_page: 10,
        },
      ],
    }),
  });

  if (!resp.ok) {
    throw new Error(`Typesense search failed (${resp.status}): ${await resp.text()}`);
  }

  const data = await resp.json();

  // Collect all hits with their Typesense relevance score, then sort by
  // score descending so branded exact matches rank above irrelevant common foods.
  const scored: { score: number; result: SearchFoodResult }[] = [];
  for (let i = 0; i < (data.results?.length ?? 0); i++) {
    const branded = i === 1;
    const hits = data.results[i]?.hits ?? [];
    for (const hit of hits) {
      const parsed = parseHit(hit.document, branded);
      if (parsed) scored.push({ score: hit.text_match_info?.best_field_score ?? hit.text_match ?? 0, result: parsed });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const results = scored.map((s) => s.result);

  return results;
}

export async function getFoodById(foodId: string): Promise<SearchFoodResult | null> {
  const encodedId = encodeURIComponent(foodId);
  for (const collection of ['common_foods', 'branded_foods']) {
    const resp = await fetch(`${getTypesenseHost()}/collections/${collection}/documents/${encodedId}`, {
      headers: {
        'x-typesense-api-key': getTypesenseApiKey(),
      },
    });
    if (resp.ok) {
      const doc = await resp.json();
      return parseHit(doc, collection === 'branded_foods');
    }
    if (resp.status !== 404) {
      throw new Error(`Typesense get-by-id failed (${resp.status}): ${await resp.text()}`);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Hit parsing
// ---------------------------------------------------------------------------

function num(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val) || 0;
  return 0;
}

function parseHit(doc: Record<string, unknown>, branded: boolean): SearchFoodResult | null {
  if (!doc) return null;

  // Build nutrient map — look for a nested `nutrients` object, prefixed keys (n203),
  // or bare numeric keys (203).
  const nutrients: Record<string, number> = {};
  const nutrientObj = doc.nutrients;
  if (nutrientObj && typeof nutrientObj === 'object' && !Array.isArray(nutrientObj)) {
    for (const [k, v] of Object.entries(nutrientObj as Record<string, unknown>)) {
      nutrients[k] = num(v);
    }
  }
  for (const [k, v] of Object.entries(doc)) {
    if (/^n\d+$/.test(k)) nutrients[k.substring(1)] = num(v);
    else if (/^\d{3}$/.test(k)) nutrients[k] = num(v);
  }

  const caloriesPer100g = nutrients['208'] ?? num(doc.calories) ?? num(doc.energy) ?? 0;
  const proteinPer100g = nutrients['203'] ?? num(doc.protein) ?? 0;
  const fatPer100g = nutrients['204'] ?? num(doc.fat) ?? num(doc.totalFat) ?? 0;
  const carbsPer100g = nutrients['205'] ?? num(doc.carbs) ?? num(doc.carbohydrate) ?? 0;

  // Servings — Typesense stores these in `weights` array and `dfSrv` (default serving)
  const servings: FoodServing[] = [];

  // Parse weights array (available serving sizes)
  const rawWeights = doc.weights;
  if (Array.isArray(rawWeights)) {
    for (const w of rawWeights) {
      if (w && typeof w === 'object') {
        const rec = w as Record<string, unknown>;
        servings.push({
          description: (rec.msreDesc ?? rec.description ?? rec.label ?? 'serving') as string,
          amount: num(rec.amount ?? 1),
          gramWeight: num(rec.gmWgt ?? rec.gramWeight ?? rec.weight ?? 100),
        });
      }
    }
  }

  // If no weights, try dfSrv (default serving)
  if (servings.length === 0 && doc.dfSrv && typeof doc.dfSrv === 'object') {
    const ds = doc.dfSrv as Record<string, unknown>;
    servings.push({
      description: (ds.msreDesc ?? ds.description ?? 'serving') as string,
      amount: num(ds.amount ?? 1),
      gramWeight: num(ds.gmWgt ?? ds.gramWeight ?? 100),
    });
  }

  // Always include a 100g option
  if (!servings.some((s) => s.gramWeight === 100)) {
    servings.push({ description: '100 g', amount: 1, gramWeight: 100 });
  }

  return {
    foodId: String(doc.id ?? doc.fdcId ?? ''),
    name: (doc.foodDesc ?? doc.description ?? '') as string,
    brand: branded ? ((doc.brandName as string) ?? undefined) : undefined,
    caloriesPer100g,
    proteinPer100g,
    fatPer100g,
    carbsPer100g,
    defaultServing: servings[0],
    servings,
    imageId: (doc.imageId ?? doc.x) as string | undefined,
    nutrientsPer100g: nutrients,
    source: branded ? 'branded' : 'common',
    branded,
  };
}
