/**
 * Rep Calculator Utility
 * Calculates 1RM and weight for different rep ranges based on exercise history
 */

export interface RepCalculation {
  reps: number;
  weight: number;
  estimated1RM: number;
  rpeEstimate?: number; // Estimated RPE for that rep range
}

export interface ExerciseStats {
  estimated1RM: number;
  maxWeight: number;
  maxReps: number;
  bestSet: {
    weight: number;
    reps: number;
    date: string;
  } | null;
}

/**
 * Calculate 1RM using Epley formula
 * 1RM = weight × (1 + reps/30)
 */
export function calculate1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  
  // Epley formula
  return Math.round(weight * (1 + reps / 30));
}

/**
 * Calculate weight for target reps using reverse Epley
 * weight = 1RM / (1 + reps/30)
 */
export function calculateWeightForReps(oneRM: number, targetReps: number): number {
  if (targetReps <= 0 || oneRM <= 0) return 0;
  if (targetReps === 1) return oneRM;
  
  return Math.round(oneRM / (1 + targetReps / 30));
}

/**
 * Estimate RPE based on rep range and percentage of 1RM
 * This is a simplified estimation
 */
export function estimateRPE(weight: number, reps: number, oneRM: number): number {
  if (oneRM <= 0) return 0;
  
  const percentageOf1RM = (weight / oneRM) * 100;
  
  // Rough RPE estimates based on percentage and reps
  if (percentageOf1RM >= 95) return 10; // Max effort
  if (percentageOf1RM >= 90) return 9.5;
  if (percentageOf1RM >= 85) return 9;
  if (percentageOf1RM >= 80) return 8.5;
  if (percentageOf1RM >= 75) return 8;
  if (percentageOf1RM >= 70) return 7.5;
  if (percentageOf1RM >= 65) return 7;
  if (percentageOf1RM >= 60) return 6.5;
  if (percentageOf1RM >= 55) return 6;
  
  // Adjust based on rep range
  if (reps >= 15) return Math.max(5, percentageOf1RM / 10 - 1);
  if (reps >= 10) return Math.max(6, percentageOf1RM / 10);
  
  return Math.max(7, percentageOf1RM / 10 + 1);
}

/**
 * Calculate exercise statistics from history
 */
export function calculateExerciseStats(
  sets: Array<{ weight: number; reps: number; date?: string }>
): ExerciseStats {
  if (!sets || sets.length === 0) {
    return {
      estimated1RM: 0,
      maxWeight: 0,
      maxReps: 0,
      bestSet: null,
    };
  }

  // Filter valid sets
  const validSets = sets.filter(
    (set) => set.weight > 0 && set.reps >= 1
  );

  if (validSets.length === 0) {
    return {
      estimated1RM: 0,
      maxWeight: 0,
      maxReps: 0,
      bestSet: null,
    };
  }

  // Calculate 1RM for each set and take the highest
  const oneRMValues = validSets.map((set) => calculate1RM(set.weight, set.reps));
  const estimated1RM = Math.max(...oneRMValues);

  // Find max weight and reps
  const maxWeight = Math.max(...validSets.map((set) => set.weight));
  const maxReps = Math.max(...validSets.map((set) => set.reps));

  // Find best set (highest estimated 1RM)
  let bestSet = validSets[0];
  let best1RM = calculate1RM(validSets[0].weight, validSets[0].reps);
  
  for (const set of validSets) {
    const set1RM = calculate1RM(set.weight, set.reps);
    if (set1RM > best1RM) {
      best1RM = set1RM;
      bestSet = set;
    }
  }

  return {
    estimated1RM,
    maxWeight,
    maxReps,
    bestSet: bestSet
      ? {
          weight: bestSet.weight,
          reps: bestSet.reps,
          date: bestSet.date || "",
        }
      : null,
  };
}

/**
 * Generate rep calculations for common rep ranges
 */
export function generateRepCalculations(
  oneRM: number,
  repRanges: number[] = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20]
): RepCalculation[] {
  return repRanges.map((reps) => {
    const weight = calculateWeightForReps(oneRM, reps);
    const rpeEstimate = estimateRPE(weight, reps, oneRM);
    
    return {
      reps,
      weight,
      estimated1RM: oneRM,
      rpeEstimate: Math.round(rpeEstimate * 10) / 10, // Round to 1 decimal
    };
  });
}

