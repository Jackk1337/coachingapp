"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, orderBy, deleteDoc, doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Pencil, ChevronLeft, Plus, Users } from "lucide-react";
import { toast } from "sonner";

interface Exercise {
  id: string;
  name: string;
  category: string;
}

interface Routine {
  id: string;
  name: string;
  exerciseIds: string[];
  userId: string;
  description?: string;
  difficultyRating?: string;
  exerciseNotes?: Record<string, string>;
  sharedToCommunity?: boolean;
  communityWorkoutId?: string;
}

export default function WorkoutRoutinesPage() {
  const { user } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  
  // Add Exercise Dialog State
  const [isAddExerciseDialogOpen, setIsAddExerciseDialogOpen] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseCategory, setNewExerciseCategory] = useState("");

  useEffect(() => {
    if (!user) return;

    // Fetch Routines
    const routinesQuery = query(
      collection(db, "workout_routines"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribeRoutines = onSnapshot(routinesQuery, (snapshot) => {
      const routineList: Routine[] = [];
      snapshot.forEach((doc) => {
        routineList.push({ id: doc.id, ...doc.data() } as Routine);
      });
      setRoutines(routineList);
    });

    // Fetch Exercises - include both user's exercises and rallyfit exercises
    // Sort manually to avoid index requirements
    const exercisesQuery = query(
      collection(db, "exercise_library"),
      where("userId", "in", [user.uid, "rallyfit"])
    );

    const unsubscribeExercises = onSnapshot(
      exercisesQuery, 
      (snapshot) => {
        const exerciseList: Exercise[] = [];
        snapshot.forEach((doc) => {
          exerciseList.push({ id: doc.id, ...doc.data() } as Exercise);
        });
        // Sort manually by name
        exerciseList.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setExercises(exerciseList);
      },
      (error) => {
        console.error("Error fetching exercises:", error);
        toast.error("Failed to load exercises");
        setExercises([]);
      }
    );

    return () => {
      unsubscribeRoutines();
      unsubscribeExercises();
    };
  }, [user]);

  const resetAddExerciseForm = () => {
    setNewExerciseName("");
    setNewExerciseCategory("");
  };

  const handleDeleteRoutine = async (id: string) => {
    if (confirm("Are you sure you want to delete this routine?")) {
      await deleteDoc(doc(db, "workout_routines", id));
      toast.success("Routine deleted.");
    }
  };


  const getExerciseName = (id: string) => {
    const exercise = exercises.find((e) => e.id === id);
    return exercise ? exercise.name : "Unknown Exercise";
  };

  const handleAddNewExercise = async () => {
    if (!newExerciseName || !newExerciseCategory || !user) return;

    try {
      await addDoc(collection(db, "exercise_library"), {
        name: newExerciseName,
        category: newExerciseCategory,
        userId: user.uid,
        createdAt: new Date(),
      });
      
      resetAddExerciseForm();
      setIsAddExerciseDialogOpen(false);
      toast.success("Exercise created successfully!");
    } catch (error) {
      console.error("Error adding exercise: ", error);
      toast.error("Failed to create exercise.");
    }
  };


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/workout-log">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Workout Routines</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="flex gap-2 mb-6">
          <Link href="/workout-routines/create" className="flex-1">
            <Button className="w-full">Create New Routine</Button>
          </Link>
          <Link href="/community/workouts" className="flex-1">
            <Button variant="outline" className="w-full flex items-center gap-2">
              <Users className="h-4 w-4" />
              Browse Community Workouts
            </Button>
          </Link>
        </div>

      {/* Add New Exercise Dialog */}
      <Dialog open={isAddExerciseDialogOpen} onOpenChange={(open) => {
        setIsAddExerciseDialogOpen(open);
        if (!open) resetAddExerciseForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Exercise</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-exercise-name">Exercise Name</Label>
              <Input
                id="new-exercise-name"
                value={newExerciseName}
                onChange={(e) => setNewExerciseName(e.target.value)}
                placeholder="e.g. Bench Press"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-exercise-category">Category</Label>
              <Select onValueChange={setNewExerciseCategory} value={newExerciseCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {["Abs", "Back", "Biceps", "Chest", "Legs", "Shoulders", "Triceps"].map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddNewExercise} disabled={!newExerciseName || !newExerciseCategory}>
              Create Exercise
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4">
        {routines.map((routine) => (
          <Card key={routine.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">{routine.name}</CardTitle>
              <div className="flex gap-2">
                <Link href={`/workout-routines/${routine.id}/edit`}>
                  <Button
                    variant="ghost"
                    size="icon"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteRoutine(routine.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">Exercises:</p>
              <ol className="list-decimal list-inside text-sm">
                {routine.exerciseIds.slice(0, 3).map((id) => (
                  <li key={id}>{getExerciseName(id)}</li>
                ))}
                {routine.exerciseIds.length > 3 && <li>...and {routine.exerciseIds.length - 3} more</li>}
              </ol>
            </CardContent>
          </Card>
        ))}
        {routines.length === 0 && (
          <p className="text-center text-muted-foreground mt-4">No routines found. Create one!</p>
        )}
      </div>
      </div>
    </div>
  );
}
