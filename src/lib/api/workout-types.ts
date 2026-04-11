// src/lib/api/workout-types.ts

export interface WorkoutSource {
  runtimeType: string;
  programId?: string;
  programName?: string;
  dayId?: string;
  cycleIndex?: number;
  programColor?: string;
  programIcon?: string;
}

export interface SetTarget {
  id: string;
  minFullReps: number | null;
  maxFullReps: number | null;
  rir: number | null;
  restTimer: number | null;
  distance: number | null;
  durationSeconds: number | null;
}

export interface ProgramSet {
  log: SetTarget;
  setType: string;
  segments: any[];
}

export interface CycleTargets {
  sets: ProgramSet[];
  overrideRestTimers: boolean;
}

export interface PeriodizedTargets {
  runtimeType: 'periodized';
  values: CycleTargets[];
  deload: CycleTargets | null;
}

export interface TrainingProgramExercise {
  exerciseId: string;
  id: string;
  periodizedTargets?: PeriodizedTargets;
}

export interface TrainingProgramDay {
  id: string;
  name: string;
  gymId: string;
  isRestDay: boolean;
  exercises: TrainingProgramExercise[];
}

export interface WorkoutCycleCompletion {
  runtimeType?: string;
  workoutHistoryIds?: string[];
}

export interface WorkoutCycleCompletionCycle {
  completionById?: Record<string, WorkoutCycleCompletion>;
}

export interface TrainingProgram {
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
  workoutCycleCompletions?: Record<string, WorkoutCycleCompletionCycle>;
}

// ---------------------------------------------------------------------------
// Training program inputs (used by createTrainingProgram / updateTrainingProgram)
// ---------------------------------------------------------------------------

/** Per-cycle set targets for one exercise in a program. */
export interface ProgramExerciseCycle {
  /** Sets to perform in this cycle. Each entry has setType and a log of targets. */
  sets: PlanSet[];
  /** When true, restTimer values on the sets override gym defaults. */
  overrideRestTimers?: boolean;
}

export interface ProgramExerciseInput {
  /** UUID for this exercise instance. Auto-generated if omitted. */
  id?: string;
  /** Hex (bundled) or UUID (custom). */
  exerciseId: string;
  /** One entry per cycle. Length must equal numCycles. */
  cycles: ProgramExerciseCycle[];
}

export interface ProgramBlockInput {
  /** UUID for this block. Auto-generated if omitted. */
  id?: string;
  /** Multiple exercises in one block = superset. */
  exercises: ProgramExerciseInput[];
}

export interface ProgramDayInput {
  /** UUID for this day. Auto-generated if omitted. */
  id?: string;
  /** Display name (e.g. "Workout A", "Push", "---" for rest). */
  name: string;
  /** Gym profile UUID. Defaults to the program-level gymId, or 'blankSlate' for rest days. */
  gymId?: string;
  /** Empty array OR omitted = rest day. */
  blocks?: ProgramBlockInput[];
}

export interface TrainingProgramInput {
  /** UUID for the program. Auto-generated if omitted. */
  id?: string;
  /** Display name. */
  name: string;
  /** Color theme. Common: "red", "blue", "green", "orange", "purple", "pink". Defaults to "blue". */
  color?: string;
  /** Icon. Common: "rocket", "house", "barbell", "flame", "list". Defaults to "list". */
  icon?: string;
  /** Number of cycles to run. Inferred from cycles arrays when omitted. */
  numCycles?: number;
  /** When true, the program loops forever. Defaults to false. */
  runIndefinitely?: boolean;
  /** When true, cycles can differ. Defaults to false (every cycle identical). */
  isPeriodized?: boolean;
  /** "lastCycle" makes the last cycle a deload. "none" = no deload. Defaults to "none". */
  deload?: 'lastCycle' | 'none';
  /** Whether the program is shown expanded in the library tab. Defaults to true. */
  expanded?: boolean;
  /** Default gymId for any day that doesn't specify its own. */
  gymId?: string;
  /** Days in the program (typically 7 for a weekly cycle, but any number is supported). */
  days: ProgramDayInput[];
}

export interface SetValue {
  weight: number;
  fullReps: number;
  partialReps?: number | null;
  rir?: number | null;
  distance?: number | null;
  durationSeconds?: number | null;
  restTimerSeconds: number; // converted from microseconds
  isSkipped: boolean;
}

export interface WorkoutSet {
  setType: 'warmUp' | 'standard' | 'failure';
  target?: SetTarget | null;
  value: SetValue;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  exerciseName?: string; // resolved from exercise DB
  baseWeight: number | null;
  note: string;
  sets: WorkoutSet[];
}

export interface WorkoutBlock {
  exercises: WorkoutExercise[];
}

export interface WorkoutSummary {
  id: string;
  name: string;
  startTime: string;
  durationSeconds: number;
  gymId?: string;
  gymName?: string;
  gymIcon?: string;
  programName?: string;
  exerciseCount: number;
  setCount: number;
}

export interface WorkoutDetail extends WorkoutSummary {
  workoutSource?: WorkoutSource;
  blocks: WorkoutBlock[];
}

export interface GymProfile {
  id: string;
  name: string;
  icon: string;
  weightUnit: 'kgs' | 'lbs';
  createdAt?: string;
  selectedEquipmentIds: string[];
  equipmentNames?: string[];
  useBumperPlatesInPlateCalculator?: boolean;
  allowMixedUnitsInPlateCalculator?: boolean;
  offsetWeightInPlateCalculator?: number;
  alwaysShowExercises: string[];
  alwaysHideExercises: string[];
}

export interface CustomExercise {
  id: string;
  name: string;
  archived: boolean;
  bodyweight: number;
  exerciseType?: string;
  primaryMuscle: string[];
  secondaryMuscle: string[];
  primaryFeatureMuscle: string[];
  secondaryFeatureMuscle: string[];
  regionTrained?: string;
  laterality: string[];
  exerciseMetrics: string[];
  resistanceEquipmentGroups: { equipmentIds: string[] }[];
  supportEquipmentGroups: { equipmentIds: string[] }[];
}

// ---------------------------------------------------------------------------
// Custom workouts ("workout plan" feature in the app)
//
// Path: users/{uid}/customWorkouts/{uuid}
// Doc shape: { id, workoutPlan: { name, gymId, blocks } }
//
// Each customWorkout's UUID must also be added to the workout profile's
// `workoutLibraryIds` array for it to appear in the app's library tab.
// ---------------------------------------------------------------------------

export interface PlanSetLog {
  /** Lower bound of the rep target. null when no rep target is set. */
  minFullReps: number | null;
  /** Upper bound of the rep target. null when no rep target is set. */
  maxFullReps: number | null;
  /** Reps-in-reserve target. null when not prescribed. */
  rir: number | null;
  /** Rest timer override in microseconds. null = use app default. */
  restTimer: number | null;
  /** Distance target (cardio). null when not prescribed. */
  distance: number | null;
  /** Duration target in seconds (timed exercises). null when not prescribed. */
  durationSeconds: number | null;
  /** Optional prescribed weight in kg. null when not prescribed. */
  weight: number | null;
}

export interface PlanSet {
  setType: 'standard' | 'warmUp' | 'failure';
  /** Always [] for plan sets — reserved for set-modifier segments (drop sets etc). */
  segments: unknown[];
  log: PlanSetLog;
}

export interface PlanExerciseTarget {
  /** When true, restTimer values on individual sets override the gym defaults. */
  overrideRestTimers: boolean;
  sets: PlanSet[];
}

export interface PlanExercise {
  /** UUID for this exercise instance within the plan. */
  id: string;
  /** 32-char hex (bundled exercise) or UUID (custom exercise). */
  exerciseId: string;
  /** Resolved name (added by client when reading; not stored in Firestore). */
  exerciseName?: string;
  target: PlanExerciseTarget;
  /** Optional per-exercise note. */
  note?: string;
}

export interface PlanBlock {
  /** UUID for this block. Multiple exercises in one block = superset. */
  id: string;
  exercises: PlanExercise[];
}

export interface WorkoutPlan {
  /** Display name for the plan (shown in the app's library). */
  name: string;
  /** Gym profile UUID this plan is associated with. */
  gymId: string;
  blocks: PlanBlock[];
}

export interface CustomWorkout {
  /** UUID matching the Firestore document id. */
  id: string;
  workoutPlan: WorkoutPlan;
}
