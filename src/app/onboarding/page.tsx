"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { calculateAge } from "@/lib/utils";
import { calculateCompleteMacros, type ActivityLevel, type GoalType, type Gender } from "@/lib/tdee-calculator";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";

interface Coach {
  coach_id: string;
  coach_name: string;
  coach_persona: string;
  coach_picture: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, updateProfile } = useAuth();
  const [step, setStep] = useState(0); // Start at 0, will adjust based on DOB status
  const [loading, setLoading] = useState(false);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loadingCoaches, setLoadingCoaches] = useState(false);
  
  // Check if date of birth is missing (for Google sign-ups)
  const needsDateOfBirth = !profile?.dateOfBirth;
  
  // Adjust step when profile loads
  useEffect(() => {
    if (profile && !needsDateOfBirth && step === 0) {
      setStep(1); // Skip DOB step if already have it
    }
  }, [profile, needsDateOfBirth, step]);

  // Step 0: Date of Birth (only shown if missing)
  const [dateOfBirth, setDateOfBirth] = useState("");

  // Step 1: Basic Info
  const [basicInfo, setBasicInfo] = useState({
    weight: "",
    height: "",
  });

  // Step 2: Goals & TDEE
  const [goalsInfo, setGoalsInfo] = useState({
    goalType: "" as GoalType | "",
    experienceLevel: "" as "Novice" | "Beginner" | "Intermediate" | "Advanced" | "",
    bodyFatPercentage: "",
    activityLevel: "" as ActivityLevel | "",
    gender: "" as Gender | "",
  });

  // Step 3: Activity Goals
  const [activityGoals, setActivityGoals] = useState({
    workoutSessionsPerWeek: "",
    cardioSessionsPerWeek: "",
    waterGoal: "",
  });

  // Step 4: AI Coach
  const [coachInfo, setCoachInfo] = useState({
    coachId: "",
    coachIntensity: "" as "Low" | "Medium" | "High" | "Extreme" | "",
    skipCoach: false,
  });

  // Calculated values
  const [calculatedMacros, setCalculatedMacros] = useState<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null>(null);
  
  // Calculate age from date of birth (use state if we're collecting it, otherwise use profile)
  const dobToUse = dateOfBirth || profile?.dateOfBirth || "";
  const age = dobToUse ? calculateAge(dobToUse) : null;

  // Fetch coaches
  useEffect(() => {
    const fetchCoaches = async () => {
      if (!db) return;
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
    };

    const currentStep = needsDateOfBirth ? step : step + 1;
    if (currentStep === 4) {
      fetchCoaches();
    }
  }, [needsDateOfBirth, step]);

  // Calculate TDEE and macros when relevant fields change
  useEffect(() => {
    if (
      step === 2 &&
      basicInfo.weight &&
      basicInfo.height &&
      age !== null &&
      goalsInfo.goalType &&
      goalsInfo.activityLevel &&
      goalsInfo.gender
    ) {
      try {
        const weight = parseFloat(basicInfo.weight);
        const height = parseFloat(basicInfo.height);
        const macros = calculateCompleteMacros(
          weight,
          height,
          age,
          goalsInfo.gender,
          goalsInfo.activityLevel,
          goalsInfo.goalType
        );
        setCalculatedMacros(macros);
      } catch (error) {
        console.error("Error calculating macros:", error);
        setCalculatedMacros(null);
      }
    }
  }, [needsDateOfBirth, step, basicInfo.weight, basicInfo.height, age, goalsInfo.goalType, goalsInfo.activityLevel, goalsInfo.gender]);

  // Load existing profile data if available
  useEffect(() => {
    if (profile) {
      if (profile.dateOfBirth) setDateOfBirth(profile.dateOfBirth);
      if (profile.weight) setBasicInfo({ weight: profile.weight.toString(), height: profile.height?.toString() || "" });
      if (profile.goals) {
        setGoalsInfo({
          goalType: profile.goals.goalType || "",
          experienceLevel: profile.experienceLevel || "",
          bodyFatPercentage: profile.bodyFatPercentage?.toString() || "",
          activityLevel: profile.activityLevel || "",
          gender: (profile.gender as Gender) || "",
        });
        setActivityGoals({
          workoutSessionsPerWeek: profile.goals.workoutSessionsPerWeek?.toString() || "",
          cardioSessionsPerWeek: profile.goals.cardioSessionsPerWeek?.toString() || "",
          waterGoal: profile.goals.waterGoal?.toString() || "",
        });
      }
      if (profile.coachId) setCoachInfo((prev) => ({ ...prev, coachId: profile.coachId || "" }));
      if (profile.coachIntensity) setCoachInfo((prev) => ({ ...prev, coachIntensity: profile.coachIntensity || "" }));
    }
  }, [profile]);

  const handleNext = () => {
    // Validation for each step
    if (needsDateOfBirth && step === 0) {
      // Step 0: Date of Birth (only if missing)
      if (!dateOfBirth) {
        toast.error("Please enter your date of birth");
        return;
      }
      // Save date of birth immediately
      updateProfile({ dateOfBirth }).catch((error) => {
        console.error("Error saving date of birth:", error);
        toast.error("Failed to save date of birth. Please try again.");
      });
    } else if (step === 1 || (needsDateOfBirth && step === 1)) {
      if (!basicInfo.weight || !basicInfo.height) {
        toast.error("Please enter your weight and height");
        return;
      }
      if (isNaN(parseFloat(basicInfo.weight)) || parseFloat(basicInfo.weight) <= 0) {
        toast.error("Please enter a valid weight");
        return;
      }
      if (isNaN(parseFloat(basicInfo.height)) || parseFloat(basicInfo.height) <= 0) {
        toast.error("Please enter a valid height");
        return;
      }
      // Date of birth should be collected in step 0 if missing
      if (needsDateOfBirth && !dateOfBirth) {
        toast.error("Please go back and enter your date of birth first.");
        return;
      }
    } else if (step === 2) {
      if (!goalsInfo.goalType) {
        toast.error("Please select your goal");
        return;
      }
      if (!goalsInfo.experienceLevel) {
        toast.error("Please select your experience level");
        return;
      }
      if (!goalsInfo.activityLevel) {
        toast.error("Please select your activity level");
        return;
      }
      if (!goalsInfo.gender) {
        toast.error("Please select your gender");
        return;
      }
      if (!calculatedMacros) {
        toast.error("Unable to calculate macros. Please check your inputs.");
        return;
      }
    } else if (step === 3) {
      if (!activityGoals.workoutSessionsPerWeek || isNaN(parseInt(activityGoals.workoutSessionsPerWeek))) {
        toast.error("Please enter a valid number of workout sessions per week");
        return;
      }
      if (!activityGoals.cardioSessionsPerWeek || isNaN(parseInt(activityGoals.cardioSessionsPerWeek))) {
        toast.error("Please enter a valid number of cardio sessions per week");
        return;
      }
      if (!activityGoals.waterGoal || isNaN(parseFloat(activityGoals.waterGoal))) {
        toast.error("Please enter a valid daily water goal");
        return;
      }
    } else if (step === 4) {
      if (!coachInfo.skipCoach && !coachInfo.coachId) {
        toast.error("Please select an AI coach or choose to skip");
        return;
      }
      if (!coachInfo.skipCoach && !coachInfo.coachIntensity) {
        toast.error("Please select coach intensity");
        return;
      }
    }

    const maxStep = needsDateOfBirth ? 4 : 4;
    if (step < maxStep) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    const minStep = needsDateOfBirth ? 0 : 1;
    if (step > minStep) {
      setStep(step - 1);
    }
  };

  const handleFinish = async () => {
    if (!user || !calculatedMacros) return;

    setLoading(true);
    try {
      // Prepare profile update
      const profileUpdate: any = {
        weight: parseFloat(basicInfo.weight),
        height: parseFloat(basicInfo.height),
        experienceLevel: goalsInfo.experienceLevel,
        activityLevel: goalsInfo.activityLevel,
        onboardingCompleted: true,
      };

      // Include date of birth if we collected it
      if (dateOfBirth) {
        profileUpdate.dateOfBirth = dateOfBirth;
      }

      if (goalsInfo.bodyFatPercentage) {
        profileUpdate.bodyFatPercentage = parseFloat(goalsInfo.bodyFatPercentage);
      }

      // Add coach info if not skipped
      if (!coachInfo.skipCoach) {
        profileUpdate.coachId = coachInfo.coachId;
        profileUpdate.coachIntensity = coachInfo.coachIntensity;
      }

      // Add gender
      profileUpdate.gender = goalsInfo.gender;

      // Add goals
      profileUpdate.goals = {
        goalType: goalsInfo.goalType,
        calorieLimit: calculatedMacros.calories,
        proteinGoal: calculatedMacros.protein,
        carbGoal: calculatedMacros.carbs,
        fatGoal: calculatedMacros.fat,
        workoutSessionsPerWeek: parseInt(activityGoals.workoutSessionsPerWeek),
        cardioSessionsPerWeek: parseInt(activityGoals.cardioSessionsPerWeek),
        startingWeight: parseFloat(basicInfo.weight),
        waterGoal: parseFloat(activityGoals.waterGoal),
      };

      await updateProfile(profileUpdate);
      toast.success("Onboarding completed! Welcome to your coaching app.");
      router.push("/");
    } catch (error) {
      console.error("Error completing onboarding:", error);
      toast.error("Failed to complete onboarding. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card>
          <CardContent className="pt-6">
            <p>Please log in to complete onboarding.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome! Let's set up your profile</CardTitle>
          <CardDescription>
            {needsDateOfBirth 
              ? `Step ${step + 1} of 5` 
              : `Step ${step} of 4`}
          </CardDescription>
          {/* Progress indicator */}
          <div className="w-full bg-muted rounded-full h-2 mt-4 overflow-hidden">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${Math.min(100, needsDateOfBirth 
                  ? ((step + 1) / 5) * 100 
                  : (step / 4) * 100)}%` 
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 0: Date of Birth (only if missing) */}
          {needsDateOfBirth && step === 0 && (
            <div className="space-y-4">
              <div className="text-center space-y-2 mb-6">
                <p className="text-lg font-semibold">Almost there!</p>
                <p className="text-sm text-muted-foreground">
                  We just need your date of birth to calculate your age and personalize your experience.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  placeholder="Select your date of birth"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  required
                  max={new Date().toISOString().split('T')[0]}
                  className="text-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Your age will be calculated automatically
                </p>
              </div>
            </div>
          )}

          {/* Step 1: Basic Info */}
          {((needsDateOfBirth && step === 1) || (!needsDateOfBirth && step === 1)) && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  placeholder="70"
                  value={basicInfo.weight}
                  onChange={(e) => setBasicInfo({ ...basicInfo, weight: e.target.value })}
                  min="1"
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Height (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  placeholder="175"
                  value={basicInfo.height}
                  onChange={(e) => setBasicInfo({ ...basicInfo, height: e.target.value })}
                  min="1"
                  step="0.1"
                />
              </div>
              {age !== null && (
                <div className="p-4 bg-muted rounded-md">
                  <p className="text-sm">
                    <span className="font-semibold">Age:</span> {age} years (calculated from your date of birth)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Goals & TDEE Calculator */}
          {((needsDateOfBirth && step === 2) || (!needsDateOfBirth && step === 2)) && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Goal</Label>
                  <RadioGroup
                    value={goalsInfo.goalType}
                    onValueChange={(value) => setGoalsInfo({ ...goalsInfo, goalType: value as GoalType })}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Lose Weight" id="goal-lose" />
                      <Label htmlFor="goal-lose" className="cursor-pointer">Lose Weight</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Gain Weight" id="goal-gain" />
                      <Label htmlFor="goal-gain" className="cursor-pointer">Gain Weight</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Gain Strength" id="goal-strength" />
                      <Label htmlFor="goal-strength" className="cursor-pointer">Gain Strength</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>Experience Level</Label>
                  <Select
                    value={goalsInfo.experienceLevel}
                    onValueChange={(value) =>
                      setGoalsInfo({ ...goalsInfo, experienceLevel: value as typeof goalsInfo.experienceLevel })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select experience level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Novice">Novice</SelectItem>
                      <SelectItem value="Beginner">Beginner</SelectItem>
                      <SelectItem value="Intermediate">Intermediate</SelectItem>
                      <SelectItem value="Advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Gender</Label>
                  <RadioGroup
                    value={goalsInfo.gender}
                    onValueChange={(value) => setGoalsInfo({ ...goalsInfo, gender: value as Gender })}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Male" id="gender-male" />
                      <Label htmlFor="gender-male" className="cursor-pointer">Male</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Female" id="gender-female" />
                      <Label htmlFor="gender-female" className="cursor-pointer">Female</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="activity-level">Activity Level</Label>
                  <Select
                    value={goalsInfo.activityLevel}
                    onValueChange={(value) =>
                      setGoalsInfo({ ...goalsInfo, activityLevel: value as ActivityLevel })
                    }
                  >
                    <SelectTrigger id="activity-level">
                      <SelectValue placeholder="Select activity level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sedentary">Sedentary (little or no exercise)</SelectItem>
                      <SelectItem value="Lightly Active">Lightly Active (light exercise 1-3 days/week)</SelectItem>
                      <SelectItem value="Moderately Active">Moderately Active (moderate exercise 3-5 days/week)</SelectItem>
                      <SelectItem value="Very Active">Very Active (hard exercise 6-7 days/week)</SelectItem>
                      <SelectItem value="Extremely Active">Extremely Active (very hard exercise, physical job)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bodyfat">Body Fat Percentage (optional)</Label>
                  <Input
                    id="bodyfat"
                    type="number"
                    placeholder="15"
                    value={goalsInfo.bodyFatPercentage}
                    onChange={(e) => setGoalsInfo({ ...goalsInfo, bodyFatPercentage: e.target.value })}
                    min="0"
                    max="50"
                    step="0.1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional: Used for more accurate TDEE calculation
                  </p>
                </div>
              </div>

              {/* TDEE Calculator Results */}
              {calculatedMacros && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-lg">Your Calculated Macros</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Daily Calories</p>
                        <p className="text-2xl font-bold">{calculatedMacros.calories}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Protein</p>
                        <p className="text-2xl font-bold">{calculatedMacros.protein}g</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Carbs</p>
                        <p className="text-2xl font-bold">{calculatedMacros.carbs}g</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Fat</p>
                        <p className="text-2xl font-bold">{calculatedMacros.fat}g</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">
                      Adjust your body fat percentage and activity level above to refine these values.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 3: Activity Goals */}
          {((needsDateOfBirth && step === 3) || (!needsDateOfBirth && step === 3)) && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workouts">Workout Sessions per Week</Label>
                <Input
                  id="workouts"
                  type="number"
                  placeholder="4"
                  value={activityGoals.workoutSessionsPerWeek}
                  onChange={(e) =>
                    setActivityGoals({ ...activityGoals, workoutSessionsPerWeek: e.target.value })
                  }
                  min="0"
                  max="14"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cardio">Cardio Sessions per Week</Label>
                <Input
                  id="cardio"
                  type="number"
                  placeholder="3"
                  value={activityGoals.cardioSessionsPerWeek}
                  onChange={(e) =>
                    setActivityGoals({ ...activityGoals, cardioSessionsPerWeek: e.target.value })
                  }
                  min="0"
                  max="14"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="water">Daily Water Goal (Liters)</Label>
                <Input
                  id="water"
                  type="number"
                  placeholder="2.5"
                  value={activityGoals.waterGoal}
                  onChange={(e) => setActivityGoals({ ...activityGoals, waterGoal: e.target.value })}
                  min="0"
                  max="10"
                  step="0.1"
                />
              </div>
            </div>
          )}

          {/* Step 4: AI Coach */}
          {((needsDateOfBirth && step === 4) || (!needsDateOfBirth && step === 4)) && (
            <div className="space-y-6">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
                      AI Coach Disclaimer
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                      Your AI Coach is an artificial intelligence system and not a real person. The coaching messages
                      are generated based on your data and are for informational purposes only. Always consult with a
                      healthcare professional before making significant changes to your diet or exercise routine.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="skip-coach"
                    checked={coachInfo.skipCoach}
                    onCheckedChange={(checked) =>
                      setCoachInfo({ ...coachInfo, skipCoach: checked === true })
                    }
                  />
                  <Label htmlFor="skip-coach" className="cursor-pointer">
                    I don't want an AI Coach
                  </Label>
                </div>

                {!coachInfo.skipCoach && (
                  <>
                    <div className="space-y-2">
                      <Label>Choose your AI Coach</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        You can change this at any time from your profile
                      </p>
                      {loadingCoaches ? (
                        <p className="text-sm text-muted-foreground">Loading coaches...</p>
                      ) : coaches.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No coaches available</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {coaches.map((coach) => (
                            <Card
                              key={coach.coach_id}
                              className={`cursor-pointer transition-all ${
                                coachInfo.coachId === coach.coach_id
                                  ? "border-primary bg-primary/5"
                                  : "hover:border-primary/50"
                              }`}
                              onClick={() => setCoachInfo({ ...coachInfo, coachId: coach.coach_id })}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                  <Avatar>
                                    <AvatarImage src={coach.coach_picture} alt={coach.coach_name} />
                                    <AvatarFallback>{coach.coach_name.charAt(0)}</AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1">
                                    <h3 className="font-semibold">{coach.coach_name}</h3>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {coach.coach_persona}
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="intensity">Coach Intensity</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        You can change this at any time from your profile
                      </p>
                      <Select
                        value={coachInfo.coachIntensity}
                        onValueChange={(value) =>
                          setCoachInfo({
                            ...coachInfo,
                            coachIntensity: value as typeof coachInfo.coachIntensity,
                          })
                        }
                      >
                        <SelectTrigger id="intensity">
                          <SelectValue placeholder="Select coach intensity" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Low">Low - Supportive and gentle</SelectItem>
                          <SelectItem value="Medium">Medium - Balanced approach</SelectItem>
                          <SelectItem value="High">High - Direct and motivational</SelectItem>
                          <SelectItem value="Extreme">Extreme - Very intense and demanding</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="p-4 bg-muted rounded-md">
                      <p className="text-sm font-semibold mb-1">What does the AI Coach do?</p>
                      <p className="text-xs text-muted-foreground">
                        Your AI Coach will analyze your weekly progress, including your workouts, nutrition, and
                        check-ins. Based on your data, it will provide personalized coaching messages with feedback,
                        motivation, and recommendations to help you reach your goals.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4">
            <Button 
              variant="outline" 
              onClick={handleBack} 
              disabled={(needsDateOfBirth ? step === 0 : step === 1) || loading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button onClick={handleNext} disabled={loading}>
              {((needsDateOfBirth && step === 4) || (!needsDateOfBirth && step === 4)) ? (
                loading ? (
                  "Finishing..."
                ) : (
                  "Finish"
                )
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

