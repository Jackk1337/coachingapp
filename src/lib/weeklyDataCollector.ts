import { db } from './firebase';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
} from 'firebase/firestore';
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
 * @param userId - The user's Firebase UID
 * @param weekStartDate - Start date of the week (YYYY-MM-DD format)
 * @returns Promise with all collected weekly data
 */
export async function collectWeeklyData(
  userId: string,
  weekStartDate: string
): Promise<WeeklyData> {
  // Parse the week start date
  const weekStart = new Date(weekStartDate + 'T00:00:00');
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const weekDates = weekDays.map((day) => format(day, 'yyyy-MM-dd'));

  // Fetch weekly checkin
  const weeklyCheckinDocId = `${userId}_${weekStartDate}`;
  const weeklyCheckinRef = doc(db, 'weekly_checkins', weeklyCheckinDocId);
  const weeklyCheckinSnap = await getDoc(weeklyCheckinRef);
  const weeklyCheckin = weeklyCheckinSnap.exists()
    ? weeklyCheckinSnap.data()
    : null;

  // Fetch all daily checkins for the week
  const dailyCheckinsPromises = weekDates.map(async (date) => {
    const docId = `${userId}_${date}`;
    const docRef = doc(db, 'daily_checkins', docId);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
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
    const docRef = doc(db, 'food_diary', docId);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return { date, ...snapshot.data() };
    }
    return null;
  });
  const foodDiariesResults = await Promise.all(foodDiariesPromises);
  const foodDiaries = foodDiariesResults.filter((result) => result !== null);

  // Fetch all workout logs for the week
  const workoutLogsPromises = weekDates.map(async (date) => {
    const logsQuery = query(
      collection(db, 'workout_logs'),
      where('userId', '==', userId),
      where('date', '==', date)
    );
    const snapshot = await getDocs(logsQuery);
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
    const logsQuery = query(
      collection(db, 'cardio_log'),
      where('userId', '==', userId),
      where('date', '==', date)
    );
    const snapshot = await getDocs(logsQuery);
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
    const docRef = doc(db, 'water_log', docId);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return { date, ...snapshot.data() };
    }
    return null;
  });
  const waterLogsResults = await Promise.all(waterLogsPromises);
  const waterLogs = waterLogsResults.filter((result) => result !== null);

  // Fetch user profile
  const userProfileRef = doc(db, 'users', userId);
  const userProfileSnap = await getDoc(userProfileRef);
  const userProfile = userProfileSnap.exists()
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

