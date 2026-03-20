// src/lib/api/exercises.ts
import exerciseData from '../../../data/exercises.json';

export interface ExerciseEntity {
  type: string;
  name: string;
  name_jp?: string | null;
  [key: string]: unknown;
}

export interface Exercise {
  id: string;
  name: string;
  name_jp?: string | null;
  exerciseType?: string;
  primaryFeatureMuscle: string[];
  secondaryFeatureMuscle: string[];
  regionTrained?: string;
  laterality: string[];
  exerciseMetrics: string[];
  resistanceEquipmentGroupIds: string[];
  supportEquipmentGroupIds: string[];
  recommendationLevelStrength?: number;
  recommendationLevelHypertrophy?: number;
  bodyweight: number;
  [key: string]: unknown;
}

const uuidIndex = exerciseData.uuidIndex as unknown as Record<string, ExerciseEntity>;
const exercises = exerciseData.exercises as unknown as Exercise[];
const exerciseById = new Map(exercises.map((e) => [e.id, e]));

/** Resolve any hex ID (exercise, muscle, equipment, etc.) to its entity. */
export function lookupEntity(hexId: string): ExerciseEntity | null {
  return uuidIndex[hexId] ?? null;
}

/** Resolve a hex ID to its human-readable name. Returns the ID itself if not found. */
export function resolveName(hexId: string): string {
  return uuidIndex[hexId]?.name ?? hexId;
}

/** Look up a full exercise by hex ID. */
export function lookupExercise(hexId: string): Exercise | null {
  return exerciseById.get(hexId) ?? null;
}

/** Search exercises by name (case-insensitive substring match). */
export function searchExercises(query: string): Exercise[] {
  const q = query.toLowerCase();
  return exercises.filter((e) => e.name.toLowerCase().includes(q));
}

/** Get all exercises. */
export function getAllExercises(): Exercise[] {
  return exercises;
}

/** Resolve an exercise, returning its name and resolved muscle groups. */
export function resolveExercise(hexId: string): {
  name: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  region: string;
  type: string;
} | null {
  const ex = lookupExercise(hexId);
  if (!ex) return null;
  return {
    name: ex.name,
    primaryMuscles: (ex.primaryFeatureMuscle ?? []).map(resolveName),
    secondaryMuscles: (ex.secondaryFeatureMuscle ?? []).map(resolveName),
    equipment: (ex.resistanceEquipmentGroupIds ?? []).map(resolveName),
    region: resolveName(ex.regionTrained ?? ''),
    type: resolveName(ex.exerciseType ?? ''),
  };
}