/**
 * TDEE Calculator using Mifflin-St Jeor formula
 */

export type ActivityLevel = "Sedentary" | "Lightly Active" | "Moderately Active" | "Very Active" | "Extremely Active";
export type GoalType = "Lose Weight" | "Gain Weight" | "Gain Strength";
export type Gender = "Male" | "Female";

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  "Sedentary": 1.2,
  "Lightly Active": 1.375,
  "Moderately Active": 1.55,
  "Very Active": 1.725,
  "Extremely Active": 1.9,
};

interface MacroGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Calculate BMR using Mifflin-St Jeor formula
 * @param weight Weight in kg
 * @param height Height in cm
 * @param age Age in years
 * @param gender Gender (Male or Female)
 * @returns BMR in calories per day
 */
export function calculateBMR(weight: number, height: number, age: number, gender: Gender): number {
  if (gender === "Male") {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    return 10 * weight + 6.25 * height - 5 * age - 161;
  }
}

/**
 * Calculate TDEE (Total Daily Energy Expenditure)
 * @param bmr Basal Metabolic Rate
 * @param activityLevel Activity level
 * @returns TDEE in calories per day
 */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel];
  return Math.round(bmr * multiplier);
}

/**
 * Calculate macro goals based on TDEE and goal type
 * @param tdee Total Daily Energy Expenditure
 * @param goalType Goal type (Lose Weight, Gain Weight, Gain Strength)
 * @param weight Weight in kg (for protein calculation)
 * @returns Macro goals object
 */
export function calculateMacros(
  tdee: number,
  goalType: GoalType,
  weight: number
): MacroGoals {
  let targetCalories: number;
  let proteinPerKg: number;
  let carbPercentage: number;
  let fatPercentage: number;

  switch (goalType) {
    case "Lose Weight":
      targetCalories = tdee - 500; // 500 cal deficit
      proteinPerKg = 2.2;
      carbPercentage = 0.4; // 40% carbs
      fatPercentage = 0.3; // 30% fat
      break;
    case "Gain Weight":
      targetCalories = tdee + 500; // 500 cal surplus
      proteinPerKg = 2.2;
      carbPercentage = 0.45; // 45% carbs
      fatPercentage = 0.25; // 25% fat
      break;
    case "Gain Strength":
      targetCalories = tdee + 300; // 300 cal surplus
      proteinPerKg = 2.5;
      carbPercentage = 0.5; // 50% carbs (higher for strength)
      fatPercentage = 0.2; // 20% fat
      break;
  }

  // Calculate protein in grams
  const proteinGrams = Math.round(weight * proteinPerKg);

  // Calculate protein calories
  const proteinCalories = proteinGrams * 4;

  // Calculate remaining calories for carbs and fat
  const remainingCalories = targetCalories - proteinCalories;

  // Calculate carbs and fat in grams
  const carbCalories = Math.round(remainingCalories * carbPercentage);
  const fatCalories = Math.round(remainingCalories * fatPercentage);

  const carbGrams = Math.round(carbCalories / 4);
  const fatGrams = Math.round(fatCalories / 9);

  return {
    calories: Math.round(targetCalories),
    protein: proteinGrams,
    carbs: carbGrams,
    fat: fatGrams,
  };
}

/**
 * Calculate complete TDEE and macros in one function
 * @param weight Weight in kg
 * @param height Height in cm
 * @param age Age in years
 * @param gender Gender
 * @param activityLevel Activity level
 * @param goalType Goal type
 * @returns Complete macro goals
 */
export function calculateCompleteMacros(
  weight: number,
  height: number,
  age: number,
  gender: Gender,
  activityLevel: ActivityLevel,
  goalType: GoalType
): MacroGoals {
  const bmr = calculateBMR(weight, height, age, gender);
  const tdee = calculateTDEE(bmr, activityLevel);
  return calculateMacros(tdee, goalType, weight);
}

