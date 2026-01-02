"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { onSnapshot } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dumbbell, Utensils, Activity, CalendarCheck, TrendingUp, CreditCard, ChevronDown, ChevronUp, Droplet, Pill, MessageSquare } from "lucide-react";

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
  const { user, profile, updateProfile } = useAuth();
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [macroOverviewExpanded, setMacroOverviewExpanded] = useState(false);
  const [dailyMessageExpanded, setDailyMessageExpanded] = useState(false);
  const [todayCalories, setTodayCalories] = useState<{ consumed: number; remaining: number } | null>(null);
  const [todayWater, setTodayWater] = useState<{ consumedML: number; goalL: number } | null>(null);
  const [dailyCoachMessage, setDailyCoachMessage] = useState<{ message: string; coachName: string } | null>(null);
  const [loadingDailyMessage, setLoadingDailyMessage] = useState(false);
  const [dailyMessageError, setDailyMessageError] = useState<string | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const menuItems = [
    { name: "Workout Log", href: "/workout-log", icon: Dumbbell },
    { name: "Food Diary", href: "/food-diary", icon: Utensils },
    { name: "Log Water", href: "/water-log", icon: Droplet },
    { name: "Cardio Log", href: "/cardio-log", icon: Activity },
    { name: "Supplements", href: "/supplements", icon: Pill },
    { name: "Checkin", href: "/checkin", icon: CalendarCheck },
    { name: "Progress", href: "/progress", icon: TrendingUp },
    { name: "Cards", href: "/cards", icon: CreditCard },
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

  // Fetch today's food diary and water log
  useEffect(() => {
    if (!user) {
      setTodayCalories(null);
      setTodayWater(null);
      return;
    }

    const today = format(new Date(), "yyyy-MM-dd");
    const foodDiaryDocId = `${user.uid}_${today}`;
    const waterLogDocId = `${user.uid}_${today}`;

    // Listen to today's food diary
    const foodDiaryRef = doc(db, "food_diary", foodDiaryDocId);
    const unsubscribeFood = onSnapshot(foodDiaryRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const consumed = data.totalCalories || 0;
        const goal = profile?.goals?.calorieLimit || 0;
        const remaining = goal - consumed;
        setTodayCalories({ consumed, remaining });
      } else {
        const goal = profile?.goals?.calorieLimit || 0;
        setTodayCalories({ consumed: 0, remaining: goal });
      }
    }, (error) => {
      console.error("Error listening to food diary:", error);
    });

    // Listen to today's water log
    const waterLogRef = doc(db, "water_log", waterLogDocId);
    const unsubscribeWater = onSnapshot(waterLogRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const consumedML = data.totalML || 0;
        const goalL = profile?.goals?.waterGoal || 2;
        setTodayWater({ consumedML, goalL });
      } else {
        const goalL = profile?.goals?.waterGoal || 2;
        setTodayWater({ consumedML: 0, goalL });
      }
    }, (error) => {
      console.error("Error listening to water log:", error);
    });

    return () => {
      unsubscribeFood();
      unsubscribeWater();
    };
  }, [user, profile]);

  // Fetch today's daily coach message (only if user has selected a coach)
  useEffect(() => {
    if (!user) {
      setDailyCoachMessage(null);
      return;
    }

    // Check if user has selected a coach
    // User has a coach if coachId exists and is not empty, and skipCoachReason is not set
    const hasCoach = profile?.coachId && 
                     profile.coachId.trim() !== '' && 
                     !(profile as any)?.skipCoachReason;

    if (!hasCoach) {
      setDailyCoachMessage(null);
      setLoadingDailyMessage(false);
      setDailyMessageError(null);
      return;
    }

    const fetchDailyMessage = async () => {
      try {
        setLoadingDailyMessage(true);
        setDailyMessageError(null);
        
        const today = format(new Date(), "yyyy-MM-dd");
        const messageDocId = `${user.uid}_${today}`;
        const messageRef = doc(db, "daily_coach_messages", messageDocId);
        const messageSnap = await getDoc(messageRef);

        if (messageSnap.exists()) {
          const data = messageSnap.data();
          setDailyCoachMessage({
            message: data.message || '',
            coachName: data.coachName || 'AI Coach',
          });
        } else {
          // Message doesn't exist, generate it via API
          try {
            const token = await user.getIdToken();
            const response = await fetch('/api/generate-daily-coach-message', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ date: today }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error || 'Failed to generate daily message');
            }

            const result = await response.json();
            setDailyCoachMessage({
              message: result.message || '',
              coachName: result.coachName || 'AI Coach',
            });
          } catch (error) {
            console.error('Error generating daily message:', error);
            setDailyMessageError(error instanceof Error ? error.message : 'Failed to load daily message');
          }
        }
      } catch (error) {
        console.error('Error fetching daily message:', error);
        setDailyMessageError('Failed to load daily message');
      } finally {
        setLoadingDailyMessage(false);
      }
    };

    fetchDailyMessage();
  }, [user, profile]);

  // Show welcome modal when user completes onboarding
  useEffect(() => {
    // Only show if user is logged in, profile is loaded, onboarding is completed, and user hasn't dismissed it
    if (user && profile && profile.onboardingCompleted && !(profile as any).welcomeModalDismissed) {
      console.log('Showing welcome modal - onboarding completed:', profile.onboardingCompleted);
      setShowWelcomeModal(true);
    } else {
      console.log('Welcome modal conditions:', { 
        user: !!user, 
        profile: !!profile, 
        onboardingCompleted: profile?.onboardingCompleted,
        welcomeModalDismissed: (profile as any)?.welcomeModalDismissed 
      });
    }
  }, [user, profile]);

  return (
    <>
      {/* Welcome Modal */}
      <Dialog open={showWelcomeModal} onOpenChange={setShowWelcomeModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Welcome to RallyFit! 🎉</DialogTitle>
            <DialogDescription className="text-base pt-2">
              Your personalized fitness companion is ready to help you reach your goals.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <h3 className="font-semibold mb-2">Quick Start Guide:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Dumbbell className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span><strong className="text-foreground">Log Workouts</strong> - Track your training sessions and see your weekly progress</span>
                </li>
                <li className="flex items-start gap-2">
                  <Utensils className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span><strong className="text-foreground">Record Meals</strong> - Monitor your nutrition and stay within your macro goals</span>
                </li>
                <li className="flex items-start gap-2">
                  <Droplet className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span><strong className="text-foreground">Track Water</strong> - Set and achieve your daily hydration goals</span>
                </li>
                <li className="flex items-start gap-2">
                  <CalendarCheck className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span><strong className="text-foreground">Complete Daily Check-ins</strong> - Track your daily progress and habits</span>
                </li>
                <li className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span><strong className="text-foreground">Weekly Check-in</strong> - Complete your weekly check-in on Sunday to generate your coaching feedback (no feedback sent if you don't have a coach)</span>
                </li>
                <li className="flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span><strong className="text-foreground">Browse Community</strong> - Explore community workouts and coaches</span>
                </li>
              </ul>
            </div>
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">
                Your AI Coach will analyze your progress and provide personalized feedback to help you reach your goals. 
                The more you log, the better insights you'll receive!
              </p>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="dont-show-again"
                checked={dontShowAgain}
                onCheckedChange={(checked) => setDontShowAgain(checked === true)}
              />
              <Label htmlFor="dont-show-again" className="text-sm cursor-pointer">
                Do not show this again
              </Label>
            </div>
            <div className="flex justify-end pt-2">
              <Button 
                onClick={async () => {
                  if (dontShowAgain && user) {
                    try {
                      await updateProfile({ welcomeModalDismissed: true });
                    } catch (error) {
                      console.error('Error saving welcome modal preference:', error);
                    }
                  }
                  setShowWelcomeModal(false);
                }}
              >
                Get Started
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="min-h-screen bg-background p-4 pb-8 flex flex-col items-center">
        <header className="w-full max-w-md mb-6 mt-4 text-center">
          <h1 className="text-3xl font-bold tracking-tight">RallyFit</h1>
          <p className="text-muted-foreground mt-2">Track your fitness journey</p>
        </header>

      {/* Weekly Overview Section */}
      {user && !loading && weeklyStats && (
        <div className="w-full max-w-md mb-6 space-y-4">
          {/* 2x2 Grid for Overview Cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* Workout Sessions - Prominent Card */}
            {(profile?.goals?.workoutSessionsPerWeek ?? 0) > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Dumbbell className="h-4 w-4" />
                    Workout Sessions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">This Week</span>
                      <span className="font-semibold text-base">
                        {weeklyStats.workoutCompleted} / {weeklyStats.workoutCompleted + weeklyStats.workoutRemaining}
                      </span>
                    </div>
                    {weeklyStats.workoutRemaining > 0 ? (
                      <div className="text-xs text-muted-foreground">
                        {weeklyStats.workoutRemaining} remaining
                      </div>
                    ) : (
                      <div className="text-xs text-green-500 font-medium">
                        Goal achieved! 🎉
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Cardio Sessions - Prominent Card */}
            {(profile?.goals?.cardioSessionsPerWeek ?? 0) > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4" />
                    Cardio Sessions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">This Week</span>
                      <span className="font-semibold text-base">
                        {weeklyStats.cardioCompleted} / {weeklyStats.cardioCompleted + weeklyStats.cardioRemaining}
                      </span>
                    </div>
                    {weeklyStats.cardioRemaining > 0 ? (
                      <div className="text-xs text-muted-foreground">
                        {weeklyStats.cardioRemaining} remaining
                      </div>
                    ) : (
                      <div className="text-xs text-green-500 font-medium">
                        Goal achieved! 🎉
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Food Diary - Today's Calories */}
            {todayCalories !== null && (profile?.goals?.calorieLimit ?? 0) > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Utensils className="h-4 w-4" />
                    Food Diary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Today</span>
                      <span className={`font-semibold text-base ${todayCalories.remaining < 0 ? 'text-red-500' : todayCalories.remaining > 0 ? '' : 'text-green-500'}`}>
                        {todayCalories.remaining > 0 
                          ? `${Math.round(todayCalories.remaining)} remaining`
                          : todayCalories.remaining < 0
                          ? `${Math.abs(Math.round(todayCalories.remaining))} over`
                          : "Goal met!"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {Math.round(todayCalories.consumed)} / {profile?.goals?.calorieLimit || 0} cal
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Water Log - Today's Water */}
            {todayWater !== null && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Droplet className="h-4 w-4" />
                    Water Log
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Today</span>
                      <span className="font-semibold text-base">
                        {(todayWater.consumedML / 1000).toFixed(2)}L / {todayWater.goalL}L
                      </span>
                    </div>
                    {todayWater.consumedML >= todayWater.goalL * 1000 ? (
                      <div className="text-xs text-green-500 font-medium">
                        Goal achieved! 🎉
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        {Math.round(((todayWater.goalL * 1000 - todayWater.consumedML) / 1000) * 100) / 100}L remaining
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Daily Coach Message - Collapsible Card (only show if user has selected a coach) */}
          {(() => {
            // Check if user has selected a coach
            const hasCoach = profile?.coachId && 
                             profile.coachId.trim() !== '' && 
                             !(profile as any)?.skipCoachReason;
            
            // Only show card if user has a coach AND (has message or is loading)
            if (!hasCoach || (!dailyCoachMessage && !loadingDailyMessage)) {
              return null;
            }
            
            return (
              <Card>
                <CardHeader 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setDailyMessageExpanded(!dailyMessageExpanded)}
                >
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      <span>Message from your coach</span>
                      {dailyCoachMessage && (
                        <span className="text-sm font-normal text-muted-foreground">
                          ({dailyCoachMessage.coachName})
                        </span>
                      )}
                    </div>
                    {dailyMessageExpanded ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </CardTitle>
                </CardHeader>
                {dailyMessageExpanded && (
                  <CardContent>
                    {loadingDailyMessage ? (
                      <div className="text-center py-4 text-muted-foreground">
                        Generating your daily message...
                      </div>
                    ) : dailyMessageError ? (
                      <div className="text-center py-4 text-sm text-destructive">
                        {dailyMessageError}
                      </div>
                    ) : dailyCoachMessage ? (
                      <div className="prose prose-sm max-w-none">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {dailyCoachMessage.message}
                        </p>
                      </div>
                    ) : null}
                  </CardContent>
                )}
              </Card>
            );
          })()}

          {/* Weekly Macro Overview - Collapsible Card */}
          <Card>
            <CardHeader 
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setMacroOverviewExpanded(!macroOverviewExpanded)}
            >
              <CardTitle className="flex items-center justify-between">
                <span>Weekly Macro Overview</span>
                {macroOverviewExpanded ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </CardTitle>
            </CardHeader>
            {macroOverviewExpanded && (
              <CardContent className="space-y-4">
                {/* Average Calories */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Average Calories/Day</span>
                    <span className="font-semibold">{weeklyStats.avgCaloriesPerDay.toLocaleString()} cal</span>
                  </div>
                </div>

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
              </CardContent>
            )}
          </Card>
        </div>
      )}

      {loading && (
        <div className="w-full max-w-md mb-6 text-center text-muted-foreground">
          Loading overview...
        </div>
      )}

      <main className="w-full max-w-md grid grid-cols-2 gap-4 mb-8">
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
    </>
  );
}
