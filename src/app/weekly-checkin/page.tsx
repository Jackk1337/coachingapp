"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp, setDoc, doc, getDoc } from "firebase/firestore";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

export default function WeeklyCheckinPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [hasExistingCheckin, setHasExistingCheckin] = useState(false);
  const [missingDays, setMissingDays] = useState<Date[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [autoPopulated, setAutoPopulated] = useState({
    averageWeight: "",
    averageSteps: "",
    averageSleep: "",
    workoutGoalAchieved: "",
    cardioGoalAchieved: "",
  });
  const [formData, setFormData] = useState({
    appetite: "",
    energyLevels: "",
    workouts: "",
    digestion: "",
    proudAchievement: "",
    hardestPart: "",
    socialEvents: "",
    confidenceNextWeek: "",
    scheduleNextWeek: "",
    habitToImprove: "",
  });

  // Calculate current week (Monday-Sunday)
  const weekStart = currentWeekStart;
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekStartDate = format(weekStart, "yyyy-MM-dd");
  const weekEndDate = format(weekEnd, "yyyy-MM-dd");
  const weekDisplay = `${format(weekStart, "dd/MM/yyyy")} - ${format(weekEnd, "dd/MM/yyyy")}`;

  const handleWeekChange = (weeks: number) => {
    setCurrentWeekStart((prev) => (weeks > 0 ? addDays(prev, 7 * weeks) : subDays(prev, 7 * Math.abs(weeks))));
  };

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setCheckingExisting(true);
      try {
        // Check if weekly checkin already exists
        const docId = `${user.uid}_${weekStartDate}`;
        const docRef = doc(db, "weekly_checkins", docId);
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
          const data = snapshot.data();
          setFormData({
            appetite: data.appetite || "",
            energyLevels: data.energyLevels || "",
            workouts: data.workouts || "",
            digestion: data.digestion || "",
            proudAchievement: data.proudAchievement || "",
            hardestPart: data.hardestPart || "",
            socialEvents: data.socialEvents || "",
            confidenceNextWeek: data.confidenceNextWeek || "",
            scheduleNextWeek: data.scheduleNextWeek || "",
            habitToImprove: data.habitToImprove || "",
          });
          setAutoPopulated({
            averageWeight: data.averageWeight?.toString() || "",
            averageSteps: data.averageSteps?.toString() || "",
            averageSleep: data.averageSleep?.toString() || "",
            workoutGoalAchieved: data.workoutGoalAchieved || "",
            cardioGoalAchieved: data.cardioGoalAchieved || "",
          });
          setHasExistingCheckin(true);
          // Still check for missing daily checkins even when editing
          await calculateAutoPopulated();
        } else {
          // Calculate auto-populated values
          await calculateAutoPopulated();
          setHasExistingCheckin(false);
        }
      } catch (error) {
        console.error("Error fetching weekly checkin:", error);
        // Still try to calculate auto-populated values
        await calculateAutoPopulated();
      } finally {
        setCheckingExisting(false);
      }
    };

    const calculateAutoPopulated = async () => {
      try {
        const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
        const weekDates = weekDays.map(day => format(day, "yyyy-MM-dd"));

        // Fetch daily checkins for the week
        const dailyCheckinsPromises = weekDates.map(async (date, index) => {
          const docId = `${user.uid}_${date}`;
          const docRef = doc(db, "daily_checkins", docId);
          const snapshot = await getDoc(docRef);
          if (snapshot.exists()) {
            return { data: snapshot.data(), date, day: weekDays[index] };
          }
          return { data: null, date, day: weekDays[index] };
        });

        const dailyCheckinsResults = await Promise.all(dailyCheckinsPromises);
        const dailyCheckins = dailyCheckinsResults
          .filter((result) => result.data !== null)
          .map((result) => result.data);
        
        // Track missing days
        const missing = dailyCheckinsResults
          .filter((result) => result.data === null)
          .map((result) => result.day);
        setMissingDays(missing);

        // Calculate averages
        const weights = dailyCheckins
          .map(c => c.currentWeight)
          .filter((w): w is number => w !== undefined && w !== null && !isNaN(Number(w)));
        const steps = dailyCheckins
          .map(c => c.stepCount)
          .filter((s): s is number => s !== undefined && s !== null && !isNaN(Number(s)));
        const sleep = dailyCheckins
          .map(c => c.hoursOfSleep)
          .filter((s): s is number => s !== undefined && s !== null && !isNaN(Number(s)));

        const avgWeight = weights.length > 0
          ? (weights.reduce((sum, w) => sum + Number(w), 0) / weights.length).toFixed(1)
          : "N/A";
        const avgSteps = steps.length > 0
          ? Math.round(steps.reduce((sum, s) => sum + Number(s), 0) / steps.length).toString()
          : "N/A";
        const avgSleep = sleep.length > 0
          ? (sleep.reduce((sum, s) => sum + Number(s), 0) / sleep.length).toFixed(1)
          : "N/A";

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
        const workoutGoal = profile?.goals?.workoutSessionsPerWeek || 0;
        const workoutGoalAchieved = workoutGoal > 0
          ? workoutCompleted >= workoutGoal
            ? "Goal achieved!"
            : `${workoutCompleted} / ${workoutGoal}`
          : "N/A";

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
        const cardioGoal = profile?.goals?.cardioSessionsPerWeek || 0;
        const cardioGoalAchieved = cardioGoal > 0
          ? cardioCompleted >= cardioGoal
            ? "Goal achieved!"
            : `${cardioCompleted} / ${cardioGoal}`
          : "N/A";

        setAutoPopulated({
          averageWeight: avgWeight,
          averageSteps: avgSteps,
          averageSleep: avgSleep,
          workoutGoalAchieved,
          cardioGoalAchieved,
        });
      } catch (error) {
        console.error("Error calculating auto-populated values:", error);
      }
    };

    fetchData();
  }, [user, profile, weekStartDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);

    try {
      const docId = `${user.uid}_${weekStartDate}`;
      
      const data: any = {
        userId: user.uid,
        weekStartDate,
        weekEndDate,
        averageWeight: autoPopulated.averageWeight === "N/A" ? null : Number(autoPopulated.averageWeight),
        averageSteps: autoPopulated.averageSteps === "N/A" ? null : Number(autoPopulated.averageSteps),
        averageSleep: autoPopulated.averageSleep === "N/A" ? null : Number(autoPopulated.averageSleep),
        workoutGoalAchieved: autoPopulated.workoutGoalAchieved,
        cardioGoalAchieved: autoPopulated.cardioGoalAchieved,
        appetite: formData.appetite,
        energyLevels: formData.energyLevels,
        workouts: formData.workouts,
        digestion: formData.digestion,
        proudAchievement: formData.proudAchievement,
        hardestPart: formData.hardestPart,
        socialEvents: formData.socialEvents,
        confidenceNextWeek: formData.confidenceNextWeek,
        scheduleNextWeek: formData.scheduleNextWeek,
        habitToImprove: formData.habitToImprove,
        updatedAt: Timestamp.now(),
      };

      // Only set createdAt for new documents
      if (!hasExistingCheckin) {
        data.createdAt = Timestamp.now();
      }
      
      await setDoc(doc(db, "weekly_checkins", docId), data, { merge: true });

      setHasExistingCheckin(true);
      toast.success(hasExistingCheckin ? "Weekly checkin updated successfully!" : "Weekly checkin saved successfully!");
      
      // Generate AI coaching message
      // Note: Set to always generate for testing. Change back to `if (!hasExistingCheckin)` for production
      setGeneratingMessage(true);
      try {
        // Get ID token for authentication
        const idToken = await user.getIdToken();
        
        const response = await fetch('/api/generate-coaching-message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            weekStartDate,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          toast.success("Your personalized coaching message has been generated! Check your Messages.");
        } else {
          const error = await response.json();
          console.error('Error generating coaching message:', error);
          // Show more detailed error message to user
          const errorMessage = error.message || error.error || "Failed to generate coaching message";
          toast.error(`Weekly checkin saved, but failed to generate coaching message: ${errorMessage}`);
        }
      } catch (error) {
        console.error('Error calling coaching message API:', error);
        toast.error("Weekly checkin saved, but failed to generate coaching message.");
      } finally {
        setGeneratingMessage(false);
      }
    } catch (error) {
      console.error("Error saving weekly checkin:", error);
      toast.error("Failed to save weekly checkin.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  if (checkingExisting) {
    return <div className="p-4 text-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/checkin">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Weekly Checkin</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
        <Button variant="ghost" size="icon" onClick={() => handleWeekChange(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-base font-medium">
          {weekDisplay}
        </span>
        <Button variant="ghost" size="icon" onClick={() => handleWeekChange(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="px-4 py-6">
        {/* Warning for missing daily checkins */}
        {missingDays.length > 0 && (
          <Card className="mb-4 border-yellow-500/50 bg-yellow-500/10">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <TriangleAlertIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                    Some Daily Checkins are missing for this week. You can still submit your Weekly Checkin, but completing all Daily Checkins will provide more accurate data.
                  </p>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Missing: {missingDays.map((day, index) => (
                      <span key={format(day, "yyyy-MM-dd")}>
                        {format(day, "EEEE")}
                        {index < missingDays.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>
              {hasExistingCheckin ? `Edit Weekly Checkin for ${weekDisplay}` : `Weekly Checkin for ${weekDisplay}`}
            </CardTitle>
            {hasExistingCheckin && (
              <p className="text-sm text-muted-foreground mt-1">
                You have already completed a weekly checkin for this week. You can edit it below.
              </p>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Auto-populated fields */}
              <div className="space-y-4">
                <h3 className="font-semibold text-base">Week Summary (Auto-populated)</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="averageWeight">Average Weight (Kg)</Label>
                  <Input
                    id="averageWeight"
                    type="text"
                    value={autoPopulated.averageWeight}
                    readOnly
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="averageSteps">Average Steps</Label>
                  <Input
                    id="averageSteps"
                    type="text"
                    value={autoPopulated.averageSteps}
                    readOnly
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="averageSleep">Average Sleep (Hours)</Label>
                  <Input
                    id="averageSleep"
                    type="text"
                    value={autoPopulated.averageSleep}
                    readOnly
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workoutGoalAchieved">Workout Goal Achieved</Label>
                  <Input
                    id="workoutGoalAchieved"
                    type="text"
                    value={autoPopulated.workoutGoalAchieved}
                    readOnly
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cardioGoalAchieved">Cardio Goal Achieved</Label>
                  <Input
                    id="cardioGoalAchieved"
                    type="text"
                    value={autoPopulated.cardioGoalAchieved}
                    readOnly
                    className="bg-muted"
                  />
                </div>
              </div>

              {/* Free text questions */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold text-base">Weekly Reflection</h3>

                <div className="space-y-2">
                  <Label htmlFor="appetite">How's your appetite been?</Label>
                  <textarea
                    id="appetite"
                    name="appetite"
                    value={formData.appetite}
                    onChange={handleChange}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Enter your response..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="energyLevels">How's your energy levels been?</Label>
                  <textarea
                    id="energyLevels"
                    name="energyLevels"
                    value={formData.energyLevels}
                    onChange={handleChange}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Enter your response..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workouts">How have your workouts been?</Label>
                  <textarea
                    id="workouts"
                    name="workouts"
                    value={formData.workouts}
                    onChange={handleChange}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Enter your response..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="digestion">How's your digestion been?</Label>
                  <textarea
                    id="digestion"
                    name="digestion"
                    value={formData.digestion}
                    onChange={handleChange}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Enter your response..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="proudAchievement">What is one thing you are proud of achieving this week?</Label>
                  <textarea
                    id="proudAchievement"
                    name="proudAchievement"
                    value={formData.proudAchievement}
                    onChange={handleChange}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Enter your response..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hardestPart">What was the hardest part of your week, and how did you handle it?</Label>
                  <textarea
                    id="hardestPart"
                    name="hardestPart"
                    value={formData.hardestPart}
                    onChange={handleChange}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Enter your response..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="socialEvents">Did you have any social events or meals out? How did you navigate them?</Label>
                  <textarea
                    id="socialEvents"
                    name="socialEvents"
                    value={formData.socialEvents}
                    onChange={handleChange}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Enter your response..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confidenceNextWeek">On a scale of 1–10, how confident do you feel about sticking to the plan next week?</Label>
                  <textarea
                    id="confidenceNextWeek"
                    name="confidenceNextWeek"
                    value={formData.confidenceNextWeek}
                    onChange={handleChange}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Enter your response..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduleNextWeek">What does your schedule look like next week? Any birthdays, travel, or busy work days we need to plan for?</Label>
                  <textarea
                    id="scheduleNextWeek"
                    name="scheduleNextWeek"
                    value={formData.scheduleNextWeek}
                    onChange={handleChange}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Enter your response..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="habitToImprove">Based on this week, is there one habit you want to focus on improving for next week?</Label>
                  <textarea
                    id="habitToImprove"
                    name="habitToImprove"
                    value={formData.habitToImprove}
                    onChange={handleChange}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Enter your response..."
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || generatingMessage}
              >
                {generatingMessage
                  ? "Generating Coaching Message..."
                  : loading 
                  ? "Saving..." 
                  : hasExistingCheckin 
                  ? "Update Weekly Checkin" 
                  : "Save Weekly Checkin"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
