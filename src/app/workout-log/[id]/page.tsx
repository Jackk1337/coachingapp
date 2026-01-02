"use client";

import { useState, useEffect, use, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, collection, getDocs, query, where, documentId, orderBy, onSnapshot } from "firebase/firestore";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Plus, Trash2, Save, History, Search, Trophy, Calculator, MoreVertical, FileText } from "lucide-react";
import { toast } from "sonner";
import { calculateExerciseStats, generateRepCalculations, type RepCalculation } from "@/lib/rep-calculator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface WorkoutSet {
  id: string;
  weight: number;
  reps: number;
  rpe: number;
  completed: boolean;
  dropset?: boolean;
  superset?: boolean;
  isPB?: boolean; // Track if this set is a personal best
}

interface WorkoutExercise {
  exerciseId: string;
  name: string;
  sets: WorkoutSet[];
}

interface WorkoutLog {
  id: string;
  routineId: string;
  routineName: string;
  date: string;
  status: "in_progress" | "completed";
  exercises: WorkoutExercise[];
  difficultyRating?: number; // 1-5
  feedbackNotes?: string;
  pbsAchieved?: Array<{
    exerciseName: string;
    type: "reps" | "weight";
    weight: number;
    reps: number;
  }>;
}

interface ExerciseHistoryEntry {
  date: string;
  sets: WorkoutSet[];
}

interface Exercise {
  id: string;
  name: string;
  category: string;
}

// Simple debounce helper
function useDebounce(callback: Function, delay: number) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedCallback = useCallback((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);

  return debouncedCallback;
}

export default function WorkoutSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const workoutId = resolvedParams.id;
  
  const { user } = useAuth();
  const router = useRouter();
  const [workout, setWorkout] = useState<WorkoutLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [selectedExerciseName, setSelectedExerciseName] = useState<string>("");
  const [exerciseHistory, setExerciseHistory] = useState<ExerciseHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [addExerciseDialogOpen, setAddExerciseDialogOpen] = useState(false);
  const [exerciseLibrary, setExerciseLibrary] = useState<Exercise[]>([]);
  const [selectedExercisesToAdd, setSelectedExercisesToAdd] = useState<string[]>([]);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState("");
  const [pbDialogOpen, setPbDialogOpen] = useState(false);
  const [pbDialogData, setPbDialogData] = useState<{
    type: "reps" | "weight";
    exerciseName: string;
    weight: number;
    reps: number;
  } | null>(null);
  const [repCalculatorOpen, setRepCalculatorOpen] = useState(false);
  const [repCalculatorData, setRepCalculatorData] = useState<{
    exerciseId: string;
    exerciseName: string;
    calculations: RepCalculation[];
    stats: ReturnType<typeof calculateExerciseStats>;
  } | null>(null);
  const [workoutCompletionDialogOpen, setWorkoutCompletionDialogOpen] = useState(false);
  const [workoutDifficultyRating, setWorkoutDifficultyRating] = useState(3);
  const [workoutFeedbackNotes, setWorkoutFeedbackNotes] = useState("");
  const [workoutPBs, setWorkoutPBs] = useState<Array<{
    exerciseName: string;
    type: "reps" | "weight";
    weight: number;
    reps: number;
  }>>([]);
  const [pendingWorkoutData, setPendingWorkoutData] = useState<{
    updatedExercises: WorkoutExercise[];
    hasNewPB: boolean;
  } | null>(null);
  const [routineDescription, setRoutineDescription] = useState<string>("");
  const [routineDifficulty, setRoutineDifficulty] = useState<string>("");
  const [routineExerciseNotes, setRoutineExerciseNotes] = useState<Record<string, string>>({});
  const [exerciseNotesDialogOpen, setExerciseNotesDialogOpen] = useState(false);
  const [viewingExerciseNotes, setViewingExerciseNotes] = useState<{ name: string; notes: string } | null>(null);

  // Ref to keep track of latest workout state for the debounce save
  const workoutRef = useRef<WorkoutLog | null>(null);

  useEffect(() => {
    workoutRef.current = workout;
  }, [workout]);

  const saveToFirestore = useCallback(async (currentWorkout: WorkoutLog) => {
      try {
        const docRef = doc(db, "workout_logs", workoutId);
        await updateDoc(docRef, { exercises: currentWorkout.exercises });
      } catch (error) {
        console.error("Error auto-saving workout:", error);
      }
  }, [workoutId]);

  const debouncedSave = useDebounce(saveToFirestore, 1000);

  // Fetch routine metadata (description, difficulty, notes)
  useEffect(() => {
    if (!workout?.routineId) return;

    const fetchRoutineMetadata = async () => {
      try {
        const routineRef = doc(db, "workout_routines", workout.routineId);
        const routineSnap = await getDoc(routineRef);
        
        if (routineSnap.exists()) {
          const routineData = routineSnap.data();
          setRoutineDescription(routineData.description || "");
          setRoutineDifficulty(routineData.difficultyRating || "");
          setRoutineExerciseNotes(routineData.exerciseNotes || {});
        }
      } catch (error) {
        console.error("Error fetching routine metadata:", error);
      }
    };

    fetchRoutineMetadata();
  }, [workout?.routineId]);

  // Real-time listener for workout updates
  useEffect(() => {
    if (!user || !workoutId) return;

    const workoutDocRef = doc(db, "workout_logs", workoutId);
    let isInitialLoad = true;
    
    const unsubscribe = onSnapshot(workoutDocRef, async (workoutSnap) => {
      if (workoutSnap.exists()) {
        const workoutData = workoutSnap.data() as WorkoutLog;
        
        // IMPORTANT: Once a workout is started, it's independent from the routine
        // Changes to the routine should NOT affect active workouts
        // Check if exercises field exists (even if empty array) - if it exists, workout has been initialized
        if (workoutData.exercises !== undefined && workoutData.exercises !== null) {
          // Workout has been initialized - use existing exercises (even if empty)
          // Only update if the data has actually changed to prevent unnecessary re-renders
          setWorkout((prevWorkout) => {
            const newWorkout = { ...workoutData, id: workoutSnap.id };
            // Compare exercises arrays to see if they're different
            if (prevWorkout && JSON.stringify(prevWorkout.exercises) === JSON.stringify(newWorkout.exercises)) {
              return prevWorkout; // No change, return previous state
            }
            return newWorkout;
          });
          if (isInitialLoad) {
            setLoading(false);
            isInitialLoad = false;
          }
        } else {
          // Initialize exercises from routine ONLY if workout has never been initialized
          // This only happens on the first load when starting a new workout
          await initializeExercises(workoutDocRef, workoutData.routineId, workoutData);
          if (isInitialLoad) {
            setLoading(false);
            isInitialLoad = false;
          }
        }
      } else {
        toast.error("Workout not found");
        router.push("/workout-log");
        setLoading(false);
      }
    }, (error) => {
      console.error("Error listening to workout:", error);
      toast.error("Failed to load workout");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, workoutId, router]);

  const initializeExercises = async (workoutDocRef: any, routineId: string, currentData: any) => {
     try {
        const routineRef = doc(db, "workout_routines", routineId);
        const routineSnap = await getDoc(routineRef);
        
        if (routineSnap.exists()) {
           const routineData = routineSnap.data();
           const exerciseIds: string[] = routineData.exerciseIds || [];
           
           // Store routine metadata
           setRoutineDescription(routineData.description || "");
           setRoutineDifficulty(routineData.difficultyRating || "");
           setRoutineExerciseNotes(routineData.exerciseNotes || {});
           
           if (exerciseIds.length > 0) {
             const exercisesRef = collection(db, "exercise_library");
             const q = query(exercisesRef, where(documentId(), "in", exerciseIds));
             const querySnapshot = await getDocs(q);
             
             const exercisesMap = new Map();
             querySnapshot.forEach((doc) => {
               exercisesMap.set(doc.id, doc.data().name);
             });
             
             // Map exercises in the CORRECT order from the routine's exerciseIds array
             const initialExercises: WorkoutExercise[] = exerciseIds.map(id => ({
               exerciseId: id,
               name: exercisesMap.get(id) || "Unknown Exercise",
               sets: []
             }));
             
             await updateDoc(workoutDocRef, { exercises: initialExercises });
             setWorkout({ id: workoutDocRef.id, ...currentData, exercises: initialExercises });
           } else {
             setWorkout({ id: workoutDocRef.id, ...currentData, exercises: [] });
           }
        }
     } catch (error) {
        console.error("Error initializing exercises:", error);
        toast.error("Error loading routine details");
     }
  };

  const handleUpdate = (updatedExercises: WorkoutExercise[]) => {
      if (!workout) return;
      const updatedWorkout = { ...workout, exercises: updatedExercises };
      setWorkout(updatedWorkout);
      debouncedSave(updatedWorkout);
  }

  const handleAddSet = (exerciseIndex: number) => {
    if (!workout) return;
    
    const newSet: WorkoutSet = {
      id: Date.now().toString(),
      weight: 0,
      reps: 0,
      rpe: 0,
      completed: false,
      dropset: false,
      superset: false
    };

    const updatedExercises = [...workout.exercises];
    updatedExercises[exerciseIndex].sets.push(newSet);
    
    handleUpdate(updatedExercises);
  };

  const handleSetChange = async (exerciseIndex: number, setIndex: number, field: keyof WorkoutSet, value: any) => {
    if (!workout) return;
    
    const updatedExercises = [...workout.exercises];
    const currentSet = updatedExercises[exerciseIndex].sets[setIndex];
    const exercise = updatedExercises[exerciseIndex];
    
    updatedExercises[exerciseIndex].sets[setIndex] = {
      ...currentSet,
      [field]: field === "completed" || field === "dropset" || field === "superset" ? value : Number(value)
    };
    
    // Check for PB when set is marked as completed
    if (field === "completed" && value === true) {
      const updatedSet = updatedExercises[exerciseIndex].sets[setIndex];
      // Only check if weight and reps are valid
      if (updatedSet.weight > 0 && updatedSet.reps >= 1) {
        // Get all sets from current exercise (excluding the set being checked)
        const otherSetsInCurrentExercise = updatedExercises[exerciseIndex].sets.filter(
          (_, idx) => idx !== setIndex
        );
        const pbResult = await checkForPB(
          exercise.exerciseId, 
          updatedSet, 
          workout.date,
          otherSetsInCurrentExercise
        );
        if (pbResult.isPB && pbResult.type) {
          // Mark set as PB
          updatedExercises[exerciseIndex].sets[setIndex] = {
            ...updatedSet,
            isPB: true
          };
          // Show PB dialog
          setPbDialogData({
            type: pbResult.type,
            exerciseName: exercise.name,
            weight: updatedSet.weight,
            reps: updatedSet.reps
          });
          setPbDialogOpen(true);
        }
      }
    }
    
    handleUpdate(updatedExercises);
  };

  const handleDeleteSet = (exerciseIndex: number, setIndex: number) => {
     if (!workout) return;
     const updatedExercises = [...workout.exercises];
     updatedExercises[exerciseIndex].sets.splice(setIndex, 1);
     handleUpdate(updatedExercises);
  };

  const handleDeleteExercise = async (exerciseIndex: number) => {
    if (!workout) return;
    
    const exercise = workout.exercises[exerciseIndex];
    if (!confirm(`Remove "${exercise.name}" from this workout? This will only affect this workout session, not your routine.`)) {
      return;
    }

    try {
      const updatedExercises = workout.exercises.filter((_, index) => index !== exerciseIndex);
      const workoutDocRef = doc(db, "workout_logs", workoutId);
      await updateDoc(workoutDocRef, { exercises: updatedExercises });
      toast.success("Exercise removed from workout");
    } catch (error) {
      console.error("Error removing exercise:", error);
      toast.error("Failed to remove exercise");
    }
  };

  const handleViewNotes = (exerciseId: string, exerciseName: string) => {
    const notes = routineExerciseNotes[exerciseId] || "";
    setViewingExerciseNotes({ name: exerciseName, notes });
    setExerciseNotesDialogOpen(true);
  };

  const handleViewHistory = async (exerciseId: string, exerciseName: string) => {
    if (!user) return;
    
    setSelectedExerciseId(exerciseId);
    setSelectedExerciseName(exerciseName);
    setHistoryDialogOpen(true);
    setLoadingHistory(true);

    try {
      // Fetch all completed workouts for this user
      const workoutsQuery = query(
        collection(db, "workout_logs"),
        where("userId", "==", user.uid),
        where("status", "==", "completed"),
        orderBy("date", "desc")
      );

      const snapshot = await getDocs(workoutsQuery);
      const historyMap = new Map<string, WorkoutSet[]>();

      snapshot.forEach((doc) => {
        const workoutData = doc.data() as WorkoutLog;
        const exercise = workoutData.exercises?.find(e => e.exerciseId === exerciseId);
        
        if (exercise && exercise.sets && exercise.sets.length > 0) {
          const date = workoutData.date;
          if (!historyMap.has(date)) {
            historyMap.set(date, []);
          }
          // Add all sets from this workout for this exercise
          historyMap.get(date)!.push(...exercise.sets);
        }
      });

      // Convert map to array and sort by date (newest first)
      const historyEntries: ExerciseHistoryEntry[] = Array.from(historyMap.entries())
        .map(([date, sets]) => ({ date, sets }))
        .sort((a, b) => b.date.localeCompare(a.date));

      setExerciseHistory(historyEntries);
    } catch (error) {
      console.error("Error fetching exercise history:", error);
      toast.error("Failed to load exercise history");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenRepCalculator = async (exerciseId: string, exerciseName: string) => {
    if (!user) return;
    
    setRepCalculatorOpen(true);
    setLoadingHistory(true);

    try {
      // Fetch all completed workouts for this user
      const workoutsQuery = query(
        collection(db, "workout_logs"),
        where("userId", "==", user.uid),
        where("status", "==", "completed"),
        orderBy("date", "desc")
      );

      const snapshot = await getDocs(workoutsQuery);
      const allSets: Array<{ weight: number; reps: number; date?: string }> = [];

      snapshot.forEach((doc) => {
        const workoutData = doc.data() as WorkoutLog;
        const exercise = workoutData.exercises?.find(e => e.exerciseId === exerciseId);
        
        if (exercise && exercise.sets && exercise.sets.length > 0) {
          // Add all completed sets with valid data
          exercise.sets.forEach((set) => {
            if (set.completed && set.weight > 0 && set.reps >= 1) {
              allSets.push({
                weight: set.weight,
                reps: set.reps,
                date: workoutData.date,
              });
            }
          });
        }
      });

      // Calculate stats and generate rep calculations
      const stats = calculateExerciseStats(allSets);
      const calculations = stats.estimated1RM > 0 
        ? generateRepCalculations(stats.estimated1RM)
        : [];

      setRepCalculatorData({
        exerciseId,
        exerciseName,
        calculations,
        stats,
      });
    } catch (error) {
      console.error("Error calculating rep data:", error);
      toast.error("Failed to load rep calculator data");
    } finally {
      setLoadingHistory(false);
    }
  };

  const checkForPB = async (
    exerciseId: string,
    currentSet: WorkoutSet,
    currentWorkoutDate: string,
    currentWorkoutSets?: WorkoutSet[]
  ): Promise<{ isPB: boolean; type: "reps" | "weight" | null }> => {
    if (!user || !currentSet.weight || !currentSet.reps || currentSet.weight <= 0 || currentSet.reps < 1) {
      return { isPB: false, type: null };
    }

    try {
      // Fetch all completed workouts for this user and exercise
      const workoutsQuery = query(
        collection(db, "workout_logs"),
        where("userId", "==", user.uid),
        where("status", "==", "completed"),
        orderBy("date", "desc")
      );

      const snapshot = await getDocs(workoutsQuery);
      const allHistoricalSets: WorkoutSet[] = [];

      snapshot.forEach((doc) => {
        const workoutData = doc.data() as WorkoutLog;
        // Skip the current workout to compare against past workouts only
        if (workoutData.date === currentWorkoutDate) {
          return;
        }
        const exercise = workoutData.exercises?.find(e => e.exerciseId === exerciseId);
        
        if (exercise && exercise.sets && exercise.sets.length > 0) {
          // Only include sets with valid weight and reps
          const validSets = exercise.sets.filter(
            set => set.weight > 0 && set.reps >= 1
          );
          allHistoricalSets.push(...validSets);
        }
      });

      // Include completed sets from current workout (excluding the set being checked)
      if (currentWorkoutSets) {
        const otherCurrentSets = currentWorkoutSets.filter(
          set => set.weight > 0 && set.reps >= 1 && set.completed
        );
        allHistoricalSets.push(...otherCurrentSets);
      }

      // Check if this is the highest weight ever lifted (for any reps)
      const maxWeightEver = allHistoricalSets.length > 0 
        ? Math.max(...allHistoricalSets.map(set => set.weight))
        : 0;
      
      if (currentSet.weight > maxWeightEver) {
        return { isPB: true, type: "weight" };
      }

      // Check for "more reps at same weight" PB
      const setsAtSameWeight = allHistoricalSets.filter(
        set => set.weight === currentSet.weight
      );
      if (setsAtSameWeight.length > 0) {
        const maxRepsAtWeight = Math.max(...setsAtSameWeight.map(set => set.reps));
        if (currentSet.reps > maxRepsAtWeight) {
          return { isPB: true, type: "reps" };
        }
      }

      return { isPB: false, type: null };
    } catch (error) {
      console.error("Error checking for PB:", error);
      return { isPB: false, type: null };
    }
  };

  // Fetch exercise library for adding exercises
  useEffect(() => {
    if (!user || !addExerciseDialogOpen) return;

    const exercisesQuery = query(
      collection(db, "exercise_library"),
      where("userId", "in", [user.uid, "rallyfit"]),
      orderBy("name")
    );

    const unsubscribe = onSnapshot(exercisesQuery, (snapshot) => {
      const exerciseList: Exercise[] = [];
      snapshot.forEach((doc) => {
        exerciseList.push({ id: doc.id, ...doc.data() } as Exercise);
      });
      setExerciseLibrary(exerciseList);
    });

    return () => unsubscribe();
  }, [user, addExerciseDialogOpen]);

  const handleAddExercisesToWorkout = async () => {
    if (!workout || selectedExercisesToAdd.length === 0) return;

    try {
      // Get exercise names for selected IDs
      const exercisesToAdd: WorkoutExercise[] = [];
      for (const exerciseId of selectedExercisesToAdd) {
        const exercise = exerciseLibrary.find(e => e.id === exerciseId);
        if (!exercise) continue;
        // Check if exercise already exists in workout
        if (workout.exercises.some(e => e.exerciseId === exerciseId)) {
          continue;
        }
        exercisesToAdd.push({
          exerciseId: exercise.id,
          name: exercise.name,
          sets: []
        });
      }

      if (exercisesToAdd.length === 0) {
        toast.error("Selected exercises are already in the workout or not found");
        return;
      }

      const updatedExercises = [...workout.exercises, ...exercisesToAdd];
      const workoutDocRef = doc(db, "workout_logs", workoutId);
      await updateDoc(workoutDocRef, { exercises: updatedExercises });
      
      setSelectedExercisesToAdd([]);
      setAddExerciseDialogOpen(false);
      toast.success(`${exercisesToAdd.length} exercise(s) added to workout!`);
    } catch (error) {
      console.error("Error adding exercises:", error);
      toast.error("Failed to add exercises");
    }
  };

  const toggleExerciseSelection = (exerciseId: string) => {
    setSelectedExercisesToAdd((prev) => {
      if (prev.includes(exerciseId)) {
        return prev.filter(id => id !== exerciseId);
      } else {
        return [...prev, exerciseId];
      }
    });
  };

  const handleEndWorkout = async () => {
    if (!workout) return;
    setSaving(true);
    
    try {
      // Collect all PBs from completed sets
      const updatedExercises = [...workout.exercises];
      const pbsFound: Array<{
        exerciseName: string;
        type: "reps" | "weight";
        weight: number;
        reps: number;
      }> = [];
      const pbSetKeys = new Set<string>(); // Track unique PBs to avoid duplicates

      // First pass: Collect all sets already marked as PB during workout
      for (let exerciseIndex = 0; exerciseIndex < updatedExercises.length; exerciseIndex++) {
        const exercise = updatedExercises[exerciseIndex];
        for (let setIndex = 0; setIndex < exercise.sets.length; setIndex++) {
          const set = exercise.sets[setIndex];
          
          if (set.completed && set.isPB && set.weight > 0 && set.reps >= 1) {
            const pbKey = `${exercise.exerciseId}-${set.weight}-${set.reps}`;
            if (!pbSetKeys.has(pbKey)) {
              // Determine PB type by checking against history
              const otherSetsInCurrentExercise = exercise.sets.filter(
                (_, idx) => idx !== setIndex
              );
              const pbResult = await checkForPB(
                exercise.exerciseId, 
                set, 
                workout.date,
                otherSetsInCurrentExercise
              );
              if (pbResult.isPB && pbResult.type) {
                pbsFound.push({
                  exerciseName: exercise.name,
                  type: pbResult.type,
                  weight: set.weight,
                  reps: set.reps
                });
                pbSetKeys.add(pbKey);
                console.log(`Found existing PB: ${exercise.name} - ${pbResult.type} PB at ${set.weight}kg × ${set.reps} reps`);
              }
            }
          }
        }
      }

      // Second pass: Check for new PBs that weren't marked during workout
      for (let exerciseIndex = 0; exerciseIndex < updatedExercises.length; exerciseIndex++) {
        const exercise = updatedExercises[exerciseIndex];
        for (let setIndex = 0; setIndex < exercise.sets.length; setIndex++) {
          const set = exercise.sets[setIndex];
          
          if (set.completed && !set.isPB && set.weight > 0 && set.reps >= 1) {
            const pbKey = `${exercise.exerciseId}-${set.weight}-${set.reps}`;
            if (!pbSetKeys.has(pbKey)) {
              const otherSetsInCurrentExercise = exercise.sets.filter(
                (_, idx) => idx !== setIndex
              );
              const pbResult = await checkForPB(
                exercise.exerciseId, 
                set, 
                workout.date,
                otherSetsInCurrentExercise
              );
              if (pbResult.isPB && pbResult.type) {
                updatedExercises[exerciseIndex].sets[setIndex] = {
                  ...set,
                  isPB: true
                };
                pbsFound.push({
                  exerciseName: exercise.name,
                  type: pbResult.type,
                  weight: set.weight,
                  reps: set.reps
                });
                pbSetKeys.add(pbKey);
                console.log(`Found new PB: ${exercise.name} - ${pbResult.type} PB at ${set.weight}kg × ${set.reps} reps`);
              }
            }
          }
        }
      }

      console.log(`Total PBs found: ${pbsFound.length}`, pbsFound);

      // Update exercises with newly marked PBs
      const hasNewPBs = pbsFound.length > 0;
      if (hasNewPBs) {
        const workoutDocRef = doc(db, "workout_logs", workoutId);
        await updateDoc(workoutDocRef, {
          exercises: updatedExercises
        });
      }

      // Store workout data and PBs, then show completion dialog
      setPendingWorkoutData({
        updatedExercises: hasNewPBs ? updatedExercises : workout.exercises,
        hasNewPB: hasNewPBs
      });
      setWorkoutPBs(pbsFound);
      // Reset form to defaults
      setWorkoutDifficultyRating(5);
      setWorkoutFeedbackNotes("");
      setWorkoutCompletionDialogOpen(true);
    } catch (error) {
      console.error("Error checking for PBs:", error);
      toast.error("Failed to check for personal bests");
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteWorkout = async () => {
    if (!workout || !pendingWorkoutData) return;
    
    setSaving(true);
    try {
      const workoutDocRef = doc(db, "workout_logs", workoutId);
      
      // Save workout with completion data
      await updateDoc(workoutDocRef, {
        exercises: pendingWorkoutData.updatedExercises,
        status: "completed",
        endedAt: new Date(),
        difficultyRating: workoutDifficultyRating,
        feedbackNotes: workoutFeedbackNotes || null,
        pbsAchieved: workoutPBs.length > 0 ? workoutPBs : null,
      });

      toast.success("Workout saved and completed!");
      setWorkoutCompletionDialogOpen(false);
      router.push("/workout-log");
    } catch (error) {
      console.error("Error completing workout:", error);
      toast.error("Failed to save workout");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading workout...</div>;
  }

  if (!workout) {
    return <div className="flex h-screen items-center justify-center">Workout not found.</div>;
  }

  return (
    <div className="p-4 max-w-3xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
           <Link href="/workout-log">
            <Button variant="ghost" size="icon">
                <ChevronLeft className="h-5 w-5" />
            </Button>
           </Link>
           <h1 className="text-xl font-bold">{workout.routineName}</h1>
        </div>
        <Button variant="default" onClick={handleEndWorkout} disabled={saving}>
          {saving ? "Saving..." : "End Workout"}
        </Button>
      </div>

      {/* Routine Description and Difficulty */}
      {(routineDescription || routineDifficulty) && (
        <Card className="mb-4">
          <CardContent className="pt-4">
            {routineDescription && (
              <div className="mb-3">
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p className="text-sm">{routineDescription}</p>
              </div>
            )}
            {routineDifficulty && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Difficulty</p>
                <Badge variant="secondary">{routineDifficulty}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Exercise Button */}
      <div className="mb-4">
        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => setAddExerciseDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" /> Add Exercise
        </Button>
      </div>

      <div className="space-y-6">
        {workout.exercises.map((exercise, exerciseIndex) => (
          <Card key={exercise.exerciseId}>
            <CardHeader className="py-4 bg-muted/20 flex flex-row items-center justify-between">
              <CardTitle className="text-lg">{exercise.name}</CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleOpenRepCalculator(exercise.exerciseId, exercise.name)}>
                    <Calculator className="h-4 w-4 mr-2" />
                    Rep Calculator
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleViewHistory(exercise.exerciseId, exercise.name)}>
                    <History className="h-4 w-4 mr-2" />
                    History
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleViewNotes(exercise.exerciseId, exercise.name)}>
                    <FileText className="h-4 w-4 mr-2" />
                    Notes
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => handleDeleteExercise(exerciseIndex)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove Exercise
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="p-0">
               <div className="overflow-x-auto">
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead className="w-[60px] text-center">Set</TableHead>
                     <TableHead className="w-[60px] text-center">Type</TableHead>
                     <TableHead className="text-center min-w-[70px]">kg</TableHead>
                     <TableHead className="text-center min-w-[70px]">Reps</TableHead>
                     <TableHead className="text-center min-w-[70px]">RPE</TableHead>
                     <TableHead className="text-center w-[60px]">Done</TableHead>
                     <TableHead className="w-[60px]"></TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {exercise.sets.map((set, setIndex) => (
                     <TableRow key={set.id}>
                       <TableCell className="text-center font-medium p-1">
                         <div className="flex flex-col items-center justify-center gap-0.5">
                           <span className="text-sm">{setIndex + 1}</span>
                           {(set.dropset || set.superset) && (
                             <div className="flex items-center gap-0.5">
                               {set.dropset && (
                                 <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 leading-none">
                                   DS
                                 </Badge>
                               )}
                               {set.superset && (
                                 <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 leading-none">
                                   SS
                                 </Badge>
                               )}
                             </div>
                           )}
                         </div>
                       </TableCell>
                       <TableCell className="p-1">
                         <div className="flex items-center justify-center gap-1">
                           <Checkbox
                             checked={set.dropset || false}
                             onCheckedChange={(checked) => 
                               handleSetChange(exerciseIndex, setIndex, "dropset", checked)
                             }
                             className="h-4 w-4"
                             aria-label="Dropset"
                           />
                           <Checkbox
                             checked={set.superset || false}
                             onCheckedChange={(checked) => 
                               handleSetChange(exerciseIndex, setIndex, "superset", checked)
                             }
                             className="h-4 w-4"
                             aria-label="Superset"
                           />
                         </div>
                       </TableCell>
                       <TableCell className="p-1">
                         <Input 
                           type="number" 
                           className="h-8 text-center text-sm w-full" 
                           value={set.weight || ""} 
                           onChange={(e) => handleSetChange(exerciseIndex, setIndex, "weight", e.target.value)}
                         />
                       </TableCell>
                       <TableCell className="p-1">
                         <Input 
                           type="number" 
                           className="h-8 text-center text-sm w-full" 
                           value={set.reps || ""} 
                           onChange={(e) => handleSetChange(exerciseIndex, setIndex, "reps", e.target.value)}
                         />
                       </TableCell>
                       <TableCell className="p-1">
                         <Input 
                           type="number" 
                           className="h-8 text-center text-sm w-full" 
                           value={set.rpe || ""} 
                           onChange={(e) => handleSetChange(exerciseIndex, setIndex, "rpe", e.target.value)}
                         />
                       </TableCell>
                       <TableCell className="text-center">
                         <Checkbox
                           checked={set.completed || false}
                           onCheckedChange={(checked) => 
                             handleSetChange(exerciseIndex, setIndex, "completed", checked)
                           }
                         />
                       </TableCell>
                       <TableCell>
                         <div className="flex items-center justify-center gap-2">
                           {set.isPB && (
                             <Trophy className="h-5 w-5 text-yellow-500" />
                           )}
                           <Button 
                             variant="ghost" 
                             size="icon" 
                             className="h-8 w-8 text-destructive"
                             onClick={() => handleDeleteSet(exerciseIndex, setIndex)}
                           >
                             <Trash2 className="h-4 w-4" />
                           </Button>
                         </div>
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
               </div>
               <div className="p-4 border-t">
                 <Button 
                   variant="outline" 
                   size="sm" 
                   className="w-full"
                   onClick={() => handleAddSet(exerciseIndex)}
                 >
                   <Plus className="h-4 w-4 mr-2" /> Add Set
                 </Button>
               </div>
            </CardContent>
          </Card>
        ))}
        {workout.exercises.length === 0 && (
           <div className="text-center py-10 text-muted-foreground">
             No exercises found in this routine.
           </div>
        )}
      </div>
      
      <div className="mt-8 mb-8">
        <Button className="w-full py-6 text-lg" onClick={handleEndWorkout} disabled={saving}>
           <Save className="h-5 w-5 mr-2" /> Finish Workout
        </Button>
      </div>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl flex flex-col p-0 max-h-[85vh]">
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
            <DialogTitle>{selectedExerciseName} - History</DialogTitle>
          </DialogHeader>
          <ScrollArea className="px-6 pb-6" style={{ height: 'calc(85vh - 120px)' }}>
              {loadingHistory ? (
                <div className="text-center py-8">Loading history...</div>
              ) : exerciseHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No history found for this exercise.
                </div>
              ) : (
                <div className="space-y-6 pr-4">
                  {exerciseHistory.map((entry) => (
                    <Card key={entry.date}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                          {format(parseISO(entry.date), "dd/MM/yyyy")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[80px] text-center">Set</TableHead>
                              <TableHead className="text-center">Weight (kg)</TableHead>
                              <TableHead className="text-center">Reps</TableHead>
                              <TableHead className="text-center">RPE</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {entry.sets.map((set, index) => (
                              <TableRow key={index}>
                                <TableCell className="text-center font-medium">
                                  <div className="flex items-center justify-center gap-1">
                                    <span>{index + 1}</span>
                                    {set.isPB && (
                                      <Trophy className="h-4 w-4 text-yellow-500" />
                                    )}
                                    {set.dropset && (
                                      <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                                        DS
                                      </Badge>
                                    )}
                                    {set.superset && (
                                      <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                                        SS
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">{set.weight || "-"}</TableCell>
                                <TableCell className="text-center">{set.reps || "-"}</TableCell>
                                <TableCell className="text-center">{set.rpe || "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* PB Celebration Dialog */}
      <Dialog open={pbDialogOpen} onOpenChange={setPbDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <Trophy className="h-16 w-16 text-yellow-500" />
              <DialogTitle className="text-2xl">Nice, you achieved a PB!</DialogTitle>
              {pbDialogData && (
                <div className="text-center space-y-2">
                  {pbDialogData.type === "reps" ? (
                    <p className="text-lg">
                      {pbDialogData.reps} reps at {pbDialogData.weight}kg
                    </p>
                  ) : (
                    <p className="text-lg">
                      New weight: {pbDialogData.weight}kg ({pbDialogData.reps} reps)
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">{pbDialogData.exerciseName}</p>
                </div>
              )}
            </div>
          </DialogHeader>
          <div className="flex justify-center pb-4">
            <Button onClick={() => setPbDialogOpen(false)}>Awesome!</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rep Calculator Dialog */}
      <Dialog open={repCalculatorOpen} onOpenChange={setRepCalculatorOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>
              {repCalculatorData?.exerciseName || "Exercise"} - Rep Calculator
            </DialogTitle>
          </DialogHeader>
          {loadingHistory ? (
            <div className="text-center py-8">Loading calculator data...</div>
          ) : repCalculatorData && repCalculatorData.stats.estimated1RM > 0 ? (
            <div className="space-y-6">
              {/* Stats Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Your Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Estimated 1RM</p>
                      <p className="text-2xl font-bold">{repCalculatorData.stats.estimated1RM} kg</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Max Weight</p>
                      <p className="text-2xl font-bold">{repCalculatorData.stats.maxWeight} kg</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Max Reps</p>
                      <p className="text-2xl font-bold">{repCalculatorData.stats.maxReps}</p>
                    </div>
                    {repCalculatorData.stats.bestSet && (
                      <div>
                        <p className="text-sm text-muted-foreground">Best Set</p>
                        <p className="text-lg font-semibold">
                          {repCalculatorData.stats.bestSet.weight}kg × {repCalculatorData.stats.bestSet.reps}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Rep Calculations Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Weight for Rep Ranges</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Based on your estimated 1RM of {repCalculatorData.stats.estimated1RM}kg
                  </p>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-center">Reps</TableHead>
                          <TableHead className="text-center">Weight (kg)</TableHead>
                          <TableHead className="text-center">% of 1RM</TableHead>
                          <TableHead className="text-center">Est. RPE</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {repCalculatorData.calculations.map((calc) => {
                          const percentageOf1RM = ((calc.weight / calc.estimated1RM) * 100).toFixed(1);
                          return (
                            <TableRow key={calc.reps}>
                              <TableCell className="text-center font-medium">
                                {calc.reps}
                              </TableCell>
                              <TableCell className="text-center font-semibold text-lg">
                                {calc.weight}
                              </TableCell>
                              <TableCell className="text-center text-muted-foreground">
                                {percentageOf1RM}%
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge 
                                  variant={
                                    calc.rpeEstimate && calc.rpeEstimate >= 9 
                                      ? "destructive" 
                                      : calc.rpeEstimate && calc.rpeEstimate >= 8 
                                      ? "default" 
                                      : "secondary"
                                  }
                                >
                                  {calc.rpeEstimate?.toFixed(1) || "-"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>

              <div className="p-4 bg-muted rounded-md">
                <p className="text-xs text-muted-foreground">
                  <strong>Note:</strong> Calculations are estimates based on the Epley formula and your exercise history. 
                  Actual performance may vary based on factors like fatigue, form, and training conditions. 
                  Use these as guidelines and adjust based on how you feel.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-2">No exercise history found.</p>
              <p className="text-sm">
                Complete some sets to see rep calculations based on your performance.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Workout Completion Dialog */}
      <Dialog 
        open={workoutCompletionDialogOpen} 
        onOpenChange={(open) => {
          if (!open && !saving) {
            // Reset form if closing without saving
            setWorkoutDifficultyRating(5);
            setWorkoutFeedbackNotes("");
            setWorkoutPBs([]);
            setPendingWorkoutData(null);
          }
          setWorkoutCompletionDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">How was this workout?</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Difficulty Rating with Emojis */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">How difficult was this workout?</Label>
              <div className="space-y-3">
                {/* Emoji Scale */}
                <div className="flex items-center justify-between px-2">
                  {[
                    { value: 1, emoji: "😴", label: "Very Easy" },
                    { value: 2, emoji: "😌", label: "Easy" },
                    { value: 3, emoji: "😊", label: "Medium" },
                    { value: 4, emoji: "😅", label: "Challenging" },
                    { value: 5, emoji: "🔥", label: "Very Hard" },
                  ].map(({ value, emoji, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setWorkoutDifficultyRating(value)}
                      className={`flex flex-col items-center gap-1 transition-all ${
                        workoutDifficultyRating === value 
                          ? 'scale-125' 
                          : 'hover:scale-110 opacity-70 hover:opacity-100'
                      }`}
                      title={label}
                    >
                      <span className="text-4xl">{emoji}</span>
                      {workoutDifficultyRating === value && (
                        <span className="text-xs font-medium">{value}</span>
                      )}
                    </button>
                  ))}
                </div>
                
                {/* Slider */}
                <div className="px-2">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={workoutDifficultyRating}
                    onChange={(e) => setWorkoutDifficultyRating(Number(e.target.value))}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Very Easy</span>
                    <span>Very Hard</span>
                  </div>
                </div>
                
                {/* Current Rating Display */}
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Rating: <span className="font-semibold text-foreground">{workoutDifficultyRating}/5</span>
                  </p>
                </div>
              </div>
            </div>

            {/* PB Summary */}
            {workoutPBs.length > 0 && (
              <div className="space-y-3">
                <Label className="text-base font-semibold">Personal Bests Achieved 🏆</Label>
                <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      {workoutPBs.map((pb, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Trophy className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{pb.exerciseName}</p>
                            <p className="text-xs text-muted-foreground">
                              {pb.type === "reps" 
                                ? `${pb.reps} reps at ${pb.weight}kg (Rep PB)`
                                : `${pb.weight}kg × ${pb.reps} reps (Weight PB)`
                              }
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Feedback Notes */}
            <div className="space-y-2">
              <Label htmlFor="workout-feedback" className="text-base font-semibold">
                Workout Notes (Optional)
              </Label>
              <Textarea
                id="workout-feedback"
                placeholder="How did you feel? What went well? What would you change?"
                value={workoutFeedbackNotes}
                onChange={(e) => setWorkoutFeedbackNotes(e.target.value)}
                className="min-h-[100px] resize-none"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">
                {workoutFeedbackNotes.length}/500
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setWorkoutCompletionDialogOpen(false);
                  setWorkoutDifficultyRating(5);
                  setWorkoutFeedbackNotes("");
                  setWorkoutPBs([]);
                  setPendingWorkoutData(null);
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleCompleteWorkout}
                disabled={saving}
              >
                {saving ? "Saving..." : "Complete Workout"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Exercise Dialog */}
      <Dialog 
        open={addExerciseDialogOpen} 
        onOpenChange={(open) => {
          setAddExerciseDialogOpen(open);
          if (!open) {
            setSelectedExercisesToAdd([]);
            setExerciseSearchQuery("");
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Add Exercise to Workout</DialogTitle>
          </DialogHeader>
          
          {/* Search Input */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search exercises..."
              value={exerciseSearchQuery}
              onChange={(e) => setExerciseSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[400px] pr-4">
            {exerciseLibrary.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No exercises found. Create exercises in the Exercise Library first.
              </div>
            ) : (
              <div className="space-y-2">
                {(() => {
                  // Filter exercises that are not already in the workout
                  let availableExercises = exerciseLibrary.filter(
                    exercise => !workout.exercises.some(e => e.exerciseId === exercise.id)
                  );
                  
                  // Apply search filter
                  if (exerciseSearchQuery.trim()) {
                    const query = exerciseSearchQuery.toLowerCase();
                    availableExercises = availableExercises.filter(
                      exercise =>
                        exercise.name.toLowerCase().includes(query) ||
                        exercise.category.toLowerCase().includes(query)
                    );
                  }
                  
                  if (availableExercises.length === 0) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        {exerciseSearchQuery.trim()
                          ? "No exercises match your search."
                          : "All available exercises are already in this workout."}
                      </div>
                    );
                  }
                  
                  return availableExercises.map((exercise) => (
                    <div
                      key={exercise.id}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedExercisesToAdd.includes(exercise.id)
                          ? "bg-primary/10 border-primary"
                          : "hover:bg-accent/50"
                      }`}
                      onClick={() => toggleExerciseSelection(exercise.id)}
                    >
                      <div className="flex-1">
                        <p className="font-medium">{exercise.name}</p>
                        <p className="text-sm text-muted-foreground">{exercise.category}</p>
                      </div>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selectedExercisesToAdd.includes(exercise.id)
                          ? "bg-primary border-primary"
                          : "border-muted-foreground"
                      }`}>
                        {selectedExercisesToAdd.includes(exercise.id) && (
                          <span className="text-primary-foreground text-xs">✓</span>
                        )}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </ScrollArea>
          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setAddExerciseDialogOpen(false);
                setSelectedExercisesToAdd([]);
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleAddExercisesToWorkout}
              disabled={selectedExercisesToAdd.length === 0}
            >
              Add {selectedExercisesToAdd.length > 0 ? `(${selectedExercisesToAdd.length})` : ""}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Exercise Notes Dialog */}
      <Dialog open={exerciseNotesDialogOpen} onOpenChange={setExerciseNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notes for {viewingExerciseNotes?.name || "Exercise"}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {viewingExerciseNotes?.notes ? (
              <p className="text-sm whitespace-pre-wrap">{viewingExerciseNotes.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No notes available for this exercise.</p>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setExerciseNotesDialogOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
