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
  minFullReps?: number | null;
  maxFullReps?: number | null;
  rir?: number | null;
  distance?: number | null;
  durationSeconds?: number | null;
  restTimer?: number | null;
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
