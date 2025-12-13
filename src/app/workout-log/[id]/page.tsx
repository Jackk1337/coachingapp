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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, Plus, Trash2, Save, History, Search } from "lucide-react";
import { toast } from "sonner";

interface WorkoutSet {
  id: string;
  weight: number;
  reps: number;
  rpe: number;
  completed: boolean;
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
      completed: false
    };

    const updatedExercises = [...workout.exercises];
    updatedExercises[exerciseIndex].sets.push(newSet);
    
    handleUpdate(updatedExercises);
  };

  const handleSetChange = (exerciseIndex: number, setIndex: number, field: keyof WorkoutSet, value: any) => {
    if (!workout) return;
    
    const updatedExercises = [...workout.exercises];
    updatedExercises[exerciseIndex].sets[setIndex] = {
      ...updatedExercises[exerciseIndex].sets[setIndex],
      [field]: field === "completed" ? value : Number(value)
    };
    
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

  // Fetch exercise library for adding exercises
  useEffect(() => {
    if (!user || !addExerciseDialogOpen) return;

    const exercisesQuery = query(
      collection(db, "exercise_library"),
      where("userId", "==", user.uid),
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
      const workoutDocRef = doc(db, "workout_logs", workoutId);
      // Ensure latest data is saved
      await updateDoc(workoutDocRef, {
        exercises: workout.exercises,
        status: "completed",
        endedAt: new Date()
      });
      toast.success("Workout saved and ended!");
      router.push("/workout-log");
    } catch (error) {
      console.error("Error ending workout:", error);
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
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewHistory(exercise.exerciseId, exercise.name)}
                >
                  <History className="h-4 w-4 mr-2" />
                  History
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteExercise(exerciseIndex)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead className="w-[60px] text-center">Set</TableHead>
                     <TableHead className="text-center">kg</TableHead>
                     <TableHead className="text-center">Reps</TableHead>
                     <TableHead className="text-center">RPE</TableHead>
                     <TableHead className="w-[50px]"></TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {exercise.sets.map((set, setIndex) => (
                     <TableRow key={set.id}>
                       <TableCell className="text-center font-medium">{setIndex + 1}</TableCell>
                       <TableCell>
                         <Input 
                           type="number" 
                           className="h-8 text-center" 
                           value={set.weight || ""} 
                           onChange={(e) => handleSetChange(exerciseIndex, setIndex, "weight", e.target.value)}
                         />
                       </TableCell>
                       <TableCell>
                         <Input 
                           type="number" 
                           className="h-8 text-center" 
                           value={set.reps || ""} 
                           onChange={(e) => handleSetChange(exerciseIndex, setIndex, "reps", e.target.value)}
                         />
                       </TableCell>
                       <TableCell>
                         <Input 
                           type="number" 
                           className="h-8 text-center" 
                           value={set.rpe || ""} 
                           onChange={(e) => handleSetChange(exerciseIndex, setIndex, "rpe", e.target.value)}
                         />
                       </TableCell>
                       <TableCell>
                         <Button 
                           variant="ghost" 
                           size="icon" 
                           className="h-8 w-8 text-destructive"
                           onClick={() => handleDeleteSet(exerciseIndex, setIndex)}
                         >
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
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
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedExerciseName} - History</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            {loadingHistory ? (
              <div className="text-center py-8">Loading history...</div>
            ) : exerciseHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No history found for this exercise.
              </div>
            ) : (
              <div className="space-y-6">
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
                            <TableHead className="w-[60px] text-center">Set</TableHead>
                            <TableHead className="text-center">Weight (kg)</TableHead>
                            <TableHead className="text-center">Reps</TableHead>
                            <TableHead className="text-center">RPE</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entry.sets.map((set, index) => (
                            <TableRow key={index}>
                              <TableCell className="text-center font-medium">{index + 1}</TableCell>
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
    </div>
  );
}
