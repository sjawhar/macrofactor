import type { Goals, ScaleEntry, NutritionSummary, StepEntry, SearchFoodResult, FoodServing } from './types';
import { FoodEntry } from './types';
import { signIn, refreshIdToken, getUserIdFromToken } from './auth';
import {
  type FoodFieldValue,
  getDocument,
  patchDocument,
  deleteDocument,
  removeFields,
  patchFoodDocument,
  updateFoodEntryFields,
  parseDocument,
  listDocuments,
  sfv,
  bfv,
  nfv,
  servingsArray,
} from './firestore';
import { searchFoods as typesenseSearch } from './typesense';
import type {
  WorkoutSummary,
  WorkoutDetail,
  WorkoutBlock,
  WorkoutExercise,
  WorkoutSet,
  GymProfile,
  CustomExercise,
} from './workout-types';
import { resolveName } from './exercises';

// Training Program types
interface TrainingProgramDay {
  id: string;
  name: string;
  gymId: string;
  isRestDay: boolean;
  exercises: { exerciseId: string; id: string }[];
}

interface TrainingProgram {
  id: string;
  name: string;
  color: string;
  icon: string;
  numCycles: number;
  runIndefinitely: boolean;
  isPeriodized: boolean;
  deload: string;
  isActive: boolean;
  days: TrainingProgramDay[];
}

interface NextWorkoutDay {
  program: TrainingProgram;
  dayIndex: number;
  dayName: string;
  isRestDay: boolean;
  exercises: { exerciseId: string; id: string }[];
  cycleIndex: number;
  totalCycles: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Years that overlap the [start, end] date range (YYYY-MM-DD strings). */
function yearsInRange(start: string, end: string): number[] {
  const sy = parseInt(start.substring(0, 4), 10);
  const ey = parseInt(end.substring(0, 4), 10);
  const years: number[] = [];
  for (let y = sy; y <= ey; y++) years.push(y);
  return years;
}

/** "2024-03-15" → "0315" */
function mmdd(date: string): string {
  return date.substring(5, 7) + date.substring(8, 10);
}

/** "2024-03-15" → "2024" */
function yearOf(date: string): string {
  return date.substring(0, 4);
}

/** Format a Date as YYYY-MM-DD. */
function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Timezone-safe local time for food logging. */
export interface LogTime {
  /** YYYY-MM-DD */
  date: string;
  /** 0-23 */
  hour: number;
  /** 0-59 */
  minute: number;
}

/** Wrap a numeric-looking field name in backticks for Firestore field paths. */
function esc(field: string): string {
  return `\`${field}\``;
}

function toNumberArray(val: unknown): number[] {
  if (Array.isArray(val)) return val.map(Number);
  if (typeof val === 'number') return [val];
  return [];
}

function documentId(name: string | undefined, parsed: Record<string, any>): string | undefined {
  if (typeof parsed.id === 'string' && parsed.id !== '') return parsed.id;
  return name?.split('/').pop();
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class MacroFactorClient {
  private idToken: string;
  private refreshToken: string;
  private uid: string;
  private tokenExpiresAt: number;

  private constructor(idToken: string, refreshToken: string, uid: string, tokenExpiresAt: number) {
    this.idToken = idToken;
    this.refreshToken = refreshToken;
    this.uid = uid;
    this.tokenExpiresAt = tokenExpiresAt;
  }

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  static async login(email: string, password: string): Promise<MacroFactorClient> {
    const res = await signIn(email, password);
    return new MacroFactorClient(res.idToken, res.refreshToken, res.uid, Date.now() + res.expiresIn * 1000);
  }

  /** Restore a session from a stored refresh token. */
  static async fromRefreshToken(storedRefreshToken: string): Promise<MacroFactorClient> {
    const res = await refreshIdToken(storedRefreshToken);
    const uid = getUserIdFromToken(res.idToken);
    return new MacroFactorClient(res.idToken, res.refreshToken, uid, Date.now() + res.expiresIn * 1000);
  }

  getRefreshToken(): string {
    return this.refreshToken;
  }

  /** Return a valid id token, refreshing automatically if within 60 s of expiry. */
  private async ensureToken(): Promise<string> {
    if (Date.now() < this.tokenExpiresAt - 60_000) return this.idToken;
    const res = await refreshIdToken(this.refreshToken);
    this.idToken = res.idToken;
    this.refreshToken = res.refreshToken;
    this.tokenExpiresAt = Date.now() + res.expiresIn * 1000;
    return this.idToken;
  }

  // -------------------------------------------------------------------------
  // User
  // -------------------------------------------------------------------------

  async getUserId(): Promise<string> {
    return this.uid;
  }

  async getProfile(): Promise<Record<string, unknown>> {
    const token = await this.ensureToken();
    const doc = await getDocument(`users/${this.uid}`, token);
    return parseDocument(doc);
  }

  async getGoals(): Promise<Goals> {
    const profile = await this.getProfile();
    const planner = (profile.planner ?? {}) as Record<string, unknown>;
    return {
      calories: toNumberArray(planner.calories ?? []),
      protein: toNumberArray(planner.protein ?? []),
      carbs: toNumberArray(planner.carbs ?? []),
      fat: toNumberArray(planner.fat ?? []),
      tdee: planner.tdeeValue != null ? Number(planner.tdeeValue) : undefined,
      programStyle: typeof planner.programStyle === 'string' ? planner.programStyle : undefined,
      programType: typeof planner.programType === 'string' ? planner.programType : undefined,
    };
  }

  // -------------------------------------------------------------------------
  // Weight / scale
  // -------------------------------------------------------------------------

  async getWeightEntries(start: string, end: string): Promise<ScaleEntry[]> {
    const token = await this.ensureToken();
    const entries: ScaleEntry[] = [];

    for (const year of yearsInRange(start, end)) {
      const doc = await getDocument(`users/${this.uid}/scale/${year}`, token);
      const data = parseDocument(doc);

      for (const [key, val] of Object.entries(data)) {
        if (typeof val !== 'object' || val === null) continue;
        const mm = key.substring(0, 2);
        const dd = key.substring(2, 4);
        const dateStr = `${year}-${mm}-${dd}`;
        if (dateStr < start || dateStr > end) continue;
        entries.push({
          date: dateStr,
          weight: Number(val.w ?? 0),
          bodyFat: val.f != null ? Number(val.f) : undefined,
          source: val.s as string | undefined,
        });
      }
    }

    return entries.sort((a, b) => a.date.localeCompare(b.date));
  }

  async logWeight(date: string, weightKg: number, bodyFat?: number): Promise<void> {
    const token = await this.ensureToken();
    const key = mmdd(date);
    const entry: { w: number; f?: number; s: string } = { w: weightKg, s: 'macro_factor' };
    if (bodyFat !== undefined) entry.f = bodyFat;
    await patchDocument(`users/${this.uid}/scale/${yearOf(date)}`, { [key]: entry }, [esc(key)], token);
  }

  async deleteWeightEntry(date: string): Promise<void> {
    const token = await this.ensureToken();
    const key = mmdd(date);
    // Including key in updateMask but omitting it from fields deletes the field.
    await patchDocument(`users/${this.uid}/scale/${yearOf(date)}`, {}, [esc(key)], token);
  }

  // -------------------------------------------------------------------------
  // Nutrition summaries
  // -------------------------------------------------------------------------

  async getNutrition(start: string, end: string): Promise<NutritionSummary[]> {
    // Nutrition summaries may not exist in Firestore; compute from food logs.
    const entries: NutritionSummary[] = [];
    const startDate = new Date(start + 'T12:00:00');
    const endDate = new Date(end + 'T12:00:00');
    const d = new Date(startDate);
    while (d <= endDate) {
      const dateStr = fmtDate(d);
      try {
        const food = await this.getFoodLog(dateStr);
        const active = food.filter((e) => !e.deleted);
        if (active.length > 0) {
          entries.push({
            date: dateStr,
            calories: active.reduce((s, e) => s + e.calories(), 0),
            protein: active.reduce((s, e) => s + e.protein(), 0),
            carbs: active.reduce((s, e) => s + e.carbs(), 0),
            fat: active.reduce((s, e) => s + e.fat(), 0),
          });
        }
      } catch {
        /* no food log for this day */
      }
      d.setDate(d.getDate() + 1);
    }
    return entries.sort((a, b) => a.date.localeCompare(b.date));
  }

  // -------------------------------------------------------------------------
  // Food log
  // -------------------------------------------------------------------------

  async getFoodLog(date: string): Promise<FoodEntry[]> {
    const token = await this.ensureToken();
    const doc = await getDocument(`users/${this.uid}/food/${date}`, token);
    const data = parseDocument(doc);
    const entries: FoodEntry[] = [];

    for (const [entryId, val] of Object.entries(data)) {
      if (typeof val !== 'object' || val === null) continue;
      entries.push(
        new FoodEntry({
          date,
          entryId,
          name: val.t as string | undefined,
          brand: val.b as string | undefined,
          caloriesRaw: val.c != null ? Number(val.c) : undefined,
          proteinRaw: val.p != null ? Number(val.p) : undefined,
          carbsRaw: val.e != null ? Number(val.e) : undefined,
          fatRaw: val.f != null ? Number(val.f) : undefined,
          servingGrams: val.g != null ? Number(val.g) : undefined,
          unitWeight: val.w != null ? Number(val.w) : undefined,
          userQty: val.y != null ? Number(val.y) : undefined,
          quantity: val.q != null ? Number(val.q) : undefined,
          servingUnit: val.s as string | undefined,
          hour: val.h as string | undefined,
          minute: val.mi as string | undefined,
          sourceType: val.k as string | undefined,
          foodId: val.id as string | undefined,
          deleted: val.d === true,
          imageId: val.x as string | undefined,
        })
      );
    }

    return entries;
  }

  async logFood(
    loggedAt: LogTime,
    name: string,
    calories: number,
    protein: number,
    carbs: number,
    fat: number
  ): Promise<void> {
    const token = await this.ensureToken();
    const dateStr = loggedAt.date;
    const nowMicros = String(Date.now() * 1000);
    const entryId = nowMicros;
    const defaultServing = { description: 'serving', gramWeight: 1, amount: 1 };
    const fields: Record<string, FoodFieldValue> = {
      t: sfv(name),
      b: sfv(name),
      c: sfv(calories),
      p: sfv(protein),
      e: sfv(carbs),
      f: sfv(fat),
      g: sfv(1),
      w: sfv(1),
      y: sfv(1),
      q: sfv(1),
      s: sfv(defaultServing.description),
      u: sfv(defaultServing.description),
      h: sfv(String(loggedAt.hour)),
      mi: sfv(String(loggedAt.minute)),
      k: sfv('manual'),
      ca: sfv(nowMicros),
      ua: sfv(nowMicros),
      o: bfv(false),
      fav: bfv(false),
      ef: nfv(),
      m: servingsArray([defaultServing]),
    };
    await patchFoodDocument(`users/${this.uid}/food/${dateStr}`, entryId, fields, token);
  }

  /**
   * Log a food entry from search results.
   *
   * @param gramMode - true when the user specified grams (e.g. "150g"),
   *   false when they specified serving units (e.g. "2tbsp").
   *   In gram mode:  w=1, y=raw grams, q=1, u="g"
   *   In unit mode:  w=servingGrams, y=unit count, q=1, u=serving name
   */
  async logSearchedFood(
    loggedAt: LogTime,
    food: SearchFoodResult,
    serving: FoodServing,
    quantity: number,
    gramMode: boolean = true
  ): Promise<void> {
    const token = await this.ensureToken();
    const dateStr = loggedAt.date;
    // App uses 16-digit microsecond timestamps as entry IDs
    // Use current wall-clock time for unique IDs (not meal time — that goes in h/mi)
    const entryId = String(Date.now() * 1000);
    const sg = serving.gramWeight;
    const nowMicros = String(Date.now() * 1000);

    // Build per-serving macros & micronutrients (all as stringValue)
    // Macros are always stored per-serving (nutrient per 100g × serving grams / 100).
    // The app computes totals via: total = macro × w × y / (g × q)
    const fields: Record<string, import('./firestore').FoodFieldValue> = {
      t: sfv(food.name),
      b: sfv(food.brand || food.name),
      id: sfv(food.foodId),
      c: sfv((food.caloriesPer100g * sg) / 100),
      p: sfv((food.proteinPer100g * sg) / 100),
      e: sfv((food.carbsPer100g * sg) / 100),
      f: sfv((food.fatPer100g * sg) / 100),
      g: sfv(sg),
      w: sfv(gramMode ? 1 : sg),
      y: sfv(quantity),
      q: sfv(1),
      s: sfv(serving.description),
      u: sfv(gramMode ? 'g' : serving.description),
      h: sfv(String(loggedAt.hour)),
      mi: sfv(String(loggedAt.minute)),
      k: sfv('t'),
      x: sfv(food.imageId || ''),
      ca: sfv(nowMicros),
      ua: sfv(nowMicros),
      o: bfv(false),
      fav: bfv(false),
      ef: nfv(),
      // Measurements array for the serving picker
      m: servingsArray(food.servings),
    };

    // Include ALL micronutrients from the food — the app stores these
    // per-serving (nutrientPer100g * servingGrams / 100) as stringValue.
    // Omitting them produces entries the app can't fully render.
    for (const [nutrientId, valuePer100g] of Object.entries(food.nutrientsPer100g)) {
      // Skip the 4 macros we already set as c/p/e/f (208=cal, 203=prot, 204=fat, 205=carb)
      if (['203', '204', '205', '208'].includes(nutrientId)) continue;
      const perServing = (valuePer100g * sg) / 100;
      if (perServing !== 0) {
        fields[nutrientId] = sfv(perServing);
      }
    }

    await patchFoodDocument(`users/${this.uid}/food/${dateStr}`, entryId, fields, token);
  }

  async deleteFoodEntry(date: string, entryId: string): Promise<void> {
    const token = await this.ensureToken();
    const nowMicros = String(Date.now() * 1000);
    // Use updateFoodEntryFields (per-subfield mask) instead of patchFoodDocument
    // (whole-entry replace) so we ADD the d flag without wiping the entry data.
    await updateFoodEntryFields(`users/${this.uid}/food/${date}`, entryId, { d: bfv(true), ua: sfv(nowMicros) }, token);
  }

  async hardDeleteFoodEntry(date: string, entryId: string): Promise<void> {
    const token = await this.ensureToken();
    await removeFields(`users/${this.uid}/food/${date}`, [esc(entryId)], token);
  }

  async updateFoodEntry(date: string, entryId: string, qty: number): Promise<void> {
    const token = await this.ensureToken();
    const nowMicros = String(Date.now() * 1000);
    // Use per-subfield update to avoid wiping the entry.
    // q is always 1 (serving count); y is the user quantity.
    await updateFoodEntryFields(`users/${this.uid}/food/${date}`, entryId, { y: sfv(qty), ua: sfv(nowMicros) }, token);
  }

  /**
   * Copy food entries to a different date, preserving all raw Firestore fields.
   * New timestamp-based entry IDs are generated for the target date.
   */
  async copyEntries(targetDate: string, entries: FoodEntry[]): Promise<void> {
    if (entries.length === 0) return;
    const token = await this.ensureToken();
    const sourceDate = entries[0].date;

    const doc = await getDocument(`users/${this.uid}/food/${sourceDate}`, token);
    const docFields = doc.fields ?? {};
    const baseMicros = Date.now() * 1000;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const rawEntryFields = docFields[entry.entryId]?.mapValue?.fields as Record<string, FoodFieldValue> | undefined;
      if (!rawEntryFields) continue;

      const newMicros = String(baseMicros + i);
      const copied: Record<string, FoodFieldValue> = { ...rawEntryFields, ca: sfv(newMicros), ua: sfv(newMicros) };
      delete copied.d;
      await patchFoodDocument(`users/${this.uid}/food/${targetDate}`, newMicros, copied, token);
    }
  }

  // -------------------------------------------------------------------------
  // Steps
  // -------------------------------------------------------------------------

  async getSteps(start: string, end: string): Promise<StepEntry[]> {
    const token = await this.ensureToken();
    const entries: StepEntry[] = [];

    for (const year of yearsInRange(start, end)) {
      const doc = await getDocument(`users/${this.uid}/steps/${year}`, token);
      const data = parseDocument(doc);

      for (const [key, val] of Object.entries(data)) {
        if (typeof val !== 'object' || val === null) continue;
        const mm = key.substring(0, 2);
        const dd = key.substring(2, 4);
        const dateStr = `${year}-${mm}-${dd}`;
        if (dateStr < start || dateStr > end) continue;
        entries.push({
          date: dateStr,
          steps: Number(val.st ?? 0),
          source: val.s as string | undefined,
        });
      }
    }

    return entries.sort((a, b) => a.date.localeCompare(b.date));
  }

  // -------------------------------------------------------------------------
  // Sync
  // -------------------------------------------------------------------------

  /** Re-aggregate food entries for a day and write the nutrition summary. */
  async syncDay(date: string): Promise<void> {
    const entries = await this.getFoodLog(date);
    const active = entries.filter((e) => !e.deleted);

    let totalCal = 0;
    let totalPro = 0;
    let totalCarb = 0;
    let totalFat = 0;
    for (const e of active) {
      totalCal += e.calories();
      totalPro += e.protein();
      totalCarb += e.carbs();
      totalFat += e.fat();
    }

    const token = await this.ensureToken();
    const key = mmdd(date);
    const summary = {
      k: Math.round(totalCal),
      p: Math.round(totalPro * 10) / 10,
      c: Math.round(totalCarb * 10) / 10,
      f: Math.round(totalFat * 10) / 10,
      s: 'macro_factor',
    };
    await patchDocument(`users/${this.uid}/nutrition/${yearOf(date)}`, { [key]: summary }, [esc(key)], token);
  }

  // -------------------------------------------------------------------------
  // Training Programs
  // -------------------------------------------------------------------------

  /**
   * Get the workout profile, which includes activeProgramId and settings.
   */
  async getWorkoutProfile(): Promise<Record<string, any>> {
    const token = await this.ensureToken();
    const doc = await getDocument(`users/${this.uid}/profiles/workout`, token);
    return parseDocument(doc);
  }

  /**
   * Get all training programs (from the trainingProgram collection).
   * Each program contains a `days` array with the full cycle definition,
   * including rest days (days with empty blocks array).
   */
  async getTrainingPrograms(): Promise<TrainingProgram[]> {
    const token = await this.ensureToken();
    const profile = await this.getWorkoutProfile();
    const activeProgramId = profile.activeProgramId || null;
    const docs = await listDocuments(`users/${this.uid}/trainingProgram`, token);
    return docs.map((doc: any) => {
      const p = parseDocument(doc);
      const days = (p.days as any[]) || [];
      return {
        id: p.id as string,
        name: p.name as string,
        color: p.color as string,
        icon: p.icon as string,
        numCycles: (p.numCycles as number) || 1,
        runIndefinitely: (p.runIndefinitely as boolean) || false,
        isPeriodized: (p.isPeriodized as boolean) || false,
        deload: (p.deload as string) || 'none',
        isActive: p.id === activeProgramId,
        days: days.map((d: any) => ({
          id: d.id as string,
          name: d.name as string,
          gymId: d.gymId as string,
          isRestDay:
            !d.blocks || d.blocks.length === 0 || d.blocks.every((b: any) => !b.exercises || b.exercises.length === 0),
          exercises: (d.blocks || []).flatMap((b: any) =>
            (b.exercises || []).map((e: any) => ({
              exerciseId: e.exerciseId as string,
              id: e.id as string,
            }))
          ),
        })),
      };
    });
  }

  /**
   * Determine the next workout day based on workout history and active program.
   * Returns the next day in the cycle (could be a rest day or workout).
   */
  async getNextWorkout(): Promise<NextWorkoutDay | null> {
    const programs = await this.getTrainingPrograms();
    const active = programs.find((p) => p.isActive);
    if (!active) return null;

    // Find the most recent workout to determine position in cycle
    const token = await this.ensureToken();
    const history = await this.getWorkoutHistory();
    const lastProgramWorkout = history.find((w) => w.programName === active.name);

    if (!lastProgramWorkout) {
      // No history — start at day 1
      return {
        program: active,
        dayIndex: 0,
        dayName: active.days[0].name,
        isRestDay: active.days[0].isRestDay,
        exercises: active.days[0].exercises,
        cycleIndex: 0,
        totalCycles: active.numCycles,
      };
    }

    // Find which day the last workout was
    const lastDetail = await this.getWorkout(lastProgramWorkout.id);
    const lastDayId = lastDetail.workoutSource?.dayId;
    const lastCycleIndex = lastDetail.workoutSource?.cycleIndex ?? 0;
    const lastDayIndex = active.days.findIndex((d) => d.id === lastDayId);

    // Next day in cycle
    let nextDayIndex = (lastDayIndex + 1) % active.days.length;
    let nextCycleIndex = lastCycleIndex;
    if (nextDayIndex === 0) {
      nextCycleIndex += 1;
    }

    const nextDay = active.days[nextDayIndex];
    return {
      program: active,
      dayIndex: nextDayIndex,
      dayName: nextDay.name,
      isRestDay: nextDay.isRestDay,
      exercises: nextDay.exercises,
      cycleIndex: nextCycleIndex,
      totalCycles: active.numCycles,
    };
  }

  // -------------------------------------------------------------------------
  // Workouts
  // -------------------------------------------------------------------------

  async getRawWorkout(id: string): Promise<Record<string, any>> {
    const token = await this.ensureToken();
    const doc = await getDocument(`users/${this.uid}/workoutHistory/${id}`, token);
    if (!doc.fields) {
      throw new Error(`Workout ${id} not found`);
    }
    const parsed = parseDocument(doc);
    const derivedId = documentId(doc.name, parsed);
    if (derivedId && parsed.id == null) parsed.id = derivedId;
    return parsed;
  }

  async updateRawWorkout(id: string, fields: Record<string, any>, fieldPaths: string[]): Promise<void> {
    const token = await this.ensureToken();
    await patchDocument(`users/${this.uid}/workoutHistory/${id}`, fields, fieldPaths, token);
  }

  async updateWorkout(id: string, fields: Record<string, any>): Promise<void> {
    const patchFields = { ...fields };
    if (patchFields.durationMinutes != null) {
      patchFields.duration = Number(patchFields.durationMinutes) * 60 * 1_000_000;
      delete patchFields.durationMinutes;
    }
    const fieldPaths = Object.keys(patchFields);
    if (fieldPaths.length === 0) return;
    await this.updateRawWorkout(id, patchFields, fieldPaths);
  }

  async deleteWorkout(id: string): Promise<void> {
    const token = await this.ensureToken();
    await deleteDocument(`users/${this.uid}/workoutHistory/${id}`, token);
  }

  async getWorkoutHistory(): Promise<WorkoutSummary[]> {
    const token = await this.ensureToken();
    const docs = await listDocuments(`users/${this.uid}/workoutHistory`, token);
    return docs
      .map((doc) => {
        const d = parseDocument(doc);
        const derivedId = documentId(doc.name, d);
        const blocks = (d.blocks ?? []) as any[];
        let exerciseCount = 0;
        let setCount = 0;
        for (const block of blocks) {
          const exercises = block.exercises ?? [];
          exerciseCount += exercises.length;
          for (const ex of exercises) {
            setCount += (ex.sets ?? []).length;
          }
        }
        return {
          id: derivedId as string,
          name: d.name as string,
          startTime: d.startTime as string,
          durationSeconds: (d.duration as number) / 1_000_000,
          gymId: d.gymId as string | undefined,
          gymName: d.gymName as string | undefined,
          gymIcon: d.gymIcon as string | undefined,
          programName: (d.workoutSource as any)?.programName as string | undefined,
          exerciseCount,
          setCount,
        };
      })
      .sort((a, b) => b.startTime.localeCompare(a.startTime));
  }

  async getWorkout(id: string): Promise<WorkoutDetail> {
    const token = await this.ensureToken();
    const [doc, customExercises] = await Promise.all([
      getDocument(`users/${this.uid}/workoutHistory/${id}`, token),
      this.getCustomExercises(),
    ]);
    if (!doc.fields) {
      throw new Error(`Workout ${id} not found`);
    }
    const d = parseDocument(doc);
    const derivedId = documentId(doc.name, d);
    if (derivedId && d.id == null) d.id = derivedId;
    const customNameMap = new Map(customExercises.map((e) => [e.id, e.name]));
    return this.parseWorkoutDetail(d, customNameMap);
  }

  private parseWorkoutDetail(d: Record<string, any>, customNameMap?: Map<string, string>): WorkoutDetail {
    const blocks: WorkoutBlock[] = ((d.blocks ?? []) as any[]).map((block: any) => ({
      exercises: ((block.exercises ?? []) as any[]).map((ex: any): WorkoutExercise => {
        const bundledName = resolveName(ex.exerciseId);
        const name = bundledName !== ex.exerciseId ? bundledName : (customNameMap?.get(ex.exerciseId) ?? ex.exerciseId);
        return {
          id: ex.id,
          exerciseId: ex.exerciseId,
          exerciseName: name,
          baseWeight: ex.baseWeight ?? null,
          note: ex.note ?? '',
          sets: ((ex.sets ?? []) as any[]).map(
            (s: any): WorkoutSet => ({
              setType: s.setType,
              target: s.log?.target
                ? {
                    id: s.log.target.id,
                    minFullReps: s.log.target.minFullReps ?? null,
                    maxFullReps: s.log.target.maxFullReps ?? null,
                    rir: s.log.target.rir ?? null,
                    distance: s.log.target.distance ?? null,
                    durationSeconds: s.log.target.durationSeconds ?? null,
                    restTimer: s.log.target.restTimer != null ? s.log.target.restTimer / 1_000_000 : null,
                  }
                : null,
              value: {
                weight: s.log?.value?.weight ?? 0,
                fullReps: s.log?.value?.fullReps ?? 0,
                partialReps: s.log?.value?.partialReps ?? null,
                rir: s.log?.value?.rir ?? null,
                distance: s.log?.value?.distance ?? null,
                durationSeconds: s.log?.value?.durationSeconds ?? null,
                restTimerSeconds: (s.log?.value?.restTimer ?? 0) / 1_000_000,
                isSkipped: s.log?.value?.isSkipped ?? false,
              },
            })
          ),
        };
      }),
    }));

    let exerciseCount = 0;
    let setCount = 0;
    for (const block of blocks) {
      exerciseCount += block.exercises.length;
      for (const ex of block.exercises) {
        setCount += ex.sets.length;
      }
    }

    const ws = d.workoutSource as any;
    return {
      id: d.id as string,
      name: d.name as string,
      startTime: d.startTime as string,
      durationSeconds: (d.duration as number) / 1_000_000,
      gymId: d.gymId as string | undefined,
      gymName: d.gymName as string | undefined,
      gymIcon: d.gymIcon as string | undefined,
      programName: ws?.programName as string | undefined,
      exerciseCount,
      setCount,
      workoutSource: ws
        ? {
            runtimeType: ws.runtimeType,
            programId: ws.programId,
            programName: ws.programName,
            dayId: ws.dayId,
            cycleIndex: ws.cycleIndex,
            programColor: ws.programColor,
            programIcon: ws.programIcon,
          }
        : undefined,
      blocks,
    };
  }

  async getGymProfiles(): Promise<GymProfile[]> {
    const token = await this.ensureToken();
    const docs = await listDocuments(`users/${this.uid}/gym`, token);
    return docs.map((doc) => {
      const d = parseDocument(doc);
      const equipmentIds = (d.selectedEquipmentIds ?? []) as string[];
      return {
        id: d.id as string,
        name: d.name as string,
        icon: d.icon as string,
        weightUnit: (d.weightUnit as 'kgs' | 'lbs') ?? 'kgs',
        createdAt: d.createdAt as string | undefined,
        selectedEquipmentIds: equipmentIds,
        equipmentNames: equipmentIds.map(resolveName),
        useBumperPlatesInPlateCalculator: d.useBumperPlatesInPlateCalculator as boolean | undefined,
        allowMixedUnitsInPlateCalculator: d.allowMixedUnitsInPlateCalculator as boolean | undefined,
        offsetWeightInPlateCalculator: d.offsetWeightInPlateCalculator as number | undefined,
        alwaysShowExercises: (d.alwaysShowExercises ?? []) as string[],
        alwaysHideExercises: (d.alwaysHideExercises ?? []) as string[],
      };
    });
  }

  async getCustomExercises(): Promise<CustomExercise[]> {
    const token = await this.ensureToken();
    const docs = await listDocuments(`users/${this.uid}/customExercises`, token);
    return docs.map((doc) => {
      const d = parseDocument(doc);
      return d as unknown as CustomExercise;
    });
  }

  async createCustomExercise(exercise: Omit<CustomExercise, 'id'>): Promise<CustomExercise> {
    const token = await this.ensureToken();
    const id = crypto.randomUUID();
    const fields: Record<string, any> = {
      ...exercise,
      id,
      archived: exercise.archived ?? false,
      description: '',
    };
    const fieldPaths = Object.keys(fields);
    await patchDocument(`users/${this.uid}/customExercises/${id}`, fields, fieldPaths, token);
    return { ...exercise, id } as CustomExercise;
  }
  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

  async searchFoods(query: string): Promise<SearchFoodResult[]> {
    return typesenseSearch(query);
  }
}
