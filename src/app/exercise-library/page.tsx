"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, orderBy, deleteDoc, doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";

interface Exercise {
  id: string;
  name: string;
  category: "Abs" | "Back" | "Biceps" | "Chest" | "Legs" | "Shoulders" | "Triceps";
  userId: string;
}

const CATEGORIES = ["Abs", "Back", "Biceps", "Chest", "Legs", "Shoulders", "Triceps"];

export default function ExerciseLibraryPage() {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseCategory, setNewExerciseCategory] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "exercise_library"),
      where("userId", "==", user.uid),
      orderBy("name")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const exerciseList: Exercise[] = [];
      snapshot.forEach((doc) => {
        exerciseList.push({ id: doc.id, ...doc.data() } as Exercise);
      });
      setExercises(exerciseList);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAddExercise = async () => {
    if (!newExerciseName || !newExerciseCategory || !user) return;

    try {
      await addDoc(collection(db, "exercise_library"), {
        name: newExerciseName,
        category: newExerciseCategory,
        userId: user.uid,
        createdAt: new Date(),
      });
      setNewExerciseName("");
      setNewExerciseCategory("");
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error adding exercise: ", error);
    }
  };

  const handleDeleteExercise = async (id: string) => {
    if (confirm("Are you sure you want to delete this exercise?")) {
      await deleteDoc(doc(db, "exercise_library", id));
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto min-h-screen pb-20">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Exercise Library</h1>
        <Link href="/workout-log">
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full mb-6">Create New Exercise</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Exercise</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Exercise Name</Label>
              <Input
                id="name"
                value={newExerciseName}
                onChange={(e) => setNewExerciseName(e.target.value)}
                placeholder="e.g. Bench Press"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Select onValueChange={setNewExerciseCategory} value={newExerciseCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddExercise}>Save Exercise</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4">
        {exercises.map((exercise) => (
          <Card key={exercise.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">{exercise.name}</h3>
                <Badge variant="secondary" className="mt-1">
                  {exercise.category}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteExercise(exercise.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {exercises.length === 0 && (
          <p className="text-center text-muted-foreground mt-4">No exercises found. Create one!</p>
        )}
      </div>
    </div>
  );
}

