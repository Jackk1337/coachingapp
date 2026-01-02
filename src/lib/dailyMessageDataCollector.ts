import { getAdminDb } from './firebase-admin';
import { startOfWeek, endOfWeek, eachDayOfInterval, format, subWeeks } from 'date-fns';

export interface DailyMessageData {
  currentWeekProgress: {
    dailyCheckins: any[];
    foodDiaries: any[];
    workoutLogs: any[];
    cardioLogs: any[];
    waterLogs: any[];
    daysIntoWeek: number; // How many days of the week have passed (1-7)
  };
  lastWeekCheckin: any | null;
  userProfile: any;
  goalProgression: {
    workoutProgress: number; // completed / goal
    cardioProgress: number; // completed / goal
    calorieProgress: number; // average daily calories vs goal
    proteinProgress: number; // average daily protein vs goal
  };
}

/**
 * Collects data needed for daily coach message generation
 * Focuses on current week progress and last week's checkin
 * @param userId - The user's Firebase UID
 * @param date - Current date (YYYY-MM-DD format), defaults to today
 * @returns Promise with collected data for daily message
 */
export async function collectDailyMessageData(
  userId: string,
  date?: string
): Promise<DailyMessageData> {
  const adminDb = getAdminDb();
  
  // Use provided date or today
  const today = date ? new Date(date + 'T00:00:00') : new Date();
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
  const currentWeekEnd = endOfWeek(today, { weekStartsOn: 1 }); // Sunday
  
  // Get days from week start to today (inclusive)
  const daysSoFar = eachDayOfInterval({ start: currentWeekStart, end: today });
  const weekDatesSoFar = daysSoFar.map((day) => format(day, 'yyyy-MM-dd'));
  const daysIntoWeek = daysSoFar.length;

  // Fetch daily checkins for current week so far
  const dailyCheckinsPromises = weekDatesSoFar.map(async (dateStr) => {
    const docId = `${userId}_${dateStr}`;
    const snapshot = await adminDb.collection('daily_checkins').doc(docId).get();
    if (snapshot.exists) {
      return { date: dateStr, ...snapshot.data() };
    }
    return null;
  });
  const dailyCheckinsResults = await Promise.all(dailyCheckinsPromises);
  const dailyCheckins = dailyCheckinsResults.filter(
    (result) => result !== null
  );

  // Fetch food diaries for current week so far
  const foodDiariesPromises = weekDatesSoFar.map(async (dateStr) => {
    const docId = `${userId}_${dateStr}`;
    const snapshot = await adminDb.collection('food_diary').doc(docId).get();
    if (snapshot.exists) {
      return { date: dateStr, ...snapshot.data() };
    }
    return null;
  });
  const foodDiariesResults = await Promise.all(foodDiariesPromises);
  const foodDiaries = foodDiariesResults.filter((result) => result !== null);

  // Fetch workout logs for current week so far
  const workoutLogsPromises = weekDatesSoFar.map(async (dateStr) => {
    const snapshot = await adminDb.collection('workout_logs')
      .where('userId', '==', userId)
      .where('date', '==', dateStr)
      .where('status', '==', 'completed')
      .get();
    const logs: any[] = [];
    snapshot.forEach((doc) => {
      logs.push({ id: doc.id, date: dateStr, ...doc.data() });
    });
    return logs;
  });
  const workoutLogsResults = await Promise.all(workoutLogsPromises);
  const workoutLogs = workoutLogsResults.flat();

  // Fetch cardio logs for current week so far
  const cardioLogsPromises = weekDatesSoFar.map(async (dateStr) => {
    const snapshot = await adminDb.collection('cardio_log')
      .where('userId', '==', userId)
      .where('date', '==', dateStr)
      .get();
    const logs: any[] = [];
    snapshot.forEach((doc) => {
      logs.push({ id: doc.id, date: dateStr, ...doc.data() });
    });
    return logs;
  });
  const cardioLogsResults = await Promise.all(cardioLogsPromises);
  const cardioLogs = cardioLogsResults.flat();

  // Fetch water logs for current week so far
  const waterLogsPromises = weekDatesSoFar.map(async (dateStr) => {
    const docId = `${userId}_${dateStr}`;
    const snapshot = await adminDb.collection('water_log').doc(docId).get();
    if (snapshot.exists) {
      return { date: dateStr, ...snapshot.data() };
    }
    return null;
  });
  const waterLogsResults = await Promise.all(waterLogsPromises);
  const waterLogs = waterLogsResults.filter((result) => result !== null);

  // Fetch user profile
  const userProfileSnap = await adminDb.collection('users').doc(userId).get();
  const userProfile = userProfileSnap.exists
    ? userProfileSnap.data()
    : null;

  // Fetch last week's weekly checkin
  const lastWeekStart = subWeeks(currentWeekStart, 1);
  const lastWeekStartDate = format(lastWeekStart, 'yyyy-MM-dd');
  const lastWeekCheckinDocId = `${userId}_${lastWeekStartDate}`;
  const lastWeekCheckinSnap = await adminDb.collection('weekly_checkins').doc(lastWeekCheckinDocId).get();
  const lastWeekCheckin = lastWeekCheckinSnap.exists
    ? lastWeekCheckinSnap.data()
    : null;

  // Calculate goal progression
  const workoutGoal = userProfile?.goals?.workoutSessionsPerWeek || 0;
  const workoutCompleted = workoutLogs.length;
  const workoutProgress = workoutGoal > 0 ? workoutCompleted / workoutGoal : 0;

  const cardioGoal = userProfile?.goals?.cardioSessionsPerWeek || 0;
  const cardioCompleted = cardioLogs.length;
  const cardioProgress = cardioGoal > 0 ? cardioCompleted / cardioGoal : 0;

  // Calculate calorie and protein progress (average vs daily goal)
  const calorieGoal = userProfile?.goals?.calorieLimit || 0;
  const totalCalories = foodDiaries.reduce((sum, diary: any) => sum + (diary.totalCalories || 0), 0);
  const avgDailyCalories = foodDiaries.length > 0 ? totalCalories / foodDiaries.length : 0;
  const calorieProgress = calorieGoal > 0 ? avgDailyCalories / calorieGoal : 0;

  const proteinGoal = userProfile?.goals?.proteinGoal || 0;
  const totalProtein = foodDiaries.reduce((sum, diary: any) => sum + (diary.totalProtein || 0), 0);
  const avgDailyProtein = foodDiaries.length > 0 ? totalProtein / foodDiaries.length : 0;
  const proteinProgress = proteinGoal > 0 ? avgDailyProtein / proteinGoal : 0;

  return {
    currentWeekProgress: {
      dailyCheckins,
      foodDiaries,
      workoutLogs,
      cardioLogs,
      waterLogs,
      daysIntoWeek,
    },
    lastWeekCheckin,
    userProfile,
    goalProgression: {
      workoutProgress,
      cardioProgress,
      calorieProgress,
      proteinProgress,
    },
  };
}

