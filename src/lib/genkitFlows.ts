import { ai } from './genkit';
import { googleAI } from '@genkit-ai/googleai';
import { WeeklyData } from './weeklyDataCollector';
import { DailyMessageData } from './dailyMessageDataCollector';

/**
 * Formats weekly data into a structured string for AI analysis
 */
function formatWeeklyDataForAI(data: WeeklyData): string {
  const { weeklyCheckin, dailyCheckins, foodDiaries, workoutLogs, cardioLogs, waterLogs, userProfile, previousMessage } = data;

  let formatted = '=== WEEKLY DATA SUMMARY ===\n\n';

  // Previous Week's Coaching Message
  if (previousMessage) {
    formatted += 'PREVIOUS WEEK\'S COACHING MESSAGE:\n';
    formatted += `Subject: ${previousMessage.subject}\n`;
    formatted += `Message Body:\n${previousMessage.body}\n\n`;
    formatted += 'IMPORTANT: Review what you said last week and reference it in your current response. Follow up on specific promises, threats, or challenges you made. Hold them accountable to what you said.\n\n';
  }

  // User Profile & Goals
  if (userProfile) {
    formatted += 'USER PROFILE:\n';
    formatted += `- Coach ID: ${userProfile.coachId || 'AI Coach'}\n`;
    formatted += `- Experience Level: ${userProfile.experienceLevel || 'Not set'}\n`;
    formatted += `- Coach Intensity: ${userProfile.coachIntensity || 'Not set'}\n`;
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
  coachPersona: string = '',
  customIntensityLevels?: {
    Low?: string;
    Medium?: string;
    High?: string;
    Extreme?: string;
  }
): Promise<{ subject: string; body: string }> {
  const formattedData = formatWeeklyDataForAI(data);

  // Build persona instruction
  const personaInstruction = coachPersona 
    ? `\n\nIMPORTANT: Adopt the persona of ${coachName}. ${coachPersona}\n\nYour coaching style, tone, and approach should reflect this persona while maintaining professionalism and providing expert fitness and nutrition guidance.`
    : '';

  // Build experience level instruction
  const experienceLevel = data.userProfile?.experienceLevel || 'Not set';
  let experienceInstruction = '';
  if (experienceLevel === 'Novice') {
    experienceInstruction = '\n\nEXPERIENCE LEVEL: The client is a NOVICE - they are completely new to calorie counting, macros, and the gym. You MUST:\n- Explain ALL concepts thoroughly (what calories are, what macros are, why they matter)\n- Define all terminology (calories, macros, protein, carbs, fats, etc.)\n- Provide basic education and foundational knowledge\n- Break down complex concepts into simple, digestible explanations\n- Assume they know very little and need comprehensive guidance';
  } else if (experienceLevel === 'Beginner') {
    experienceInstruction = '\n\nEXPERIENCE LEVEL: The client is a BEGINNER - they know a little bit about calorie counting, macros, and the gym but still don\'t know what they\'re doing. You MUST:\n- Explain concepts but assume some basic knowledge\n- Can use terminology but should briefly explain when introducing new concepts\n- Provide guidance with moderate detail\n- Help them understand the "why" behind recommendations';
  } else if (experienceLevel === 'Intermediate') {
    experienceInstruction = '\n\nEXPERIENCE LEVEL: The client is INTERMEDIATE - they know about calorie counting, macros, and the gym and require feedback. You MUST:\n- Assume knowledge of basic concepts\n- Focus on optimization, fine-tuning, and advanced strategies\n- Provide detailed feedback without basic explanations\n- Focus on the "how" and "what" rather than the "why"';
  } else if (experienceLevel === 'Advanced') {
    experienceInstruction = '\n\nEXPERIENCE LEVEL: The client is ADVANCED - they know about calorie counting, macros, and the gym and require feedback. You MUST:\n- Provide minimal explanations of basic concepts\n- Focus on advanced strategies, optimization, and fine-tuning\n- Use technical terminology freely\n- Provide sophisticated, nuanced feedback';
  }

  // Build coach intensity instruction - use custom if available, otherwise use default
  const coachIntensity = data.userProfile?.coachIntensity || 'Not set';
  let intensityInstruction = '';
  
  // Check if custom intensity level exists for this intensity
  if (customIntensityLevels && coachIntensity !== 'Not set') {
    const customInstruction = customIntensityLevels[coachIntensity as keyof typeof customIntensityLevels];
    if (customInstruction && customInstruction.trim()) {
      intensityInstruction = `\n\nCOACH INTENSITY: ${coachIntensity.toUpperCase()} - ${customInstruction}`;
    }
  }
  
  // Fall back to default intensity instructions if no custom instruction found
  if (!intensityInstruction) {
    if (coachIntensity === 'Low') {
      intensityInstruction = '\n\nCOACH INTENSITY: LOW - You should be:\n- Supportive, gentle, and understanding\n- Less pushy when goals aren\'t met\n- Focus on encouragement and positive reinforcement\n- Use a softer, more empathetic tone\n- Acknowledge challenges without being demanding';
    } else if (coachIntensity === 'Medium') {
      intensityInstruction = '\n\nCOACH INTENSITY: MEDIUM - You should be:\n- Balanced in your approach\n- Encouraging but firm when needed\n- Hold them accountable while remaining supportive\n- Use a professional, motivational tone\n- Push appropriately but not excessively';
    } else if (coachIntensity === 'High') {
      intensityInstruction = '\n\nCOACH INTENSITY: HIGH - You should be:\n- More direct and assertive\n- Push harder when goals aren\'t met\n- Use strong motivational language\n- Hold them strictly accountable\n- Challenge them to do better\n- Use a more intense, driven tone while remaining professional';
    } else if (coachIntensity === 'Extreme') {
      intensityInstruction = '\n\nCOACH INTENSITY: EXTREME - You should be:\n- Do NOT hold back - be brutally honest and direct\n- SWEARING IS ALLOWED AND ENCOURAGED - use profanity freely (fuck, shit, damn, etc.) to emphasize your points\n- Use harsh, critical language when goals aren\'t met\n- Insult and call out their failures directly with strong language\n- Use aggressive, confrontational language\n- Dig deep into their mistakes and failures\n- Be extremely demanding and unforgiving\n- Use profanity and harsh criticism liberally - this is EXTREME intensity\n- Make them feel the weight of their failures with strong, explicit language\n- Push them relentlessly with no sugar-coating\n- Curse at them when they mess up - be raw and unfiltered';
    }
  }

  const prompt = `You are the AI Coach "${coachName}", adopt their persona.${personaInstruction}

CRITICAL: The client's primary goal is "${data.userProfile?.goals?.goalType || 'Not specified'}". ALL of your feedback must be tailored to support this specific goal. Whether they're trying to lose weight, gain strength, or gain weight, your recommendations should align with their goal type.${experienceInstruction}${intensityInstruction}

Provide thoughtful, personalized analysis with actionable insights. Focus on patterns, trends, and qualitative observations rather than overwhelming with numbers and percentages. Use data to inform your feedback, but communicate it in a natural, conversational way.

Analyze the following weekly data from your client:

${formattedData}

${data.previousMessage ? 'CRITICAL: You have access to your PREVIOUS WEEK\'S COACHING MESSAGE above. You MUST:\n- Reference specific things you said last week (promises, threats, challenges, goals you set)\n- Follow up on whether they met the expectations you set\n- Hold them accountable to what you said\n- If you made specific threats or promises (e.g., "If I see X next week, I\'m going to Y"), address whether they happened\n- Reference your previous coaching style and maintain continuity\n- Build on what you said before - don\'t ignore your previous message\n\n' : ''}IMPORTANT: Structure your coaching message with the following sections in this exact order. Each section should be thoughtful and personalized:

Start with a greeting (2-3 sentences)${data.previousMessage ? ' that references your previous message' : ''} - address the client by name if available, reference the specific week being reviewed${data.previousMessage ? ', and acknowledge what you said last week' : ''}. Set an appropriate tone based on coach intensity. Do NOT use a header for this greeting - just begin the message naturally.

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

    let responseText = response.text;
    
    // Clean up markdown code blocks if present (AI sometimes wraps JSON in ```json ... ```)
    responseText = responseText
      .replace(/^```json\s*/i, '') // Remove opening ```json
      .replace(/^```\s*/i, '') // Remove opening ``` (fallback)
      .replace(/\s*```$/i, '') // Remove closing ```
      .trim();
    
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
    
    // Check if it's an authentication/authorization error (403)
    const isAuthError = error?.status === 403 ||
                       error?.code === 403 ||
                       error?.message?.includes('403') ||
                       error?.message?.toLowerCase().includes('forbidden') ||
                       error?.message?.toLowerCase().includes('permission denied') ||
                       error?.message?.toLowerCase().includes('api key') ||
                       error?.message?.toLowerCase().includes('authentication');
    
    if (isAuthError) {
      const apiKeySet = !!(process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY);
      throw new Error(
        `API authentication failed (403 Forbidden). ` +
        `Please check that your GOOGLE_GENAI_API_KEY is valid and has the correct permissions. ` +
        `API key is ${apiKeySet ? 'set' : 'NOT set'} in environment variables. ` +
        `Error details: ${error?.message || 'Unknown error'}`
      );
    }
    
    // Fallback message for other errors
    throw new Error(`Failed to generate coaching message: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Formats daily message data into a structured string for AI analysis
 */
function formatDailyMessageDataForAI(data: DailyMessageData): string {
  const { currentWeekProgress, lastWeekCheckin, userProfile, goalProgression } = data;

  let formatted = '=== DAILY COACH MESSAGE CONTEXT ===\n\n';

  // User Profile & Goals
  if (userProfile) {
    formatted += 'USER PROFILE:\n';
    formatted += `- Experience Level: ${userProfile.experienceLevel || 'Not set'}\n`;
    formatted += `- Coach Intensity: ${userProfile.coachIntensity || 'Not set'}\n`;
    formatted += `- Goal Type: ${userProfile.goals?.goalType || 'Not set'}\n`;
    formatted += `- Calorie Limit: ${userProfile.goals?.calorieLimit || 'Not set'}\n`;
    formatted += `- Protein Goal: ${userProfile.goals?.proteinGoal || 'Not set'}g per day\n`;
    formatted += `- Workout Sessions Goal: ${userProfile.goals?.workoutSessionsPerWeek || 'Not set'} per week\n`;
    formatted += `- Cardio Sessions Goal: ${userProfile.goals?.cardioSessionsPerWeek || 'Not set'} per week\n`;
    formatted += `- Water Goal: ${userProfile.goals?.waterGoal || 'Not set'}L per day\n\n`;
  }

  // Current Week Progress
  formatted += `CURRENT WEEK PROGRESS (Day ${currentWeekProgress.daysIntoWeek} of 7):\n\n`;

  // Daily Checkins Summary
  if (currentWeekProgress.dailyCheckins.length > 0) {
    formatted += `Daily Checkins: ${currentWeekProgress.dailyCheckins.length} days logged\n`;
    const weights: number[] = [];
    const trainedDays = currentWeekProgress.dailyCheckins.filter(c => c.trainedToday === 'Yes').length;
    const cardioDays = currentWeekProgress.dailyCheckins.filter(c => c.cardioToday === 'Yes').length;
    const calorieGoalMetDays = currentWeekProgress.dailyCheckins.filter(c => c.calorieGoalMet === 'Yes').length;
    
    currentWeekProgress.dailyCheckins.forEach((checkin: any) => {
      const weight = checkin.currentWeight;
      if (weight && !isNaN(Number(weight))) weights.push(Number(weight));
    });
    
    if (weights.length > 0) {
      const avgWeight = (weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1);
      formatted += `- Average Weight: ${avgWeight}kg\n`;
    }
    formatted += `- Training Days: ${trainedDays}/${currentWeekProgress.dailyCheckins.length}\n`;
    formatted += `- Cardio Days: ${cardioDays}/${currentWeekProgress.dailyCheckins.length}\n`;
    formatted += `- Calorie Goal Met Days: ${calorieGoalMetDays}/${currentWeekProgress.dailyCheckins.length}\n\n`;
  }

  // Food Diaries Summary
  if (currentWeekProgress.foodDiaries.length > 0) {
    const calorieGoal = userProfile?.goals?.calorieLimit || 0;
    const totalCalories = currentWeekProgress.foodDiaries.reduce((sum, diary) => sum + (diary.totalCalories || 0), 0);
    const avgDailyCalories = totalCalories / currentWeekProgress.foodDiaries.length;
    const totalProtein = currentWeekProgress.foodDiaries.reduce((sum, diary) => sum + (diary.totalProtein || 0), 0);
    const avgDailyProtein = totalProtein / currentWeekProgress.foodDiaries.length;
    
    formatted += `Food Diaries: ${currentWeekProgress.foodDiaries.length} days logged\n`;
    formatted += `- Average Daily Calories: ${Math.round(avgDailyCalories)} (Goal: ${calorieGoal || 'Not set'})\n`;
    formatted += `- Average Daily Protein: ${Math.round(avgDailyProtein)}g (Goal: ${userProfile?.goals?.proteinGoal || 'Not set'}g)\n\n`;
  }

  // Workout Progress
  const workoutGoal = userProfile?.goals?.workoutSessionsPerWeek || 0;
  const workoutCompleted = currentWeekProgress.workoutLogs.length;
  formatted += `Workout Sessions: ${workoutCompleted} completed (Goal: ${workoutGoal} per week)\n`;
  formatted += `- Progress: ${goalProgression.workoutProgress >= 1 ? 'Goal achieved!' : `${Math.round(goalProgression.workoutProgress * 100)}% of weekly goal`}\n\n`;

  // Cardio Progress
  const cardioGoal = userProfile?.goals?.cardioSessionsPerWeek || 0;
  const cardioCompleted = currentWeekProgress.cardioLogs.length;
  formatted += `Cardio Sessions: ${cardioCompleted} completed (Goal: ${cardioGoal} per week)\n`;
  formatted += `- Progress: ${goalProgression.cardioProgress >= 1 ? 'Goal achieved!' : `${Math.round(goalProgression.cardioProgress * 100)}% of weekly goal`}\n\n`;

  // Last Week's Weekly Checkin (if available)
  if (lastWeekCheckin) {
    formatted += 'LAST WEEK\'S WEEKLY CHECKIN SUMMARY:\n';
    formatted += `- Workout Goal: ${lastWeekCheckin.workoutGoalAchieved || 'N/A'}\n`;
    formatted += `- Cardio Goal: ${lastWeekCheckin.cardioGoalAchieved || 'N/A'}\n`;
    if (lastWeekCheckin.hardestPart) {
      formatted += `- Hardest Part: ${lastWeekCheckin.hardestPart}\n`;
    }
    if (lastWeekCheckin.habitToImprove) {
      formatted += `- Habit to Improve: ${lastWeekCheckin.habitToImprove}\n`;
    }
    if (lastWeekCheckin.confidenceNextWeek) {
      formatted += `- Confidence Next Week: ${lastWeekCheckin.confidenceNextWeek}\n`;
    }
    formatted += '\n';
  }

  // Goal Progression Summary
  formatted += 'GOAL PROGRESSION THIS WEEK:\n';
  formatted += `- Workout Progress: ${Math.round(goalProgression.workoutProgress * 100)}%\n`;
  formatted += `- Cardio Progress: ${Math.round(goalProgression.cardioProgress * 100)}%\n`;
  formatted += `- Calorie Progress: ${Math.round(goalProgression.calorieProgress * 100)}% (avg vs daily goal)\n`;
  formatted += `- Protein Progress: ${Math.round(goalProgression.proteinProgress * 100)}% (avg vs daily goal)\n`;

  return formatted;
}

/**
 * Generates a short, daily motivational coach message (100-200 words)
 * Focuses on current week progress and forward-looking motivation
 */
export async function generateDailyCoachMessage(
  data: DailyMessageData,
  coachName: string = 'AI Coach',
  coachPersona: string = '',
  customIntensityLevels?: {
    Low?: string;
    Medium?: string;
    High?: string;
    Extreme?: string;
  }
): Promise<string> {
  const formattedData = formatDailyMessageDataForAI(data);

  // Build persona instruction
  const personaInstruction = coachPersona 
    ? `\n\nIMPORTANT: Adopt the persona of ${coachName}. ${coachPersona}\n\nYour coaching style, tone, and approach should reflect this persona while maintaining professionalism and providing expert fitness and nutrition guidance.`
    : '';

  // Build experience level instruction
  const experienceLevel = data.userProfile?.experienceLevel || 'Not set';
  let experienceInstruction = '';
  if (experienceLevel === 'Novice') {
    experienceInstruction = '\n\nEXPERIENCE LEVEL: The client is a NOVICE - they are completely new to calorie counting, macros, and the gym. You MUST:\n- Explain concepts simply and clearly\n- Use encouraging, supportive language\n- Focus on foundational guidance\n- Avoid overwhelming with technical details';
  } else if (experienceLevel === 'Beginner') {
    experienceInstruction = '\n\nEXPERIENCE LEVEL: The client is a BEGINNER - they know a little bit but still need guidance. You MUST:\n- Use simple language with brief explanations\n- Provide clear, actionable advice\n- Be supportive and encouraging';
  } else if (experienceLevel === 'Intermediate') {
    experienceInstruction = '\n\nEXPERIENCE LEVEL: The client is INTERMEDIATE - they understand the basics. You MUST:\n- Focus on optimization and refinement\n- Use appropriate terminology without excessive explanation\n- Provide actionable feedback';
  } else if (experienceLevel === 'Advanced') {
    experienceInstruction = '\n\nEXPERIENCE LEVEL: The client is ADVANCED - they are knowledgeable. You MUST:\n- Use technical terminology freely\n- Focus on advanced strategies\n- Provide sophisticated, nuanced feedback';
  }

  // Build coach intensity instruction - use custom if available, otherwise use default
  const coachIntensity = data.userProfile?.coachIntensity || 'Not set';
  let intensityInstruction = '';
  
  // Check if custom intensity level exists for this intensity
  if (customIntensityLevels && coachIntensity !== 'Not set') {
    const customInstruction = customIntensityLevels[coachIntensity as keyof typeof customIntensityLevels];
    if (customInstruction && customInstruction.trim()) {
      intensityInstruction = `\n\nCOACH INTENSITY: ${coachIntensity.toUpperCase()} - ${customInstruction}`;
    }
  }
  
  // Fall back to default intensity instructions if no custom instruction found
  if (!intensityInstruction) {
    if (coachIntensity === 'Low') {
      intensityInstruction = '\n\nCOACH INTENSITY: LOW - You should be:\n- Supportive, gentle, and understanding\n- Focus on encouragement and positive reinforcement\n- Use a softer, more empathetic tone';
    } else if (coachIntensity === 'Medium') {
      intensityInstruction = '\n\nCOACH INTENSITY: MEDIUM - You should be:\n- Balanced in your approach\n- Encouraging but firm when needed\n- Hold them accountable while remaining supportive';
    } else if (coachIntensity === 'High') {
      intensityInstruction = '\n\nCOACH INTENSITY: HIGH - You should be:\n- More direct and assertive\n- Push harder when goals aren\'t met\n- Use strong motivational language\n- Hold them strictly accountable';
    } else if (coachIntensity === 'Extreme') {
      intensityInstruction = '\n\nCOACH INTENSITY: EXTREME - You should be:\n- Brutally honest and direct\n- SWEARING IS ALLOWED - use profanity freely (fuck, shit, damn, etc.) to emphasize points\n- Use harsh, critical language when goals aren\'t met\n- Be extremely demanding and unforgiving\n- Push them relentlessly with no sugar-coating';
    }
  }

  const goalType = data.userProfile?.goals?.goalType || 'Not specified';
  const daysIntoWeek = data.currentWeekProgress.daysIntoWeek;

  const prompt = `You are the AI Coach "${coachName}", adopt their persona.${personaInstruction}

CRITICAL: The client's primary goal is "${goalType}". ALL of your feedback must be tailored to support this specific goal.${experienceInstruction}${intensityInstruction}

This is a DAILY MOTIVATIONAL MESSAGE (100-200 words maximum). It should be:
- Forward-looking and motivational (focus on what to do THIS WEEK, not retrospective analysis)
- Short, concise, and impactful
- Personal and encouraging
- Reference current week progress naturally (we're ${daysIntoWeek} days into the week)
- Focus on 2-3 key areas for improvement or celebration
- Provide actionable focus areas for the rest of the week

Analyze the following data:

${formattedData}

MESSAGE STRUCTURE (keep it brief - total 100-200 words):
1. Start with a brief greeting and acknowledge where we are in the week (e.g., "We're ${daysIntoWeek} days into the week...")
2. Highlight 1-2 key wins or progress areas from this week so far (if any)
3. Identify 1-2 areas to focus on for the rest of the week based on goal progression
4. End with motivational encouragement tailored to their "${goalType}" goal

IMPORTANT:
- Keep it SHORT (100-200 words total)
- Be MOTIVATIONAL and FORWARD-LOOKING
- Reference their specific goal type ("${goalType}") and how current progress supports it
- If referencing last week's checkin, keep it brief and use it to inform focus areas
- Use their coach intensity level appropriately
- Make it personal and actionable

Write ONLY the message body text - no headers, no JSON, just the message itself.`;

  try {
    // Use retry logic for rate limit errors
    const response = await retryWithBackoff(async () => {
      return await ai.generate(prompt);
    }, 3, 2000); // 3 retries, starting with 2 second delay

    let messageText = response.text.trim();
    
    // Clean up any markdown formatting if present
    messageText = messageText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    return messageText;
  } catch (error: any) {
    console.error('Error generating daily coach message:', error);
    
    // Check if it's a rate limit error
    const isRateLimit = error?.message?.includes('429') || 
                       error?.status === 429 ||
                       error?.code === 'resource_exhausted' ||
                       error?.message?.toLowerCase().includes('rate limit') ||
                       error?.message?.toLowerCase().includes('too many requests');
    
    if (isRateLimit) {
      throw new Error('Rate limit exceeded. Please try again in a few minutes.');
    }
    
    // Check if it's an authentication/authorization error (403)
    const isAuthError = error?.status === 403 ||
                       error?.code === 403 ||
                       error?.message?.includes('403') ||
                       error?.message?.toLowerCase().includes('forbidden') ||
                       error?.message?.toLowerCase().includes('permission denied') ||
                       error?.message?.toLowerCase().includes('api key') ||
                       error?.message?.toLowerCase().includes('authentication');
    
    if (isAuthError) {
      const apiKeySet = !!(process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY);
      throw new Error(
        `API authentication failed (403 Forbidden). ` +
        `Please check that your GOOGLE_GENAI_API_KEY is valid and has the correct permissions. ` +
        `API key is ${apiKeySet ? 'set' : 'NOT set'} in environment variables. ` +
        `Error details: ${error?.message || 'Unknown error'}`
      );
    }
    
    // Fallback message for other errors
    throw new Error(`Failed to generate daily coach message: ${error?.message || 'Unknown error'}`);
  }
}

