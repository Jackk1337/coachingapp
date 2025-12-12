"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dumbbell, Utensils, Activity, CalendarCheck, TrendingUp, User, CreditCard } from "lucide-react";

interface WeeklyStats {
  avgCaloriesPerDay: number;
  workoutCompleted: number;
  workoutRemaining: number;
  cardioCompleted: number;
  cardioRemaining: number;
  weeklyCaloriesConsumed: number;
  weeklyCaloriesRemaining: number;
  weeklyProteinConsumed: number;
  weeklyProteinRemaining: number;
  weeklyCarbsConsumed: number;
  weeklyCarbsRemaining: number;
  weeklyFatConsumed: number;
  weeklyFatRemaining: number;
}

export default function Home() {
  const { user, profile } = useAuth();
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [loading, setLoading] = useState(true);

  const menuItems = [
    { name: "Workout Log", href: "/workout-log", icon: Dumbbell },
    { name: "Food Diary", href: "/food-diary", icon: Utensils },
    { name: "Cardio Log", href: "/cardio-log", icon: Activity },
    { name: "Daily Checkin", href: "/daily-checkin", icon: CalendarCheck },
    { name: "Progress", href: "/progress", icon: TrendingUp },
    { name: "Cards", href: "/cards", icon: CreditCard },
    { name: "Profile", href: "/profile", icon: User },
  ];

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchWeeklyStats = async () => {
      try {
        const today = new Date();
        const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
        const weekEnd = endOfWeek(today, { weekStartsOn: 1 }); // Sunday
        const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
        
        const weekDates = weekDays.map(day => format(day, "yyyy-MM-dd"));

        // Fetch food diaries for the week
        const foodDiariesPromises = weekDates.map(async (date) => {
          const docId = `${user.uid}_${date}`;
          const docRef = doc(db, "food_diary", docId);
          const snapshot = await getDoc(docRef);
          if (snapshot.exists()) {
            return snapshot.data();
          }
          return null;
        });

        const foodDiariesResults = await Promise.all(foodDiariesPromises);
        const foodDiaries = foodDiariesResults.filter((diary): diary is NonNullable<typeof diary> => diary !== null);

        // Fetch workout logs for the week
        const workoutLogsPromises = weekDates.map(async (date) => {
          const logsQuery = query(
            collection(db, "workout_logs"),
            where("userId", "==", user.uid),
            where("date", "==", date),
            where("status", "==", "completed")
          );
          const snapshot = await getDocs(logsQuery);
          return snapshot.size;
        });

        const workoutCounts = await Promise.all(workoutLogsPromises);
        const workoutCompleted = workoutCounts.reduce((sum, count) => sum + count, 0);

        // Fetch cardio logs for the week
        const cardioLogsPromises = weekDates.map(async (date) => {
          const logsQuery = query(
            collection(db, "cardio_log"),
            where("userId", "==", user.uid),
            where("date", "==", date)
          );
          const snapshot = await getDocs(logsQuery);
          return snapshot.size;
        });

        const cardioCounts = await Promise.all(cardioLogsPromises);
        const cardioCompleted = cardioCounts.reduce((sum, count) => sum + count, 0);

        // Calculate totals
        const totalCalories = foodDiaries.reduce((sum, diary) => sum + (diary.totalCalories || 0), 0);
        const totalProtein = foodDiaries.reduce((sum, diary) => sum + (diary.totalProtein || 0), 0);
        const totalCarbs = foodDiaries.reduce((sum, diary) => sum + (diary.totalCarbs || 0), 0);
        const totalFat = foodDiaries.reduce((sum, diary) => sum + (diary.totalFat || 0), 0);

        const daysWithData = foodDiaries.length || 1;
        const avgCaloriesPerDay = Math.ceil(totalCalories / daysWithData);

        // Weekly goals (daily goal * 7)
        const dailyCalorieGoal = profile?.goals?.calorieLimit || 0;
        const weeklyCalorieGoal = dailyCalorieGoal * 7;
        const weeklyCaloriesConsumed = Math.ceil(totalCalories);
        const weeklyCaloriesRemaining = Math.ceil(weeklyCalorieGoal - totalCalories);

        const dailyProteinGoal = profile?.goals?.proteinGoal || 0;
        const weeklyProteinGoal = dailyProteinGoal * 7;
        const weeklyProteinConsumed = Math.ceil(totalProtein);
        const weeklyProteinRemaining = Math.ceil(weeklyProteinGoal - totalProtein);

        const dailyCarbGoal = profile?.goals?.carbGoal || 0;
        const weeklyCarbGoal = dailyCarbGoal * 7;
        const weeklyCarbsConsumed = Math.ceil(totalCarbs);
        const weeklyCarbsRemaining = Math.ceil(weeklyCarbGoal - totalCarbs);

        const dailyFatGoal = profile?.goals?.fatGoal || 0;
        const weeklyFatGoal = dailyFatGoal * 7;
        const weeklyFatConsumed = Math.ceil(totalFat);
        const weeklyFatRemaining = Math.ceil(weeklyFatGoal - totalFat);

        // Workout and cardio goals
        const workoutGoal = profile?.goals?.workoutSessionsPerWeek || 0;
        const workoutRemaining = Math.max(0, workoutGoal - workoutCompleted);

        const cardioGoal = profile?.goals?.cardioSessionsPerWeek || 0;
        const cardioRemaining = Math.max(0, cardioGoal - cardioCompleted);

        setWeeklyStats({
          avgCaloriesPerDay,
          workoutCompleted,
          workoutRemaining,
          cardioCompleted,
          cardioRemaining,
          weeklyCaloriesConsumed,
          weeklyCaloriesRemaining,
          weeklyProteinConsumed,
          weeklyProteinRemaining,
          weeklyCarbsConsumed,
          weeklyCarbsRemaining,
          weeklyFatConsumed,
          weeklyFatRemaining,
        });
      } catch (error) {
        console.error("Error fetching weekly stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWeeklyStats();
  }, [user, profile]);

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col items-center">
      <header className="w-full max-w-md mb-6 mt-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Coaching App</h1>
        <p className="text-muted-foreground mt-2">Track your fitness journey</p>
      </header>

      {/* Weekly Overview Section */}
      {user && !loading && weeklyStats && (
        <div className="w-full max-w-md mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Average Calories */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Average Calories/Day</span>
                  <span className="font-semibold">{weeklyStats.avgCaloriesPerDay.toLocaleString()} cal</span>
                </div>
              </div>

              {/* Workout Sessions */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Workout Sessions</span>
                  <span className="font-semibold">
                    {weeklyStats.workoutCompleted} / {weeklyStats.workoutCompleted + weeklyStats.workoutRemaining || weeklyStats.workoutCompleted}
                  </span>
                </div>
                {weeklyStats.workoutCompleted + weeklyStats.workoutRemaining > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {weeklyStats.workoutRemaining > 0 ? `${weeklyStats.workoutRemaining} remaining` : "Goal achieved!"}
                  </div>
                )}
              </div>

              {/* Cardio Sessions */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Cardio Sessions</span>
                  <span className="font-semibold">
                    {weeklyStats.cardioCompleted} / {weeklyStats.cardioCompleted + weeklyStats.cardioRemaining || weeklyStats.cardioCompleted}
                  </span>
                </div>
                {weeklyStats.cardioCompleted + weeklyStats.cardioRemaining > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {weeklyStats.cardioRemaining > 0 ? `${weeklyStats.cardioRemaining} remaining` : "Goal achieved!"}
                  </div>
                )}
              </div>

              <div className="border-t pt-4 space-y-3">
                {/* Weekly Calorie Goal */}
                {weeklyStats.weeklyCaloriesConsumed + weeklyStats.weeklyCaloriesRemaining > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Weekly Calorie Goal</span>
                      <span className="font-semibold">
                        {weeklyStats.weeklyCaloriesConsumed.toLocaleString()} / {(weeklyStats.weeklyCaloriesConsumed + weeklyStats.weeklyCaloriesRemaining).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {weeklyStats.weeklyCaloriesRemaining > 0 
                        ? `${weeklyStats.weeklyCaloriesRemaining.toLocaleString()} remaining` 
                        : weeklyStats.weeklyCaloriesRemaining < 0
                        ? `${Math.abs(weeklyStats.weeklyCaloriesRemaining).toLocaleString()} over`
                        : "Goal achieved!"}
                    </div>
                  </div>
                )}

                {/* Weekly Protein Goal */}
                {weeklyStats.weeklyProteinConsumed + weeklyStats.weeklyProteinRemaining > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Weekly Protein Goal</span>
                      <span className="font-semibold">
                        {weeklyStats.weeklyProteinConsumed.toLocaleString()}g / {(weeklyStats.weeklyProteinConsumed + weeklyStats.weeklyProteinRemaining).toLocaleString()}g
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {weeklyStats.weeklyProteinRemaining > 0 
                        ? `${weeklyStats.weeklyProteinRemaining.toLocaleString()}g remaining` 
                        : weeklyStats.weeklyProteinRemaining < 0
                        ? `${Math.abs(weeklyStats.weeklyProteinRemaining).toLocaleString()}g over`
                        : "Goal achieved!"}
                    </div>
                  </div>
                )}

                {/* Weekly Carb Goal */}
                {weeklyStats.weeklyCarbsConsumed + weeklyStats.weeklyCarbsRemaining > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Weekly Carb Goal</span>
                      <span className="font-semibold">
                        {weeklyStats.weeklyCarbsConsumed.toLocaleString()}g / {(weeklyStats.weeklyCarbsConsumed + weeklyStats.weeklyCarbsRemaining).toLocaleString()}g
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {weeklyStats.weeklyCarbsRemaining > 0 
                        ? `${weeklyStats.weeklyCarbsRemaining.toLocaleString()}g remaining` 
                        : weeklyStats.weeklyCarbsRemaining < 0
                        ? `${Math.abs(weeklyStats.weeklyCarbsRemaining).toLocaleString()}g over`
                        : "Goal achieved!"}
                    </div>
                  </div>
                )}

                {/* Weekly Fat Goal */}
                {weeklyStats.weeklyFatConsumed + weeklyStats.weeklyFatRemaining > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Weekly Fat Goal</span>
                      <span className="font-semibold">
                        {weeklyStats.weeklyFatConsumed.toLocaleString()}g / {(weeklyStats.weeklyFatConsumed + weeklyStats.weeklyFatRemaining).toLocaleString()}g
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {weeklyStats.weeklyFatRemaining > 0 
                        ? `${weeklyStats.weeklyFatRemaining.toLocaleString()}g remaining` 
                        : weeklyStats.weeklyFatRemaining < 0
                        ? `${Math.abs(weeklyStats.weeklyFatRemaining).toLocaleString()}g over`
                        : "Goal achieved!"}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {loading && (
        <div className="w-full max-w-md mb-6 text-center text-muted-foreground">
          Loading overview...
        </div>
      )}

      <main className="w-full max-w-md grid grid-cols-1 gap-4 sm:grid-cols-2">
        {menuItems.map((item) => (
          <Link key={item.href} href={item.href} className="w-full">
            <Button
              variant="outline"
              className="w-full h-32 flex flex-col items-center justify-center gap-4 text-lg hover:bg-accent"
            >
              <item.icon className="w-8 h-8" />
              {item.name}
            </Button>
          </Link>
        ))}
      </main>
    </div>
  );
}
