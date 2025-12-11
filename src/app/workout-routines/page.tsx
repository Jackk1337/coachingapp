"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, GripVertical, Pencil, ChevronLeft, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
}

// Sortable Item Component
function SortableExerciseItem({ id, name, onRemove }: { id: string; name: string; onRemove: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between p-2 mb-2 bg-secondary rounded-md">
      <div className="flex items-center gap-2">
        <button {...attributes} {...listeners} className="cursor-grab hover:text-primary">
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </button>
        <span className="font-medium">{name}</span>
      </div>
      <Button variant="ghost" size="icon" onClick={onRemove} className="h-8 w-8 text-destructive">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function WorkoutRoutinesPage() {
  const { user } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  
  // Create/Edit State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [routineName, setRoutineName] = useState("");
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState("");
  
  // Add Exercise Dialog State
  const [isAddExerciseDialogOpen, setIsAddExerciseDialogOpen] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseCategory, setNewExerciseCategory] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

    // Fetch Exercises
    const exercisesQuery = query(
      collection(db, "exercise_library"),
      where("userId", "==", user.uid),
      orderBy("name")
    );

    const unsubscribeExercises = onSnapshot(exercisesQuery, (snapshot) => {
      const exerciseList: Exercise[] = [];
      snapshot.forEach((doc) => {
        exerciseList.push({ id: doc.id, ...doc.data() } as Exercise);
      });
      setExercises(exerciseList);
    });

    return () => {
      unsubscribeRoutines();
      unsubscribeExercises();
    };
  }, [user]);

  const resetForm = () => {
    setRoutineName("");
    setSelectedExercises([]);
    setEditingRoutineId(null);
    setExerciseSearchQuery("");
  };

  const resetAddExerciseForm = () => {
    setNewExerciseName("");
    setNewExerciseCategory("");
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (routine: Routine) => {
    setEditingRoutineId(routine.id);
    setRoutineName(routine.name);
    // Map existing exerciseIds to full Exercise objects, maintaining order
    const currentExercises = routine.exerciseIds
      .map(id => exercises.find(e => e.id === id))
      .filter((e): e is Exercise => e !== undefined);
    
    setSelectedExercises(currentExercises);
    setIsDialogOpen(true);
  };

  const handleSaveRoutine = async () => {
    if (!routineName || selectedExercises.length === 0 || !user) return;

    try {
      const exerciseIds = selectedExercises.map(e => e.id);
      
      if (editingRoutineId) {
        // Update existing routine
        await updateDoc(doc(db, "workout_routines", editingRoutineId), {
          name: routineName,
          exerciseIds: exerciseIds,
          updatedAt: new Date(),
        });
        toast.success("Routine updated successfully!");
      } else {
        // Create new routine
        await addDoc(collection(db, "workout_routines"), {
          name: routineName,
          exerciseIds: exerciseIds,
          userId: user.uid,
          createdAt: new Date(),
        });
        toast.success("Routine created successfully!");
      }
      
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving routine: ", error);
      toast.error("Failed to save routine.");
    }
  };

  const handleDeleteRoutine = async (id: string) => {
    if (confirm("Are you sure you want to delete this routine?")) {
      await deleteDoc(doc(db, "workout_routines", id));
      toast.success("Routine deleted.");
    }
  };

  const toggleExerciseSelection = (exercise: Exercise) => {
    setSelectedExercises((prev) => {
      const exists = prev.find((e) => e.id === exercise.id);
      if (exists) {
        return prev.filter((e) => e.id !== exercise.id);
      } else {
        return [...prev, exercise];
      }
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSelectedExercises((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const getExerciseName = (id: string) => {
    const exercise = exercises.find((e) => e.id === id);
    return exercise ? exercise.name : "Unknown Exercise";
  };

  const handleAddNewExercise = async () => {
    if (!newExerciseName || !newExerciseCategory || !user) return;

    try {
      const docRef = await addDoc(collection(db, "exercise_library"), {
        name: newExerciseName,
        category: newExerciseCategory,
        userId: user.uid,
        createdAt: new Date(),
      });
      
      // Automatically add the new exercise to selected exercises
      const newExercise: Exercise = {
        id: docRef.id,
        name: newExerciseName,
        category: newExerciseCategory as Exercise["category"],
      };
      setSelectedExercises((prev) => [...prev, newExercise]);
      
      resetAddExerciseForm();
      setIsAddExerciseDialogOpen(false);
      toast.success("Exercise created and added to routine!");
    } catch (error) {
      console.error("Error adding exercise: ", error);
      toast.error("Failed to create exercise.");
    }
  };

  // Filter exercises based on search query
  const filteredExercises = exercises.filter((exercise) => {
    if (!exerciseSearchQuery.trim()) return true;
    const query = exerciseSearchQuery.toLowerCase();
    return (
      exercise.name.toLowerCase().includes(query) ||
      exercise.category.toLowerCase().includes(query)
    );
  });

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

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogTrigger asChild>
          <Button className="w-full mb-6" onClick={handleOpenCreate}>Create New Routine</Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingRoutineId ? "Edit Workout Routine" : "Create Workout Routine"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 flex-1 overflow-hidden flex flex-col">
            <div className="grid gap-2">
              <Label htmlFor="name">Routine Name</Label>
              <Input
                id="name"
                value={routineName}
                onChange={(e) => setRoutineName(e.target.value)}
                placeholder="e.g. Push Day"
              />
            </div>

            <div className="flex-1 overflow-hidden flex flex-col min-h-[200px]">
              <div className="grid grid-cols-2 gap-4 h-full">
                {/* Available Exercises */}
                <div className="flex flex-col h-full border rounded-md overflow-hidden">
                  <div className="p-2 bg-muted font-medium text-sm border-b flex items-center justify-between">
                    <span>All Exercises</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setIsAddExerciseDialogOpen(true)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      New
                    </Button>
                  </div>
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search exercises..."
                        value={exerciseSearchQuery}
                        onChange={(e) => setExerciseSearchQuery(e.target.value)}
                        className="pl-8 h-8 text-sm"
                      />
                    </div>
                  </div>
                  <ScrollArea className="flex-1 p-2">
                    {filteredExercises.map((exercise) => {
                        const isSelected = selectedExercises.some(e => e.id === exercise.id);
                        return (
                            <div key={exercise.id} className="flex items-center space-x-2 mb-2">
                                <Checkbox
                                id={exercise.id}
                                checked={isSelected}
                                onCheckedChange={() => toggleExerciseSelection(exercise)}
                                />
                                <Label htmlFor={exercise.id} className="cursor-pointer text-sm flex-1">
                                {exercise.name}
                                </Label>
                            </div>
                        )
                    })}
                    {filteredExercises.length === 0 && exercises.length > 0 && (
                      <p className="text-xs text-muted-foreground">No exercises match your search.</p>
                    )}
                    {exercises.length === 0 && <p className="text-xs text-muted-foreground">No exercises found. Create one!</p>}
                  </ScrollArea>
                </div>

                {/* Selected Exercises (Sortable) */}
                <div className="flex flex-col h-full border rounded-md overflow-hidden">
                  <div className="p-2 bg-muted font-medium text-sm border-b">Selected (Drag to Order)</div>
                  <ScrollArea className="flex-1 p-2">
                    <DndContext 
                      sensors={sensors} 
                      collisionDetection={closestCenter} 
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext 
                        items={selectedExercises.map(e => e.id)} 
                        strategy={verticalListSortingStrategy}
                      >
                        {selectedExercises.map((exercise) => (
                          <SortableExerciseItem 
                            key={exercise.id} 
                            id={exercise.id} 
                            name={exercise.name} 
                            onRemove={() => toggleExerciseSelection(exercise)} 
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                    {selectedExercises.length === 0 && (
                        <div className="text-center py-4 text-xs text-muted-foreground">
                            Select exercises from the left list.
                        </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </div>

            <Button onClick={handleSaveRoutine} disabled={!routineName || selectedExercises.length === 0}>
              {editingRoutineId ? "Update Routine" : "Save Routine"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpenEdit(routine)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
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
