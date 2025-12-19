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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";

// Calorie constants per gram
const CALORIES_PER_GRAM_PROTEIN = 4;
const CALORIES_PER_GRAM_CARB = 4;
const CALORIES_PER_GRAM_FAT = 9;

interface Coach {
  coach_id: string;
  coach_name: string;
  coach_persona: string;
  coach_picture: string;
}

export default function ProfilePage() {
  const { user, profile, updateProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [coachDialogOpen, setCoachDialogOpen] = useState(false);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [loadingCoaches, setLoadingCoaches] = useState(false);
  const [loadingSelectedCoach, setLoadingSelectedCoach] = useState(false);
  const [formData, setFormData] = useState({
    goalType: "",
    calorieLimit: "",
    proteinGoal: "",
    carbGoal: "",
    fatGoal: "",
    workoutSessionsPerWeek: "",
    cardioSessionsPerWeek: "",
    startingWeight: "",
    waterGoal: "",
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
        waterGoal: profile.goals.waterGoal?.toString() || "",
      });
    }
  }, [profile]);

  // Fetch selected coach details when profile.coachId changes
  useEffect(() => {
    const fetchSelectedCoach = async () => {
      if (profile?.coachId && db) {
        setLoadingSelectedCoach(true);
        try {
          const coachRef = doc(db, "coaches", profile.coachId);
          const coachSnap = await getDoc(coachRef);
          if (coachSnap.exists()) {
            setSelectedCoach(coachSnap.data() as Coach);
          } else {
            setSelectedCoach(null);
          }
        } catch (error) {
          console.error("Error fetching selected coach:", error);
          setSelectedCoach(null);
        } finally {
          setLoadingSelectedCoach(false);
        }
      } else {
        setSelectedCoach(null);
      }
    };

    fetchSelectedCoach();
  }, [profile?.coachId]);

  // Fetch all coaches when dialog opens
  useEffect(() => {
    const fetchCoaches = async () => {
      if (coachDialogOpen && db) {
        setLoadingCoaches(true);
        try {
          const coachesRef = collection(db, "coaches");
          const coachesSnap = await getDocs(coachesRef);
          const coachesList: Coach[] = [];
          coachesSnap.forEach((doc) => {
            coachesList.push(doc.data() as Coach);
          });
          setCoaches(coachesList);
        } catch (error) {
          console.error("Error fetching coaches:", error);
          toast.error("Failed to load coaches.");
        } finally {
          setLoadingCoaches(false);
        }
      }
    };

    fetchCoaches();
  }, [coachDialogOpen]);

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
          waterGoal: Number(formData.waterGoal) || undefined,
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

  const handleSelectCoach = async (coachId: string) => {
    try {
      await updateProfile({ coachId });
      setCoachDialogOpen(false);
      toast.success("Coach selected successfully!");
    } catch (error) {
      console.error("Error selecting coach:", error);
      toast.error("Failed to select coach.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Profile</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">

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

            <div className="space-y-2">
              <Label htmlFor="waterGoal">Daily Water Goal (Liters)</Label>
              <Input
                id="waterGoal"
                name="waterGoal"
                type="number"
                step="0.5"
                value={formData.waterGoal}
                onChange={handleChange}
                placeholder="e.g. 2"
              />
              <p className="text-xs text-muted-foreground">
                Recommended: 2-3 liters per day
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>AI Coach</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSelectedCoach ? (
            <div className="text-center py-4 text-muted-foreground">
              Loading coach...
            </div>
          ) : selectedCoach ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedCoach.coach_picture} alt={selectedCoach.coach_name} />
                  <AvatarFallback>{selectedCoach.coach_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{selectedCoach.coach_name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedCoach.coach_persona}</p>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setCoachDialogOpen(true)}
              >
                Change Coach
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select an AI coach to help guide your fitness journey.
              </p>
              <Button
                className="w-full"
                onClick={() => setCoachDialogOpen(true)}
              >
                Select Coach
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={coachDialogOpen} onOpenChange={setCoachDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Your AI Coach</DialogTitle>
            <DialogDescription>
              Choose an AI coach that matches your fitness goals and personality.
            </DialogDescription>
          </DialogHeader>
          {loadingCoaches ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading coaches...
            </div>
          ) : coaches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No coaches available.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              {coaches.map((coach) => (
                <Card
                  key={coach.coach_id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleSelectCoach(coach.coach_id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={coach.coach_picture} alt={coach.coach_name} />
                        <AvatarFallback>{coach.coach_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold mb-1">{coach.coach_name}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {coach.coach_persona}
                        </p>
                      </div>
                    </div>
                    <Button
                      className="w-full mt-4"
                      variant={profile?.coachId === coach.coach_id ? "default" : "outline"}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectCoach(coach.coach_id);
                      }}
                    >
                      {profile?.coachId === coach.coach_id ? "Selected" : "Select"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="mt-6">
        <Button variant="destructive" className="w-full" onClick={signOut}>
          Sign Out
        </Button>
      </div>
      </div>
    </div>
  );
}
