export interface ScaleEntry {
  date: string;
  weight: number;
  bodyFat?: number;
  source?: string;
}

export interface NutritionSummary {
  date: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  sugar?: number;
  fiber?: number;
  source?: string;
}

export interface FoodServing {
  description: string;
  amount: number;
  gramWeight: number;
}

export interface SearchFoodResult {
  foodId: string;
  name: string;
  brand?: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  defaultServing?: FoodServing;
  servings: FoodServing[];
  imageId?: string;
  nutrientsPer100g: Record<string, number>;
  source?: string;
  branded: boolean;
}

export class FoodEntry {
  date: string;
  entryId: string;
  name?: string;
  brand?: string;
  caloriesRaw?: number;
  proteinRaw?: number;
  carbsRaw?: number;
  fatRaw?: number;
  servingGrams?: number;
  userQty?: number;
  unitWeight?: number;
  quantity?: number;
  servingUnit?: string;
  hour?: string;
  minute?: string;
  sourceType?: string;
  foodId?: string;
  deleted?: boolean;
  imageId?: string;

  constructor(data: {
    date: string;
    entryId: string;
    name?: string;
    brand?: string;
    caloriesRaw?: number;
    proteinRaw?: number;
    carbsRaw?: number;
    fatRaw?: number;
    servingGrams?: number;
    userQty?: number;
    unitWeight?: number;
    quantity?: number;
    servingUnit?: string;
    hour?: string;
    minute?: string;
    sourceType?: string;
    foodId?: string;
    deleted?: boolean;
    imageId?: string;
  }) {
    this.date = data.date;
    this.entryId = data.entryId;
    this.name = data.name;
    this.brand = data.brand;
    this.caloriesRaw = data.caloriesRaw;
    this.proteinRaw = data.proteinRaw;
    this.carbsRaw = data.carbsRaw;
    this.fatRaw = data.fatRaw;
    this.servingGrams = data.servingGrams;
    this.userQty = data.userQty;
    this.unitWeight = data.unitWeight;
    this.quantity = data.quantity;
    this.servingUnit = data.servingUnit;
    this.hour = data.hour;
    this.minute = data.minute;
    this.sourceType = data.sourceType;
    this.foodId = data.foodId;
    this.deleted = data.deleted;
    this.imageId = data.imageId;
  }

  /** (userQty * unitWeight) / servingGrams — defaults to 1 when data is missing */
  multiplier(): number {
    const sg = this.servingGrams;
    if (!sg || sg === 0) return 1;
    const uq = this.userQty ?? 1;
    const uw = this.unitWeight ?? sg;
    return (uq * uw) / sg;
  }

  calories(): number {
    return (this.caloriesRaw ?? 0) * this.multiplier();
  }

  protein(): number {
    return (this.proteinRaw ?? 0) * this.multiplier();
  }

  carbs(): number {
    return (this.carbsRaw ?? 0) * this.multiplier();
  }

  fat(): number {
    return (this.fatRaw ?? 0) * this.multiplier();
  }

  weightGrams(): number {
    return (this.servingGrams ?? 0) * this.multiplier();
  }
}

export interface StepEntry {
  date: string;
  steps: number;
  source?: string;
}

export interface Goals {
  calories: number[];
  protein: number[];
  carbs: number[];
  fat: number[];
  tdee?: number;
  programStyle?: string;
  programType?: string;
}

export interface UserProfile {
  id: string;
  name?: string;
  email?: string;
  sex?: string;
  dob?: string;
  height?: number;
  heightUnits?: string;
  weightUnits?: string;
  calorieUnits?: string;
}

export interface AuthTokens {
  idToken: string;
  refreshToken: string;
  expiresAt: number;
}
