"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp, setDoc, doc } from "firebase/firestore";
import { format, addDays, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function DailyCheckinPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [checkingDate, setCheckingDate] = useState(true);
  const [hasExistingCheckin, setHasExistingCheckin] = useState(false);
  const [formData, setFormData] = useState({
    currentWeight: "",
    stepCount: "",
    hoursOfSleep: "",
    trainedToday: "Yes",
    cardioToday: "Yes",
    calorieGoalMet: "Yes",
  });

  // Format date for display (DD/MM/YYYY) and storage (YYYY-MM-DD)
  const displayDate = format(currentDate, "dd/MM/yyyy");
  const dbDate = format(currentDate, "yyyy-MM-dd");

  useEffect(() => {
    if (!user) return;

    const checkExisting = async () => {
      setCheckingDate(true);
      try {
        const q = query(
          collection(db, "daily_checkins"),
          where("userId", "==", user.uid),
          where("date", "==", dbDate)
        );
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const data = snapshot.docs[0].data();
          setFormData({
            currentWeight: data.currentWeight?.toString() || "",
            stepCount: data.stepCount?.toString() || "",
            hoursOfSleep: data.hoursOfSleep?.toString() || "",
            trainedToday: data.trainedToday || "Yes",
            cardioToday: data.cardioToday || "Yes",
            calorieGoalMet: data.calorieGoalMet || "Yes",
          });
          setHasExistingCheckin(true);
        } else {
          // Reset form for new checkin
          setFormData({
            currentWeight: "",
            stepCount: "",
            hoursOfSleep: "",
            trainedToday: "Yes",
            cardioToday: "Yes",
            calorieGoalMet: "Yes",
          });
          setHasExistingCheckin(false);
        }
      } catch (error) {
        console.error("Error fetching checkin:", error);
      } finally {
        setCheckingDate(false);
      }
    };

    checkExisting();
  }, [user, dbDate]);

  const handleDateChange = (days: number) => {
    setCurrentDate((prev) => (days > 0 ? addDays(prev, days) : subDays(prev, Math.abs(days))));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      // Use setDoc with a custom ID (userId_date) to prevent duplicates
      const docId = `${user.uid}_${dbDate}`;
      
      await setDoc(doc(db, "daily_checkins", docId), {
        userId: user.uid,
        date: dbDate,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        currentWeight: Number(formData.currentWeight),
        stepCount: Number(formData.stepCount),
        hoursOfSleep: Number(formData.hoursOfSleep),
        trainedToday: formData.trainedToday,
        cardioToday: formData.cardioToday,
        calorieGoalMet: formData.calorieGoalMet,
      });

      setHasExistingCheckin(true);
      toast.success(hasExistingCheckin ? "Daily checkin updated successfully!" : "Daily checkin saved successfully!");
    } catch (error) {
      console.error("Error saving checkin:", error);
      toast.error("Failed to save checkin.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleRadioChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  if (checkingDate) {
    return <div className="p-4 text-center">Loading...</div>;
  }

  return (
    <div className="p-4 max-w-lg mx-auto min-h-screen pb-20">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Daily Checkin</h1>
        <Link href="/">
          <Button variant="outline" size="icon">
             <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-between bg-card p-4 rounded-lg shadow-sm mb-6 border">
        <Button variant="ghost" size="icon" onClick={() => handleDateChange(-1)}>
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <span className="text-lg font-medium">{displayDate}</span>
        <Button variant="ghost" size="icon" onClick={() => handleDateChange(1)}>
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {hasExistingCheckin ? `Edit Checkin for ${displayDate}` : `Checkin for ${displayDate}`}
          </CardTitle>
          {hasExistingCheckin && (
            <p className="text-sm text-muted-foreground mt-1">
              You have already completed a checkin for this day. You can edit it below.
            </p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="space-y-2">
              <Label htmlFor="currentWeight">Current Weight (Kg)</Label>
              <Input
                id="currentWeight"
                name="currentWeight"
                type="number"
                step="0.1"
                value={formData.currentWeight}
                onChange={handleChange}
                placeholder="e.g. 75.5"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stepCount">Step Count</Label>
              <Input
                id="stepCount"
                name="stepCount"
                type="number"
                value={formData.stepCount}
                onChange={handleChange}
                placeholder="e.g. 8000"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hoursOfSleep">Hours of Sleep</Label>
              <Input
                id="hoursOfSleep"
                name="hoursOfSleep"
                type="number"
                step="0.5"
                value={formData.hoursOfSleep}
                onChange={handleChange}
                placeholder="e.g. 7.5"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Have you trained today?</Label>
              <RadioGroup
                value={formData.trainedToday}
                onValueChange={(val) => handleRadioChange("trainedToday", val)}
                className="flex flex-col space-y-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Yes" id="train-yes" />
                  <Label htmlFor="train-yes">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="No" id="train-no" />
                  <Label htmlFor="train-no">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Rest Day" id="train-rest" />
                  <Label htmlFor="train-rest">Rest Day</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Have you done your cardio today?</Label>
              <RadioGroup
                value={formData.cardioToday}
                onValueChange={(val) => handleRadioChange("cardioToday", val)}
                className="flex flex-col space-y-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Yes" id="cardio-yes" />
                  <Label htmlFor="cardio-yes">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="No" id="cardio-no" />
                  <Label htmlFor="cardio-no">No</Label>
                </div>
                 <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Rest Day" id="cardio-rest" />
                  <Label htmlFor="cardio-rest">Rest Day</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Have you met your calorie goal today?</Label>
              <RadioGroup
                value={formData.calorieGoalMet}
                onValueChange={(val) => handleRadioChange("calorieGoalMet", val)}
                className="flex flex-col space-y-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Yes" id="cal-yes" />
                  <Label htmlFor="cal-yes">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="No" id="cal-no" />
                  <Label htmlFor="cal-no">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Off-Plan Meal" id="cal-off" />
                  <Label htmlFor="cal-off">Off-Plan Meal</Label>
                </div>
              </RadioGroup>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving..." : hasExistingCheckin ? "Update Checkin" : "Save Daily Checkin"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
