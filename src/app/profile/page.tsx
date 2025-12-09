"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// Calorie constants per gram
const CALORIES_PER_GRAM_PROTEIN = 4;
const CALORIES_PER_GRAM_CARB = 4;
const CALORIES_PER_GRAM_FAT = 9;

export default function ProfilePage() {
  const { user, profile, updateProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    goalType: "",
    calorieLimit: "",
    proteinGoal: "",
    carbGoal: "",
    fatGoal: "",
    workoutSessionsPerWeek: "",
    cardioSessionsPerWeek: "",
    startingWeight: "",
  });

  useEffect(() => {
    if (profile?.goals) {
      setFormData({
        goalType: profile.goals.goalType || "",
        calorieLimit: profile.goals.calorieLimit?.toString() || "",
        proteinGoal: profile.goals.proteinGoal?.toString() || "",
        carbGoal: profile.goals.carbGoal?.toString() || "",
        fatGoal: profile.goals.fatGoal?.toString() || "",
        workoutSessionsPerWeek: profile.goals.workoutSessionsPerWeek?.toString() || "",
        cardioSessionsPerWeek: profile.goals.cardioSessionsPerWeek?.toString() || "",
        startingWeight: profile.goals.startingWeight?.toString() || "",
      });
    }
  }, [profile]);

  // Calculate total calories from macros
  const calculateMacroCalories = () => {
    const protein = Number(formData.proteinGoal) || 0;
    const carbs = Number(formData.carbGoal) || 0;
    const fat = Number(formData.fatGoal) || 0;
    
    const proteinCals = protein * CALORIES_PER_GRAM_PROTEIN;
    const carbCals = carbs * CALORIES_PER_GRAM_CARB;
    const fatCals = fat * CALORIES_PER_GRAM_FAT;
    
    return proteinCals + carbCals + fatCals;
  };

  const macroCalories = calculateMacroCalories();
  const calorieLimit = Number(formData.calorieLimit) || 0;
  const macroCaloriesMatch = calorieLimit > 0 && macroCalories > 0 && Math.abs(calorieLimit - macroCalories) <= 5; // Allow 5 calorie difference

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Validate that macros match calorie goal (with some tolerance)
    if (calorieLimit > 0 && macroCalories > 0 && !macroCaloriesMatch) {
      const proceed = confirm(
        `Your macro calories (${macroCalories}) don't match your calorie limit (${calorieLimit}). ` +
        `Do you want to save anyway?`
      );
      if (!proceed) {
        setLoading(false);
        return;
      }
    }
    
    try {
      await updateProfile({
        goals: {
          goalType: formData.goalType as "Lose Weight" | "Gain Strength" | "Gain Weight",
          calorieLimit: Number(formData.calorieLimit),
          proteinGoal: Number(formData.proteinGoal),
          carbGoal: Number(formData.carbGoal),
          fatGoal: Number(formData.fatGoal),
          workoutSessionsPerWeek: Number(formData.workoutSessionsPerWeek),
          cardioSessionsPerWeek: Number(formData.cardioSessionsPerWeek),
          startingWeight: Number(formData.startingWeight),
        },
      });
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile.");
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

  const handleSelectChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      goalType: value,
    }));
  };

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Profile</h1>
        <Link href="/">
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      <div className="flex flex-col items-center mb-6 gap-2">
        <Avatar className="h-24 w-24">
          <AvatarImage src={user?.photoURL || ""} alt={user?.displayName || "User"} />
          <AvatarFallback>{user?.displayName?.charAt(0) || "U"}</AvatarFallback>
        </Avatar>
        <h2 className="text-xl font-semibold">{user?.displayName}</h2>
        <p className="text-muted-foreground">{user?.email}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Goals</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="goalType">Main Goal</Label>
              <Select
                value={formData.goalType}
                onValueChange={handleSelectChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a goal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lose Weight">Lose Weight</SelectItem>
                  <SelectItem value="Gain Strength">Gain Strength</SelectItem>
                  <SelectItem value="Gain Weight">Gain Weight</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calorieLimit">Daily Calorie Limit</Label>
              <Input
                id="calorieLimit"
                name="calorieLimit"
                type="number"
                value={formData.calorieLimit}
                onChange={handleChange}
                placeholder="e.g. 2000"
              />
            </div>

            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
              <div className="space-y-1">
                <Label className="text-sm font-semibold">Macro Goals (grams)</Label>
                <p className="text-xs text-muted-foreground">
                  Protein: 4 cal/g | Carbs: 4 cal/g | Fat: 9 cal/g
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="proteinGoal">Protein Goal (g)</Label>
                <Input
                  id="proteinGoal"
                  name="proteinGoal"
                  type="number"
                  value={formData.proteinGoal}
                  onChange={handleChange}
                  placeholder="e.g. 150"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="carbGoal">Carb Goal (g)</Label>
                <Input
                  id="carbGoal"
                  name="carbGoal"
                  type="number"
                  value={formData.carbGoal}
                  onChange={handleChange}
                  placeholder="e.g. 200"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fatGoal">Fat Goal (g)</Label>
                <Input
                  id="fatGoal"
                  name="fatGoal"
                  type="number"
                  value={formData.fatGoal}
                  onChange={handleChange}
                  placeholder="e.g. 65"
                />
              </div>

              {macroCalories > 0 && (
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Calories from Macros:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{macroCalories} cal</span>
                      {calorieLimit > 0 && (
                        <Badge variant={macroCaloriesMatch ? "default" : "secondary"}>
                          {macroCaloriesMatch ? "✓ Match" : `${Math.abs(calorieLimit - macroCalories)} off`}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="workoutSessionsPerWeek">Workout Sessions / Week</Label>
              <Input
                id="workoutSessionsPerWeek"
                name="workoutSessionsPerWeek"
                type="number"
                value={formData.workoutSessionsPerWeek}
                onChange={handleChange}
                placeholder="e.g. 4"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cardioSessionsPerWeek">Cardio Sessions / Week</Label>
              <Input
                id="cardioSessionsPerWeek"
                name="cardioSessionsPerWeek"
                type="number"
                value={formData.cardioSessionsPerWeek}
                onChange={handleChange}
                placeholder="e.g. 2"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startingWeight">Starting Weight (Kg)</Label>
              <Input
                id="startingWeight"
                name="startingWeight"
                type="number"
                value={formData.startingWeight}
                onChange={handleChange}
                placeholder="e.g. 75"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-6">
        <Button variant="destructive" className="w-full" onClick={signOut}>
          Sign Out
        </Button>
      </div>
    </div>
  );
}
