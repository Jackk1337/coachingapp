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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, Plus, Edit, Trash2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, query, where, addDoc, updateDoc, deleteDoc, Timestamp, setDoc } from "firebase/firestore";
import { validateHandleFormat, normalizeHandle, setHandleAtomically } from "@/lib/utils";

// Calorie constants per gram
const CALORIES_PER_GRAM_PROTEIN = 4;
const CALORIES_PER_GRAM_CARB = 4;
const CALORIES_PER_GRAM_FAT = 9;

// Experience level mapping
const EXPERIENCE_LEVELS = ["Novice", "Beginner", "Intermediate", "Advanced"] as const;
const EXPERIENCE_DESCRIPTIONS = {
  Novice: "I am completely new to calorie counting, macros, being in the gym and don't really know what I am doing.",
  Beginner: "I know a little bit about calorie counting, macros, the gym but still don't know what I'm doing.",
  Intermediate: "I know about calorie counting, macros, the gym and require feedback.",
  Advanced: "I know about calorie counting, macros, the gym and require feedback.",
};

const getExperienceLevelValue = (level: string): number => {
  const index = EXPERIENCE_LEVELS.indexOf(level as typeof EXPERIENCE_LEVELS[number]);
  return index >= 0 ? index : 0;
};

const getExperienceLevelFromValue = (value: number): string => {
  return EXPERIENCE_LEVELS[Math.max(0, Math.min(3, value))] || "Novice";
};

// Coach intensity mapping
const COACH_INTENSITY_LEVELS = ["Low", "Medium", "High", "Extreme"] as const;
const COACH_INTENSITY_DESCRIPTIONS = {
  Low: "Gentle and supportive coaching with encouraging messages.",
  Medium: "Balanced coaching with moderate motivation and feedback.",
  High: "Intense and highly motivational coaching to push your limits.",
  Extreme: "Maximum intensity coaching with very strong, direct language. May contain mature content.",
};

interface Coach {
  coach_id: string;
  coach_name: string;
  coach_persona: string;
  coach_picture: string;
}

interface UserCoach {
  id: string;
  coach_id: string;
  coach_name: string;
  coach_persona: string;
  intensityLevels: {
    Low: string;
    Medium: string;
    High: string;
    Extreme: string;
  };
  userId: string;
  createdAt: any;
  updatedAt: any;
  verified: boolean;
  verifiedAt?: any;
  sharedToCommunity: boolean;
  communityCoachId?: string;
}

export default function ProfilePage() {
  const { user, profile, updateProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [coachDialogOpen, setCoachDialogOpen] = useState(false);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [loadingCoaches, setLoadingCoaches] = useState(false);
  const [loadingSelectedCoach, setLoadingSelectedCoach] = useState(false);
  const [handle, setHandle] = useState("");
  const [checkingHandle, setCheckingHandle] = useState(false);
  const [handleError, setHandleError] = useState<string | null>(null);
  const [experienceLevelValue, setExperienceLevelValue] = useState<number[]>([0]);
  const [coachIntensityValue, setCoachIntensityValue] = useState<number[]>([0]);
  const [userCoaches, setUserCoaches] = useState<UserCoach[]>([]);
  const [loadingUserCoaches, setLoadingUserCoaches] = useState(false);
  const [createCoachDialogOpen, setCreateCoachDialogOpen] = useState(false);
  const [editCoachDialogOpen, setEditCoachDialogOpen] = useState(false);
  const [editingCoach, setEditingCoach] = useState<UserCoach | null>(null);
  const [coachFormData, setCoachFormData] = useState({
    coach_name: "",
    coach_persona: "",
    intensityLow: "",
    intensityMedium: "",
    intensityHigh: "",
    intensityExtreme: "",
  });
  const [savingCoach, setSavingCoach] = useState(false);
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
    experienceLevel: "",
    coachIntensity: "",
  });

  useEffect(() => {
    if (profile) {
      // Check if goalType exists in goals object or at root level (for backwards compatibility)
      const goalTypeRaw = profile.goals?.goalType || (profile as any).goalType || "";
      const goalType = typeof goalTypeRaw === "string" ? goalTypeRaw.trim() : "";
      
      setHandle(profile.handle || "");
      setFormData({
        goalType: goalType,
        calorieLimit: profile.goals?.calorieLimit?.toString() || "",
        proteinGoal: profile.goals?.proteinGoal?.toString() || "",
        carbGoal: profile.goals?.carbGoal?.toString() || "",
        fatGoal: profile.goals?.fatGoal?.toString() || "",
        workoutSessionsPerWeek: profile.goals?.workoutSessionsPerWeek?.toString() || "",
        cardioSessionsPerWeek: profile.goals?.cardioSessionsPerWeek?.toString() || "",
        startingWeight: profile.goals?.startingWeight?.toString() || "",
        waterGoal: profile.goals?.waterGoal?.toString() || "",
        experienceLevel: profile.experienceLevel || "",
        coachIntensity: profile.coachIntensity || "",
      });
      // Set slider value based on experience level
      if (profile.experienceLevel) {
        setExperienceLevelValue([getExperienceLevelValue(profile.experienceLevel)]);
      } else {
        setExperienceLevelValue([0]);
      }
      // Set coach intensity slider value
      if (profile.coachIntensity) {
        const intensityIndex = COACH_INTENSITY_LEVELS.indexOf(profile.coachIntensity as typeof COACH_INTENSITY_LEVELS[number]);
        setCoachIntensityValue([intensityIndex >= 0 ? intensityIndex : 0]);
      } else {
        setCoachIntensityValue([0]);
      }
    }
  }, [profile]);

  // Fetch selected coach details when profile.coachId changes
  useEffect(() => {
    const fetchSelectedCoach = async () => {
      if (profile?.coachId && db) {
        setLoadingSelectedCoach(true);
        try {
          // First try default coaches collection
          const coachRef = doc(db, "coaches", profile.coachId);
          const coachSnap = await getDoc(coachRef);
          if (coachSnap.exists()) {
            setSelectedCoach(coachSnap.data() as Coach);
          } else {
            // Try user_coaches collection
            const userCoachRef = doc(db, "user_coaches", profile.coachId);
            const userCoachSnap = await getDoc(userCoachRef);
            if (userCoachSnap.exists()) {
              const userCoachData = userCoachSnap.data();
              // Convert user coach to Coach format for display
              setSelectedCoach({
                coach_id: userCoachSnap.id,
                coach_name: userCoachData.coach_name,
                coach_persona: userCoachData.coach_persona,
                coach_picture: "", // User coaches don't have pictures
              });
            } else {
              setSelectedCoach(null);
            }
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

  // Fetch user's custom coaches
  useEffect(() => {
    const fetchUserCoaches = async () => {
      if (!user || !db) return;
      setLoadingUserCoaches(true);
      try {
        const userCoachesQuery = query(
          collection(db, "user_coaches"),
          where("userId", "==", user.uid)
        );
        const snapshot = await getDocs(userCoachesQuery);
        const coachesList: UserCoach[] = [];
        snapshot.forEach((doc) => {
          coachesList.push({
            id: doc.id,
            coach_id: doc.id,
            ...doc.data(),
          } as UserCoach);
        });
        setUserCoaches(coachesList);
      } catch (error) {
        console.error("Error fetching user coaches:", error);
        toast.error("Failed to load your custom coaches.");
      } finally {
        setLoadingUserCoaches(false);
      }
    };

    fetchUserCoaches();
  }, [user]);

  // Fetch all coaches when dialog opens (default coaches + user's custom coaches)
  useEffect(() => {
    const fetchCoaches = async () => {
      if (coachDialogOpen && db && user) {
        setLoadingCoaches(true);
        try {
          // Fetch default coaches
          const coachesRef = collection(db, "coaches");
          const coachesSnap = await getDocs(coachesRef);
          const coachesList: Coach[] = [];
          coachesSnap.forEach((doc) => {
            coachesList.push(doc.data() as Coach);
          });

          // Fetch user's custom coaches
          const userCoachesQuery = query(
            collection(db, "user_coaches"),
            where("userId", "==", user.uid)
          );
          const userCoachesSnap = await getDocs(userCoachesQuery);
          userCoachesSnap.forEach((doc) => {
            const userCoachData = doc.data();
            // Convert user coach to Coach format
            coachesList.push({
              coach_id: doc.id,
              coach_name: userCoachData.coach_name,
              coach_persona: userCoachData.coach_persona,
              coach_picture: "",
            });
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
  }, [coachDialogOpen, user]);

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
      // Build goals object with all fields
      const goalsUpdate: any = {};
      
      // Only include goalType if it has a value (not empty string)
      if (formData.goalType && formData.goalType.trim() !== "") {
        goalsUpdate.goalType = formData.goalType as "Lose Weight" | "Gain Strength" | "Gain Weight";
      }
      
      // Include all numeric fields (convert empty strings to numbers or undefined)
      if (formData.calorieLimit !== "") {
        const calorieLimit = Number(formData.calorieLimit);
        if (!isNaN(calorieLimit)) goalsUpdate.calorieLimit = calorieLimit;
      }
      if (formData.proteinGoal !== "") {
        const proteinGoal = Number(formData.proteinGoal);
        if (!isNaN(proteinGoal)) goalsUpdate.proteinGoal = proteinGoal;
      }
      if (formData.carbGoal !== "") {
        const carbGoal = Number(formData.carbGoal);
        if (!isNaN(carbGoal)) goalsUpdate.carbGoal = carbGoal;
      }
      if (formData.fatGoal !== "") {
        const fatGoal = Number(formData.fatGoal);
        if (!isNaN(fatGoal)) goalsUpdate.fatGoal = fatGoal;
      }
      if (formData.workoutSessionsPerWeek !== "") {
        const workoutSessionsPerWeek = Number(formData.workoutSessionsPerWeek);
        if (!isNaN(workoutSessionsPerWeek)) goalsUpdate.workoutSessionsPerWeek = workoutSessionsPerWeek;
      }
      if (formData.cardioSessionsPerWeek !== "") {
        const cardioSessionsPerWeek = Number(formData.cardioSessionsPerWeek);
        if (!isNaN(cardioSessionsPerWeek)) goalsUpdate.cardioSessionsPerWeek = cardioSessionsPerWeek;
      }
      if (formData.startingWeight !== "") {
        const startingWeight = Number(formData.startingWeight);
        if (!isNaN(startingWeight)) goalsUpdate.startingWeight = startingWeight;
      }
      if (formData.waterGoal !== "") {
        const waterGoal = Number(formData.waterGoal);
        if (!isNaN(waterGoal)) goalsUpdate.waterGoal = waterGoal;
      }
      
      // Prepare update object with goals and experienceLevel
      const updateData: any = {
        goals: goalsUpdate,
      };
      
      // Include experienceLevel if it has a value
      if (formData.experienceLevel && formData.experienceLevel.trim() !== "") {
        updateData.experienceLevel = formData.experienceLevel as "Novice" | "Beginner" | "Intermediate" | "Advanced";
      }
      
      await updateProfile(updateData);
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

  const handleUpdateHandle = async () => {
    if (!handle || handle.trim() === "" || !user) {
      toast.error("Please enter a handle");
      return;
    }

    const validation = validateHandleFormat(handle);
    if (!validation.isValid) {
      toast.error(validation.error || "Invalid handle format");
      setHandleError(validation.error || "Invalid handle format");
      return;
    }

    setCheckingHandle(true);
    setHandleError(null);
    try {
      // Use atomic transaction to ensure uniqueness
      await setHandleAtomically(user.uid, handle, profile?.handle);
      
      // Refresh profile after successful update
      await updateProfile({ handle: normalizeHandle(handle) });
      
      toast.success("Handle updated successfully!");
      setHandleError(null);
    } catch (error: any) {
      console.error("Error updating handle:", error);
      const errorMessage = error.message || "Failed to update handle";
      toast.error(errorMessage);
      setHandleError(errorMessage);
    } finally {
      setCheckingHandle(false);
    }
  };

  const handleCreateCoach = () => {
    setCoachFormData({
      coach_name: "",
      coach_persona: "",
      intensityLow: "",
      intensityMedium: "",
      intensityHigh: "",
      intensityExtreme: "",
    });
    setEditingCoach(null);
    setCreateCoachDialogOpen(true);
  };

  const handleEditCoach = (coach: UserCoach) => {
    setEditingCoach(coach);
    setCoachFormData({
      coach_name: coach.coach_name,
      coach_persona: coach.coach_persona,
      intensityLow: coach.intensityLevels.Low || "",
      intensityMedium: coach.intensityLevels.Medium || "",
      intensityHigh: coach.intensityLevels.High || "",
      intensityExtreme: coach.intensityLevels.Extreme || "",
    });
    setEditCoachDialogOpen(true);
  };

  const handleSaveCoach = async () => {
    if (!user || !db) return;

    if (!coachFormData.coach_name.trim()) {
      toast.error("Please enter a coach name");
      return;
    }

    if (!coachFormData.coach_persona.trim()) {
      toast.error("Please enter a coach persona");
      return;
    }

    setSavingCoach(true);
    try {
      const coachData = {
        coach_name: coachFormData.coach_name.trim(),
        coach_persona: coachFormData.coach_persona.trim(),
        intensityLevels: {
          Low: coachFormData.intensityLow.trim(),
          Medium: coachFormData.intensityMedium.trim(),
          High: coachFormData.intensityHigh.trim(),
          Extreme: coachFormData.intensityExtreme.trim(),
        },
        userId: user.uid,
        verified: false,
        sharedToCommunity: false,
        updatedAt: Timestamp.now(),
      };

      if (editingCoach) {
        // Update existing coach
        await updateDoc(doc(db, "user_coaches", editingCoach.id), {
          ...coachData,
          createdAt: editingCoach.createdAt, // Preserve original creation date
        });
        toast.success("Coach updated successfully!");
        setEditCoachDialogOpen(false);
      } else {
        // Create new coach
        await addDoc(collection(db, "user_coaches"), {
          ...coachData,
          createdAt: Timestamp.now(),
        });
        toast.success("Coach created successfully!");
        setCreateCoachDialogOpen(false);
      }

      // Refresh user coaches list
      const userCoachesQuery = query(
        collection(db, "user_coaches"),
        where("userId", "==", user.uid)
      );
      const snapshot = await getDocs(userCoachesQuery);
      const coachesList: UserCoach[] = [];
      snapshot.forEach((doc) => {
        coachesList.push({
          id: doc.id,
          coach_id: doc.id,
          ...doc.data(),
        } as UserCoach);
      });
      setUserCoaches(coachesList);

      // Reset form
      setCoachFormData({
        coach_name: "",
        coach_persona: "",
        intensityLow: "",
        intensityMedium: "",
        intensityHigh: "",
        intensityExtreme: "",
      });
      setEditingCoach(null);
    } catch (error) {
      console.error("Error saving coach:", error);
      toast.error("Failed to save coach.");
    } finally {
      setSavingCoach(false);
    }
  };

  const handleDeleteCoach = async (coachId: string) => {
    if (!user || !db) return;
    if (!confirm("Are you sure you want to delete this coach? This action cannot be undone.")) {
      return;
    }

    try {
      // If this coach is currently selected, clear the selection
      if (profile?.coachId === coachId) {
        await updateProfile({ coachId: "" });
      }

      await deleteDoc(doc(db, "user_coaches", coachId));
      toast.success("Coach deleted successfully!");

      // Refresh user coaches list
      const userCoachesQuery = query(
        collection(db, "user_coaches"),
        where("userId", "==", user.uid)
      );
      const snapshot = await getDocs(userCoachesQuery);
      const coachesList: UserCoach[] = [];
      snapshot.forEach((doc) => {
        coachesList.push({
          id: doc.id,
          coach_id: doc.id,
          ...doc.data(),
        } as UserCoach);
      });
      setUserCoaches(coachesList);
    } catch (error) {
      console.error("Error deleting coach:", error);
      toast.error("Failed to delete coach.");
    }
  };

  const handleShareToCommunity = async (coach: UserCoach) => {
    if (!user || !db) return;

    if (!coach.verified) {
      toast.error("This coach must be verified before it can be shared to the community.");
      return;
    }

    if (coach.sharedToCommunity) {
      toast.info("This coach is already shared to the community.");
      return;
    }

    try {
      // Create community coach
      const communityCoachRef = doc(collection(db, "community_coaches"));
      await setDoc(communityCoachRef, {
        coach_name: coach.coach_name,
        coach_persona: coach.coach_persona,
        intensityLevels: coach.intensityLevels,
        createdBy: user.uid,
        sourceCoachId: coach.id,
        createdAt: Timestamp.now(),
        copyCount: 0,
        likeCount: 0,
        verified: true,
        verifiedAt: coach.verifiedAt || Timestamp.now(),
      });

      // Update user coach
      await updateDoc(doc(db, "user_coaches", coach.id), {
        sharedToCommunity: true,
        communityCoachId: communityCoachRef.id,
      });

      toast.success("Coach shared to community successfully!");
      
      // Refresh user coaches list
      const userCoachesQuery = query(
        collection(db, "user_coaches"),
        where("userId", "==", user.uid)
      );
      const snapshot = await getDocs(userCoachesQuery);
      const coachesList: UserCoach[] = [];
      snapshot.forEach((doc) => {
        coachesList.push({
          id: doc.id,
          coach_id: doc.id,
          ...doc.data(),
        } as UserCoach);
      });
      setUserCoaches(coachesList);
    } catch (error) {
      console.error("Error sharing coach:", error);
      toast.error("Failed to share coach to community.");
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
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="goals">Goals</TabsTrigger>
            <TabsTrigger value="coach">AI Coach</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6 mt-6">
            <div className="flex flex-col items-center gap-2">
              <Avatar className="h-24 w-24">
                <AvatarImage src={user?.photoURL || ""} alt={user?.displayName || "User"} />
                <AvatarFallback>{user?.displayName?.charAt(0) || "U"}</AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-semibold">{user?.displayName}</h2>
              {profile?.handle && (
                <p className="text-primary font-medium">{profile.handle}</p>
              )}
              <p className="text-muted-foreground">{user?.email}</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Handle</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="handle-input">Your Handle</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        id="handle-input"
                        type="text"
                        placeholder="@username"
                        value={handle}
                        onChange={(e) => {
                          setHandle(e.target.value);
                          setHandleError(null);
                        }}
                        onBlur={async () => {
                          if (handle && handle.trim() !== "" && handle !== profile?.handle && user) {
                            const validation = validateHandleFormat(handle);
                            if (!validation.isValid) {
                              setHandleError(validation.error || "Invalid handle format");
                              return;
                            }
                            setCheckingHandle(true);
                            try {
                              // Quick check (non-atomic, just for UI feedback)
                              const usersRef = collection(db, "users");
                              const q = query(usersRef, where("handle", "==", normalizeHandle(handle)));
                              const querySnapshot = await getDocs(q);
                              const handleTaken = querySnapshot.docs.some(doc => doc.id !== user.uid);
                              
                              if (handleTaken) {
                                setHandleError("This handle is already taken");
                              } else {
                                setHandleError(null);
                              }
                            } catch (error) {
                              // Silently fail on blur check - user will get error on save
                              setHandleError(null);
                            } finally {
                              setCheckingHandle(false);
                            }
                          }
                        }}
                        className={handleError ? "border-destructive" : ""}
                      />
                      {checkingHandle && (
                        <p className="text-xs text-muted-foreground mt-1">Checking availability...</p>
                      )}
                      {handleError && (
                        <p className="text-xs text-destructive mt-1">{handleError}</p>
                      )}
                      {!handleError && handle && handle !== profile?.handle && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Will be saved as {normalizeHandle(handle)}
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={handleUpdateHandle}
                      disabled={checkingHandle || !handle || handle === profile?.handle || !!handleError}
                    >
                      Save
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your handle is how others can find you. Must be 3-30 characters, start with a letter, and contain only letters, numbers, and underscores.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div>
              <Button variant="destructive" className="w-full" onClick={signOut}>
                Sign Out
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="goals" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Goals</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="goalType">Main Goal</Label>
                    <Select
                      key={formData.goalType || "empty"}
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

                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="macro-goals" className="border-0">
                      <div className="bg-muted/30 rounded-lg border">
                        <AccordionTrigger className="px-4 py-4 hover:no-underline hover:bg-muted/40 [&[data-state=closed]]:rounded-lg [&[data-state=open]]:rounded-t-lg">
                          <div className="flex flex-col items-start text-left">
                            <Label className="text-sm font-semibold">Macro Goals</Label>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4 px-4 pb-4 pt-4">
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
                        </AccordionContent>
                      </div>
                    </AccordionItem>
                  </Accordion>

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

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="experienceLevel">Experience Level</Label>
                      <span className="text-sm font-medium">
                        {getExperienceLevelFromValue(experienceLevelValue[0])}
                      </span>
                    </div>
                    <Slider
                      id="experienceLevel"
                      min={0}
                      max={3}
                      step={1}
                      value={experienceLevelValue}
                      onValueChange={(value) => {
                        setExperienceLevelValue(value);
                        const level = getExperienceLevelFromValue(value[0]);
                        setFormData((prev) => ({ ...prev, experienceLevel: level }));
                      }}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Novice</span>
                      <span>Beginner</span>
                      <span>Intermediate</span>
                      <span>Advanced</span>
                    </div>
                    {formData.experienceLevel && (
                      <p className="text-xs text-muted-foreground">
                        {EXPERIENCE_DESCRIPTIONS[formData.experienceLevel as keyof typeof EXPERIENCE_DESCRIPTIONS]}
                      </p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Saving..." : "Save Changes"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="coach" className="mt-6 space-y-6">
            <Card>
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
                    <div className="flex items-start gap-4">
                      <Avatar className="h-16 w-16 shrink-0">
                        <AvatarImage src={selectedCoach.coach_picture} alt={selectedCoach.coach_name} />
                        <AvatarFallback>{selectedCoach.coach_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg mb-2">{selectedCoach.coach_name}</h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{selectedCoach.coach_persona}</p>
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
                
                {selectedCoach && (
                  <div className="mt-6 pt-6 border-t space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="coachIntensity">Coach Intensity</Label>
                      <span className="text-sm font-medium">
                        {COACH_INTENSITY_LEVELS[coachIntensityValue[0]]}
                      </span>
                    </div>
                    <Slider
                      id="coachIntensity"
                      min={0}
                      max={3}
                      step={1}
                      value={coachIntensityValue}
                      onValueChange={(value) => {
                        setCoachIntensityValue(value);
                        const intensity = COACH_INTENSITY_LEVELS[value[0]] as "Low" | "Medium" | "High" | "Extreme";
                        setFormData((prev) => ({ ...prev, coachIntensity: intensity }));
                        // Save immediately when changed
                        updateProfile({ coachIntensity: intensity });
                      }}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Low</span>
                      <span>Medium</span>
                      <span>High</span>
                      <span>Extreme</span>
                    </div>
                    {formData.coachIntensity && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          {COACH_INTENSITY_DESCRIPTIONS[formData.coachIntensity as keyof typeof COACH_INTENSITY_DESCRIPTIONS]}
                        </p>
                        {formData.coachIntensity === "Extreme" && (
                          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                            <p className="text-xs font-medium text-destructive">
                              ⚠️ Warning: Extreme intensity may contain mature language and very strong motivational content. Use at your own discretion.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Custom Coaches Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>My Custom Coaches</CardTitle>
                  <Button onClick={handleCreateCoach} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Coach
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingUserCoaches ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Loading your coaches...
                  </div>
                ) : userCoaches.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground mb-4">
                      You haven't created any custom coaches yet.
                    </p>
                    <Button onClick={handleCreateCoach} variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Coach
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {userCoaches.map((coach) => (
                      <Card key={coach.id} className="border">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold">{coach.coach_name}</h3>
                                {coach.verified && (
                                  <Badge variant="default" className="text-xs">
                                    Verified
                                  </Badge>
                                )}
                                {coach.sharedToCommunity && (
                                  <Badge variant="secondary" className="text-xs">
                                    Shared
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words line-clamp-2">
                                {coach.coach_persona}
                              </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditCoach(coach)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {coach.verified && !coach.sharedToCommunity && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleShareToCommunity(coach)}
                                  title="Share to Community"
                                >
                                  <Share2 className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteCoach(coach.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {!coach.verified && (
                            <p className="text-xs text-muted-foreground mt-2">
                              This coach is pending verification. Once verified, you can share it with the community.
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
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

        {/* Create/Edit Coach Dialog */}
        <Dialog open={createCoachDialogOpen || editCoachDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setCreateCoachDialogOpen(false);
            setEditCoachDialogOpen(false);
            setEditingCoach(null);
            setCoachFormData({
              coach_name: "",
              coach_persona: "",
              intensityLow: "",
              intensityMedium: "",
              intensityHigh: "",
              intensityExtreme: "",
            });
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCoach ? "Edit Custom Coach" : "Create Custom Coach"}</DialogTitle>
              <DialogDescription>
                {editingCoach 
                  ? "Update your custom AI coach's persona and intensity levels."
                  : "Create a custom AI coach with a unique persona and intensity level configurations."
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="coach_name">Coach Name</Label>
                <Input
                  id="coach_name"
                  value={coachFormData.coach_name}
                  onChange={(e) => setCoachFormData(prev => ({ ...prev, coach_name: e.target.value }))}
                  placeholder="e.g., Motivational Mike"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="coach_persona">Coach Persona</Label>
                <Textarea
                  id="coach_persona"
                  value={coachFormData.coach_persona}
                  onChange={(e) => setCoachFormData(prev => ({ ...prev, coach_persona: e.target.value }))}
                  placeholder="Describe your coach's personality, background, and coaching style. This will shape how the AI coach communicates with you."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Describe your coach's personality, background, and coaching style. This will shape how the AI coach communicates with you.
                </p>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-semibold text-sm">Intensity Level Instructions</h4>
                <p className="text-xs text-muted-foreground mb-4">
                  Define how your coach should behave at each intensity level. These instructions will override the default intensity behavior.
                </p>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="intensityLow">Low Intensity</Label>
                    <Textarea
                      id="intensityLow"
                      value={coachFormData.intensityLow}
                      onChange={(e) => setCoachFormData(prev => ({ ...prev, intensityLow: e.target.value }))}
                      placeholder="e.g., Be gentle, supportive, and understanding. Use encouraging language and acknowledge challenges without being demanding."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="intensityMedium">Medium Intensity</Label>
                    <Textarea
                      id="intensityMedium"
                      value={coachFormData.intensityMedium}
                      onChange={(e) => setCoachFormData(prev => ({ ...prev, intensityMedium: e.target.value }))}
                      placeholder="e.g., Be balanced - encouraging but firm when needed. Hold them accountable while remaining supportive."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="intensityHigh">High Intensity</Label>
                    <Textarea
                      id="intensityHigh"
                      value={coachFormData.intensityHigh}
                      onChange={(e) => setCoachFormData(prev => ({ ...prev, intensityHigh: e.target.value }))}
                      placeholder="e.g., Be direct and assertive. Push harder when goals aren't met. Use strong motivational language."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="intensityExtreme">Extreme Intensity</Label>
                    <Textarea
                      id="intensityExtreme"
                      value={coachFormData.intensityExtreme}
                      onChange={(e) => setCoachFormData(prev => ({ ...prev, intensityExtreme: e.target.value }))}
                      placeholder="e.g., Be brutally honest and direct. Use harsh, critical language when goals aren't met. Push relentlessly with no sugar-coating."
                      rows={3}
                    />
                    <p className="text-xs text-destructive">
                      ⚠️ Warning: Extreme intensity may contain mature language and very strong motivational content.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSaveCoach}
                  disabled={savingCoach}
                  className="flex-1"
                >
                  {savingCoach ? "Saving..." : editingCoach ? "Update Coach" : "Create Coach"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCreateCoachDialogOpen(false);
                    setEditCoachDialogOpen(false);
                    setEditingCoach(null);
                    setCoachFormData({
                      coach_name: "",
                      coach_persona: "",
                      intensityLow: "",
                      intensityMedium: "",
                      intensityHigh: "",
                      intensityExtreme: "",
                    });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
