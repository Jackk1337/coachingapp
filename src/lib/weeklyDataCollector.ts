import { getAdminDb } from './firebase-admin';
import { startOfWeek, endOfWeek, eachDayOfInterval, format } from 'date-fns';

export interface WeeklyData {
  weeklyCheckin: any;
  dailyCheckins: any[];
  foodDiaries: any[];
  workoutLogs: any[];
  cardioLogs: any[];
  waterLogs: any[];
  userProfile: any;
}

/**
 * Collects all user data for a given week
 * Uses Firebase Admin SDK to bypass security rules (server-side only)
 * @param userId - The user's Firebase UID
 * @param weekStartDate - Start date of the week (YYYY-MM-DD format)
 * @returns Promise with all collected weekly data
 */
export async function collectWeeklyData(
  userId: string,
  weekStartDate: string
): Promise<WeeklyData> {
  const adminDb = getAdminDb();
  
  // Parse the week start date
  const weekStart = new Date(weekStartDate + 'T00:00:00');
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const weekDates = weekDays.map((day) => format(day, 'yyyy-MM-dd'));

  // Fetch weekly checkin
  const weeklyCheckinDocId = `${userId}_${weekStartDate}`;
  const weeklyCheckinSnap = await adminDb.collection('weekly_checkins').doc(weeklyCheckinDocId).get();
  const weeklyCheckin = weeklyCheckinSnap.exists
    ? weeklyCheckinSnap.data()
    : null;

  // Fetch all daily checkins for the week
  const dailyCheckinsPromises = weekDates.map(async (date) => {
    const docId = `${userId}_${date}`;
    const snapshot = await adminDb.collection('daily_checkins').doc(docId).get();
    if (snapshot.exists) {
      return { date, ...snapshot.data() };
    }
    return null;
  });
  const dailyCheckinsResults = await Promise.all(dailyCheckinsPromises);
  const dailyCheckins = dailyCheckinsResults.filter(
    (result) => result !== null
  );

  // Fetch all food diaries for the week
  const foodDiariesPromises = weekDates.map(async (date) => {
    const docId = `${userId}_${date}`;
    const snapshot = await adminDb.collection('food_diary').doc(docId).get();
    if (snapshot.exists) {
      return { date, ...snapshot.data() };
    }
    return null;
  });
  const foodDiariesResults = await Promise.all(foodDiariesPromises);
  const foodDiaries = foodDiariesResults.filter((result) => result !== null);

  // Fetch all workout logs for the week
  const workoutLogsPromises = weekDates.map(async (date) => {
    const snapshot = await adminDb.collection('workout_logs')
      .where('userId', '==', userId)
      .where('date', '==', date)
      .get();
    const logs: any[] = [];
    snapshot.forEach((doc) => {
      logs.push({ id: doc.id, date, ...doc.data() });
    });
    return logs;
  });
  const workoutLogsResults = await Promise.all(workoutLogsPromises);
  const workoutLogs = workoutLogsResults.flat();

  // Fetch all cardio logs for the week
  const cardioLogsPromises = weekDates.map(async (date) => {
    const snapshot = await adminDb.collection('cardio_log')
      .where('userId', '==', userId)
      .where('date', '==', date)
      .get();
    const logs: any[] = [];
    snapshot.forEach((doc) => {
      logs.push({ id: doc.id, date, ...doc.data() });
    });
    return logs;
  });
  const cardioLogsResults = await Promise.all(cardioLogsPromises);
  const cardioLogs = cardioLogsResults.flat();

  // Fetch all water logs for the week
  const waterLogsPromises = weekDates.map(async (date) => {
    const docId = `${userId}_${date}`;
    const snapshot = await adminDb.collection('water_log').doc(docId).get();
    if (snapshot.exists) {
      return { date, ...snapshot.data() };
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

  return {
    weeklyCheckin,
    dailyCheckins,
    foodDiaries,
    workoutLogs,
    cardioLogs,
    waterLogs,
    userProfile,
  };
}

