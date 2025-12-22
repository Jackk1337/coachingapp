import { ai } from './genkit';
import { googleAI } from '@genkit-ai/googleai';
import { WeeklyData } from './weeklyDataCollector';

/**
 * Formats weekly data into a structured string for AI analysis
 */
function formatWeeklyDataForAI(data: WeeklyData): string {
  const { weeklyCheckin, dailyCheckins, foodDiaries, workoutLogs, cardioLogs, waterLogs, userProfile } = data;

  let formatted = '=== WEEKLY DATA SUMMARY ===\n\n';

  // User Profile & Goals
  if (userProfile) {
    formatted += 'USER PROFILE:\n';
    formatted += `- Coach ID: ${userProfile.coachId || 'AI Coach'}\n`;
    formatted += `- Goal Type: ${userProfile.goals?.goalType || 'Not set'}\n`;
    formatted += `- Calorie Limit: ${userProfile.goals?.calorieLimit || 'Not set'}\n`;
    formatted += `- Protein Goal: ${userProfile.goals?.proteinGoal || 'Not set'}g\n`;
    formatted += `- Workout Sessions Goal: ${userProfile.goals?.workoutSessionsPerWeek || 'Not set'} per week\n`;
    formatted += `- Cardio Sessions Goal: ${userProfile.goals?.cardioSessionsPerWeek || 'Not set'} per week\n`;
    formatted += `- Water Goal: ${userProfile.goals?.waterGoal || 'Not set'}L per day\n`;
    formatted += `- Starting Weight: ${userProfile.goals?.startingWeight || 'Not set'}kg\n\n`;
  }

  // Weekly Checkin
  if (weeklyCheckin) {
    formatted += 'WEEKLY CHECKIN RESPONSES:\n';
    formatted += `- Average Weight: ${weeklyCheckin.averageWeight || 'N/A'}kg\n`;
    formatted += `- Average Steps: ${weeklyCheckin.averageSteps || 'N/A'}\n`;
    formatted += `- Average Sleep: ${weeklyCheckin.averageSleep || 'N/A'} hours\n`;
    formatted += `- Workout Goal: ${weeklyCheckin.workoutGoalAchieved || 'N/A'}\n`;
    formatted += `- Cardio Goal: ${weeklyCheckin.cardioGoalAchieved || 'N/A'}\n`;
    formatted += `- Appetite: ${weeklyCheckin.appetite || 'Not provided'}\n`;
    formatted += `- Energy Levels: ${weeklyCheckin.energyLevels || 'Not provided'}\n`;
    formatted += `- Workouts: ${weeklyCheckin.workouts || 'Not provided'}\n`;
    formatted += `- Digestion: ${weeklyCheckin.digestion || 'Not provided'}\n`;
    formatted += `- Proud Achievement: ${weeklyCheckin.proudAchievement || 'Not provided'}\n`;
    formatted += `- Hardest Part: ${weeklyCheckin.hardestPart || 'Not provided'}\n`;
    formatted += `- Social Events: ${weeklyCheckin.socialEvents || 'Not provided'}\n`;
    formatted += `- Confidence Next Week: ${weeklyCheckin.confidenceNextWeek || 'Not provided'}\n`;
    formatted += `- Schedule Next Week: ${weeklyCheckin.scheduleNextWeek || 'Not provided'}\n`;
    formatted += `- Habit to Improve: ${weeklyCheckin.habitToImprove || 'Not provided'}\n\n`;
  }

  // Daily Checkins Summary
  if (dailyCheckins.length > 0) {
    formatted += `DAILY CHECKINS (${dailyCheckins.length} days logged):\n`;
    const weights: number[] = [];
    const steps: number[] = [];
    const sleep: number[] = [];
    let trainedDays = 0;
    let cardioDays = 0;
    let calorieGoalMetDays = 0;
    const startingWeight = userProfile?.goals?.startingWeight;
    
    dailyCheckins.forEach((checkin: any) => {
      const weight = checkin.currentWeight;
      const step = checkin.stepCount;
      const sleepHours = checkin.hoursOfSleep;
      
      if (weight && !isNaN(Number(weight))) weights.push(Number(weight));
      if (step && !isNaN(Number(step))) steps.push(Number(step));
      if (sleepHours && !isNaN(Number(sleepHours))) sleep.push(Number(sleepHours));
      
      if (checkin.trainedToday === 'Yes') trainedDays++;
      if (checkin.cardioToday === 'Yes') cardioDays++;
      if (checkin.calorieGoalMet === 'Yes') calorieGoalMetDays++;
      
      formatted += `- ${checkin.date}: Weight ${weight || 'N/A'}kg, Steps ${step || 'N/A'}, Sleep ${sleepHours || 'N/A'}h, Trained: ${checkin.trainedToday || 'N/A'}, Cardio: ${checkin.cardioToday || 'N/A'}, Calories: ${checkin.calorieGoalMet || 'N/A'}\n`;
    });
    
    formatted += `\nDAILY CHECKIN SUMMARY:\n`;
    if (weights.length > 0) {
      const avgWeight = (weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1);
      const minWeight = Math.min(...weights).toFixed(1);
      const maxWeight = Math.max(...weights).toFixed(1);
      const weightChange = startingWeight ? ((weights[weights.length - 1] - startingWeight)).toFixed(1) : 'N/A';
      formatted += `- Weight: Avg ${avgWeight}kg, Range ${minWeight}-${maxWeight}kg${startingWeight ? `, Change from start: ${weightChange.startsWith('-') ? '' : '+'}${weightChange}kg` : ''}\n`;
    }
    if (steps.length > 0) {
      const avgSteps = Math.round(steps.reduce((a, b) => a + b, 0) / steps.length);
      const minSteps = Math.min(...steps);
      const maxSteps = Math.max(...steps);
      formatted += `- Steps: Avg ${avgSteps}, Range ${minSteps}-${maxSteps}\n`;
    }
    if (sleep.length > 0) {
      const avgSleep = (sleep.reduce((a, b) => a + b, 0) / sleep.length).toFixed(1);
      const minSleep = Math.min(...sleep).toFixed(1);
      const maxSleep = Math.max(...sleep).toFixed(1);
      formatted += `- Sleep: Avg ${avgSleep}h, Range ${minSleep}-${maxSleep}h\n`;
    }
    formatted += `- Training Adherence: ${trainedDays}/${dailyCheckins.length} days (${((trainedDays / dailyCheckins.length) * 100).toFixed(0)}%)\n`;
    formatted += `- Cardio Adherence: ${cardioDays}/${dailyCheckins.length} days (${((cardioDays / dailyCheckins.length) * 100).toFixed(0)}%)\n`;
    formatted += `- Calorie Goal Adherence: ${calorieGoalMetDays}/${dailyCheckins.length} days (${((calorieGoalMetDays / dailyCheckins.length) * 100).toFixed(0)}%)\n`;
    formatted += '\n';
  }

  // Food Diaries Summary
  if (foodDiaries.length > 0) {
    formatted += `FOOD DIARIES (${foodDiaries.length} days logged):\n`;
    const calorieGoal = userProfile?.goals?.calorieLimit || 0;
    const proteinGoal = userProfile?.goals?.proteinGoal || 0;
    const carbGoal = userProfile?.goals?.carbGoal || 0;
    const fatGoal = userProfile?.goals?.fatGoal || 0;
    
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let daysMetCalorieGoal = 0;
    
    foodDiaries.forEach((diary: any) => {
      const calories = diary.totalCalories || 0;
      const protein = diary.totalProtein || 0;
      const carbs = diary.totalCarbs || 0;
      const fat = diary.totalFat || 0;
      
      totalCalories += calories;
      totalProtein += protein;
      totalCarbs += carbs;
      totalFat += fat;
      
      if (calorieGoal > 0 && calories >= calorieGoal * 0.9 && calories <= calorieGoal * 1.1) {
        daysMetCalorieGoal++;
      }
      
      const calorieDiff = calorieGoal > 0 ? ((calories - calorieGoal) / calorieGoal * 100).toFixed(1) : 'N/A';
      formatted += `- ${diary.date}: ${calories} cal (${calorieDiff !== 'N/A' ? (calorieDiff.startsWith('-') ? '' : '+') + calorieDiff + '%' : 'N/A'} vs goal), ${protein}g protein, ${carbs}g carbs, ${fat}g fat\n`;
    });
    
    const avgCalories = (totalCalories / foodDiaries.length).toFixed(0);
    const avgProtein = (totalProtein / foodDiaries.length).toFixed(1);
    const avgCarbs = (totalCarbs / foodDiaries.length).toFixed(1);
    const avgFat = (totalFat / foodDiaries.length).toFixed(1);
    const calorieGoalMetPct = calorieGoal > 0 ? ((daysMetCalorieGoal / foodDiaries.length) * 100).toFixed(0) : 'N/A';
    
    formatted += `\nFOOD DIARY SUMMARY:\n`;
    formatted += `- Average Daily Calories: ${avgCalories} (Goal: ${calorieGoal || 'Not set'})\n`;
    formatted += `- Average Daily Protein: ${avgProtein}g (Goal: ${proteinGoal || 'Not set'}g)\n`;
    formatted += `- Average Daily Carbs: ${avgCarbs}g (Goal: ${carbGoal || 'Not set'}g)\n`;
    formatted += `- Average Daily Fat: ${avgFat}g (Goal: ${fatGoal || 'Not set'}g)\n`;
    formatted += `- Days Met Calorie Goal (±10%): ${daysMetCalorieGoal}/${foodDiaries.length} (${calorieGoalMetPct}%)\n`;
    formatted += '\n';
  }

  // Workout Logs Summary
  if (workoutLogs.length > 0) {
    const workoutGoal = userProfile?.goals?.workoutSessionsPerWeek || 0;
    const completedWorkouts = workoutLogs.filter((log: any) => log.status === 'completed').length;
    const workoutGoalPct = workoutGoal > 0 ? ((completedWorkouts / workoutGoal) * 100).toFixed(0) : 'N/A';
    
    formatted += `WORKOUT LOGS (${workoutLogs.length} sessions, ${completedWorkouts} completed):\n`;
    workoutLogs.forEach((log: any) => {
      formatted += `- ${log.date}: ${log.routineName || 'Workout'} (Status: ${log.status || 'N/A'})\n`;
    });
    formatted += `\nWORKOUT SUMMARY:\n`;
    formatted += `- Completed: ${completedWorkouts} sessions\n`;
    formatted += `- Weekly Goal: ${workoutGoal || 'Not set'} sessions\n`;
    formatted += `- Goal Achievement: ${workoutGoalPct !== 'N/A' ? workoutGoalPct + '%' : 'N/A'}\n`;
    formatted += '\n';
  }

  // Cardio Logs Summary
  if (cardioLogs.length > 0) {
    const cardioGoal = userProfile?.goals?.cardioSessionsPerWeek || 0;
    const totalCardioMinutes = cardioLogs.reduce((sum: number, log: any) => sum + (log.time || 0), 0);
    const totalCardioCalories = cardioLogs.reduce((sum: number, log: any) => sum + (log.calories || 0), 0);
    const avgHeartRate = cardioLogs.filter((log: any) => log.avgHeartRate).length > 0
      ? Math.round(cardioLogs.reduce((sum: number, log: any) => sum + (log.avgHeartRate || 0), 0) / cardioLogs.filter((log: any) => log.avgHeartRate).length)
      : 'N/A';
    const avgSessionDuration = (totalCardioMinutes / cardioLogs.length).toFixed(0);
    const cardioGoalPct = cardioGoal > 0 ? ((cardioLogs.length / cardioGoal) * 100).toFixed(0) : 'N/A';
    
    formatted += `CARDIO LOGS (${cardioLogs.length} sessions):\n`;
    cardioLogs.forEach((log: any) => {
      formatted += `- ${log.date}: ${log.name || 'Cardio'} - ${log.time || 0} min, ${log.calories || 0} calories, HR ${log.avgHeartRate || 'N/A'} bpm\n`;
    });
    formatted += `\nCARDIO SUMMARY:\n`;
    formatted += `- Total Sessions: ${cardioLogs.length}\n`;
    formatted += `- Weekly Goal: ${cardioGoal || 'Not set'} sessions\n`;
    formatted += `- Goal Achievement: ${cardioGoalPct !== 'N/A' ? cardioGoalPct + '%' : 'N/A'}\n`;
    formatted += `- Total Minutes: ${totalCardioMinutes}\n`;
    formatted += `- Average Session Duration: ${avgSessionDuration} minutes\n`;
    formatted += `- Total Calories Burned: ${totalCardioCalories}\n`;
    formatted += `- Average Heart Rate: ${avgHeartRate}${avgHeartRate !== 'N/A' ? ' bpm' : ''}\n`;
    formatted += '\n';
  }

  // Water Logs Summary
  if (waterLogs.length > 0) {
    const waterGoal = userProfile?.goals?.waterGoal || 0;
    const totalWaterML = waterLogs.reduce((sum: number, log: any) => sum + (log.totalML || 0), 0);
    const avgWaterLiters = (totalWaterML / waterLogs.length / 1000).toFixed(2);
    const daysMetWaterGoal = waterGoal > 0 
      ? waterLogs.filter((log: any) => (log.totalML || 0) >= waterGoal * 1000).length 
      : 0;
    const waterGoalPct = waterGoal > 0 ? ((daysMetWaterGoal / waterLogs.length) * 100).toFixed(0) : 'N/A';
    
    formatted += `WATER LOGS (${waterLogs.length} days logged):\n`;
    waterLogs.forEach((log: any) => {
      const liters = (log.totalML || 0) / 1000;
      formatted += `- ${log.date}: ${liters.toFixed(2)}L\n`;
    });
    formatted += `\nWATER SUMMARY:\n`;
    formatted += `- Average Daily Intake: ${avgWaterLiters}L\n`;
    formatted += `- Daily Goal: ${waterGoal || 'Not set'}L\n`;
    formatted += `- Days Met Goal: ${daysMetWaterGoal}/${waterLogs.length} (${waterGoalPct !== 'N/A' ? waterGoalPct + '%' : 'N/A'})\n`;
    formatted += '\n';
  }

  return formatted;
}

/**
 * Generates a personalized coaching message based on weekly data
 */
/**
 * Retry function with exponential backoff for rate limit errors
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit = error?.message?.includes('429') || 
                         error?.status === 429 ||
                         error?.code === 'resource_exhausted' ||
                         error?.message?.toLowerCase().includes('rate limit') ||
                         error?.message?.toLowerCase().includes('too many requests');
      
      if (isRateLimit && attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Rate limit hit. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

export async function generateCoachingMessage(
  data: WeeklyData,
  coachName: string = 'AI Coach',
  coachPersona: string = ''
): Promise<{ subject: string; body: string }> {
  const formattedData = formatWeeklyDataForAI(data);

  // Build persona instruction
  const personaInstruction = coachPersona 
    ? `\n\nIMPORTANT: Adopt the persona of ${coachName}. ${coachPersona}\n\nYour coaching style, tone, and approach should reflect this persona while maintaining professionalism and providing expert fitness and nutrition guidance.`
    : '';

  const prompt = `You are the AI Coach "${coachName}", adopt their persona.${personaInstruction}

CRITICAL: The client's primary goal is "${data.userProfile?.goals?.goalType || 'Not specified'}". ALL of your feedback must be tailored to support this specific goal. Whether they're trying to lose weight, gain strength, or gain weight, your recommendations should align with their goal type.

Provide thoughtful, personalized analysis with actionable insights. Focus on patterns, trends, and qualitative observations rather than overwhelming with numbers and percentages. Use data to inform your feedback, but communicate it in a natural, conversational way.

Analyze the following weekly data from your client:

${formattedData}

IMPORTANT: Structure your coaching message with the following sections in this exact order. Each section should be thoughtful and personalized:

Start with a warm greeting (2-3 sentences) - address the client by name if available, reference the specific week being reviewed, and set a warm, professional tone. Do NOT use a header for this greeting - just begin the message naturally.

1. **Food Diary Feedback** (150-250 words minimum)
   REQUIRED ANALYSIS:
   - Review their nutrition patterns in relation to their "${data.userProfile?.goals?.goalType || 'goal'}" goal
   - Analyze consistency: Are they logging regularly? Are they generally meeting their calorie goals?
   - Identify patterns: Are there days that stand out (significantly over/under)? What trends do you notice?
   - Macro balance: Comment on protein, carbs, and fats in relation to their goal type
   - Provide specific, actionable recommendations tailored to their goal type
   - Focus on quality and patterns rather than exact numbers

3. **Workout Log Feedback** (150-200 words minimum)
   REQUIRED ANALYSIS:
   - Review their workout consistency in relation to their "${data.userProfile?.goals?.goalType || 'goal'}" goal
   - Comment on how many workouts they completed vs. their goal
   - Analyze workout distribution: Are they training consistently throughout the week?
   - Identify patterns: Are workouts well-distributed or clustered together?
   - Comment on routine variety, progression, or consistency if data is available
   - Provide recommendations tailored to their goal type (e.g., strength training focus for "Gain Strength", cardio balance for "Lose Weight")

4. **Cardio Log Feedback** (100-150 words minimum)
   REQUIRED ANALYSIS:
   - Review cardio frequency and how it supports their "${data.userProfile?.goals?.goalType || 'goal'}" goal
   - Comment on consistency: Are they meeting their cardio goals?
   - Analyze intensity and duration patterns if data is available
   - Identify distribution: Are cardio sessions spread throughout the week?
   - Provide recommendations tailored to their goal type (more cardio for weight loss, balanced approach for strength, etc.)

5. **Daily Checkin Log Feedback** (200-300 words minimum)
   REQUIRED ANALYSIS:
   - Weight trends: Comment on weight changes in relation to their "${data.userProfile?.goals?.goalType || 'goal'}" goal (is the trend appropriate for their goal?)
   - Step count patterns: Review consistency and activity levels
   - Sleep quality: Identify sleep patterns and how they might be affecting progress
   - Training adherence: Comment on consistency with workouts and cardio
   - Calorie goal adherence: Review how consistently they're meeting their nutrition goals
   - CORRELATION ANALYSIS: Identify relationships between metrics (e.g., better sleep correlating with better nutrition adherence)
   - Specific insights: What patterns emerge? What days were strongest/weakest?

6. **Weekly Checkin Log Feedback** (200-250 words minimum)
   REQUIRED ANALYSIS:
   - Address EACH reflection question with specific, thoughtful responses:
     * Appetite: Analyze their response in context of their food diary and weight trends
     * Energy Levels: Correlate with sleep, training, and nutrition data
     * Workouts: Connect their reflection to actual workout log data
     * Digestion: Provide specific advice based on their food diary patterns
     * Proud Achievement: Celebrate with specific details and context
     * Hardest Part: Provide empathetic support with actionable solutions
     * Social Events: Address how they navigated challenges
     * Confidence: Validate and provide specific reasons for confidence
     * Schedule Next Week: Offer specific planning advice
     * Habit to Improve: Provide a detailed action plan with specific steps
   - Reference their actual responses and connect them to data patterns

7. **Overall Feedback** (150-200 words minimum)
   REQUIRED SYNTHESIS:
   - Summarize top 3-4 key wins and progress made
   - Identify 2-3 main areas needing focus next week, specifically related to their "${data.userProfile?.goals?.goalType || 'goal'}" goal
   - Comment on overall progress toward their primary goal (weight, strength, etc.)
   - Provide a clear action plan for next week with 3-5 specific, actionable steps tailored to their goal type
   - Reference their goals and show how they're progressing
   - End with personalized encouragement tied to their specific journey and goal

ANALYSIS REQUIREMENTS:
- ALWAYS consider their goal type ("${data.userProfile?.goals?.goalType || 'Not specified'}") when providing feedback
- Focus on patterns, trends, and qualitative observations rather than overwhelming with exact numbers
- Compare progress to their stated goals in a natural, conversational way
- Identify trends (increasing/decreasing/stable) and what they mean for their goal
- Find correlations between different metrics
- Provide specific, actionable recommendations tailored to their goal type (not generic advice)
- Reference data points from their logs when relevant, but don't over-emphasize calculations
- Be warm, encouraging, and supportive while maintaining analytical depth

Tone: Be warm, supportive, professional, and encouraging. Communicate insights naturally without overwhelming with numbers. Make it personal, actionable, and goal-focused. Tailor all advice to support their specific goal type.

Format your response as JSON with "subject" and "body" fields. The body should start with a natural greeting (no header), then use clear section headers (## Header Name) for each feedback section. Be well-formatted with line breaks between sections. Each section should be substantial and detailed.`;

  try {
    // Use retry logic for rate limit errors
    const response = await retryWithBackoff(async () => {
      return await ai.generate(prompt);
    }, 3, 2000); // 3 retries, starting with 2 second delay

    const responseText = response.text;
    
    // Try to parse JSON response
    try {
      const parsed = JSON.parse(responseText);
      return {
        subject: parsed.subject || 'Your Weekly Coaching Update',
        body: parsed.body || responseText,
      };
    } catch (parseError) {
      // If not JSON, extract subject from first line or use default
      // Don't make another API call to avoid rate limits
      const lines = responseText.split('\n');
      const firstLine = lines[0]?.trim() || '';
      const subject = firstLine.length <= 60 && firstLine.length > 0 
        ? firstLine.replace(/^#+\s*/, '').slice(0, 60)
        : 'Your Weekly Coaching Update';
      
      return {
        subject,
        body: responseText,
      };
    }
  } catch (error: any) {
    console.error('Error generating coaching message:', error);
    
    // Check if it's a rate limit error
    const isRateLimit = error?.message?.includes('429') || 
                       error?.status === 429 ||
                       error?.code === 'resource_exhausted' ||
                       error?.message?.toLowerCase().includes('rate limit') ||
                       error?.message?.toLowerCase().includes('too many requests');
    
    if (isRateLimit) {
      throw new Error('Rate limit exceeded. Please try again in a few minutes. The API has temporary limits to ensure quality service.');
    }
    
    // Fallback message for other errors
    throw new Error(`Failed to generate coaching message: ${error?.message || 'Unknown error'}`);
  }
}
