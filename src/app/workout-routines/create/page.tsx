"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, orderBy, doc, setDoc, updateDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, GripVertical, ChevronLeft, Plus, Search, FileText } from "lucide-react";
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
  description?: string;
  difficultyRating?: string;
  exerciseNotes?: Record<string, string>;
  sharedToCommunity?: boolean;
  communityWorkoutId?: string;
}

// Sortable Item Component
function SortableExerciseItem({ 
  id, 
  name, 
  onRemove, 
  onEditNotes, 
  hasNotes 
}: { 
  id: string; 
  name: string; 
  onRemove: () => void;
  onEditNotes: () => void;
  hasNotes: boolean;
}) {
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
    <div ref={setNodeRef} style={style} className="flex items-center justify-between p-3 mb-2 bg-secondary rounded-md">
      <div className="flex items-center gap-2">
        <button {...attributes} {...listeners} className="cursor-grab hover:text-primary">
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </button>
        <span className="font-medium">{name}</span>
      </div>
      <div className="flex items-center gap-1">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onEditNotes} 
          className="h-8 w-8"
          title="Edit notes"
        >
          <FileText className={`h-4 w-4 ${hasNotes ? "text-primary" : "text-muted-foreground"}`} />
        </Button>
        <Button variant="ghost" size="icon" onClick={onRemove} className="h-8 w-8 text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function CreateWorkoutRoutinePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [routineName, setRoutineName] = useState("");
  const [description, setDescription] = useState("");
  const [difficultyRating, setDifficultyRating] = useState<string>("");
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>({});
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState("");
  const [sharedToCommunity, setSharedToCommunity] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Add Exercise Dialog State
  const [isAddExerciseDialogOpen, setIsAddExerciseDialogOpen] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseCategory, setNewExerciseCategory] = useState("");
  
  // Exercise Notes Dialog State
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [editingExerciseName, setEditingExerciseName] = useState<string>("");
  const [editingNotes, setEditingNotes] = useState<string>("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!user) return;

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
      unsubscribeExercises();
    };
  }, [user]);

  const resetAddExerciseForm = () => {
    setNewExerciseName("");
    setNewExerciseCategory("");
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

  const handleOpenNotesDialog = (exerciseId: string, exerciseName: string) => {
    setEditingExerciseId(exerciseId);
    setEditingExerciseName(exerciseName);
    setEditingNotes(exerciseNotes[exerciseId] || "");
    setNotesDialogOpen(true);
  };

  const handleSaveNotes = () => {
    if (editingExerciseId) {
      setExerciseNotes((prev) => ({
        ...prev,
        [editingExerciseId]: editingNotes,
      }));
      setNotesDialogOpen(false);
      setEditingExerciseId(null);
      setEditingExerciseName("");
      setEditingNotes("");
    }
  };

  const handleCloseNotesDialog = () => {
    setNotesDialogOpen(false);
    setEditingExerciseId(null);
    setEditingExerciseName("");
    setEditingNotes("");
  };

  const handleSaveRoutine = async () => {
    if (!routineName || selectedExercises.length === 0 || !user) return;

    setLoading(true);
    try {
      const exerciseIds = selectedExercises.map(e => e.id);
      
      // Filter exerciseNotes to only include notes for exercises in the routine
      const filteredExerciseNotes: Record<string, string> = {};
      exerciseIds.forEach((id) => {
        if (exerciseNotes[id]) {
          filteredExerciseNotes[id] = exerciseNotes[id];
        }
      });
      
      // Create routine first
      const routineRef = await addDoc(collection(db, "workout_routines"), {
        name: routineName,
        exerciseIds: exerciseIds,
        description: description || null,
        difficultyRating: difficultyRating || null,
        exerciseNotes: Object.keys(filteredExerciseNotes).length > 0 ? filteredExerciseNotes : null,
        userId: user.uid,
        createdAt: new Date(),
        sharedToCommunity: sharedToCommunity,
      });

      // If sharing to community, create community workout entry
      if (sharedToCommunity) {
        const communityWorkoutRef = doc(collection(db, "community_workouts"));
        await setDoc(communityWorkoutRef, {
          name: routineName,
          exerciseIds: exerciseIds,
          description: description || null,
          difficultyRating: difficultyRating || null,
          exerciseNotes: Object.keys(filteredExerciseNotes).length > 0 ? filteredExerciseNotes : null,
          createdBy: user.uid,
          createdAt: new Date(),
          sourceRoutineId: routineRef.id,
        });

        // Update routine with community workout ID
        await updateDoc(doc(db, "workout_routines", routineRef.id), {
          communityWorkoutId: communityWorkoutRef.id,
        });
      }

      toast.success("Routine created successfully!");
      router.push("/workout-routines");
    } catch (error) {
      console.error("Error saving routine: ", error);
      toast.error("Failed to save routine.");
    } finally {
      setLoading(false);
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

  // Group filtered exercises by category
  const exercisesByCategory = filteredExercises.reduce((acc, exercise) => {
    const category = exercise.category || "Uncategorized";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(exercise);
    return acc;
  }, {} as Record<string, Exercise[]>);

  // Sort categories alphabetically
  const sortedCategories = Object.keys(exercisesByCategory).sort();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/workout-routines">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Create Workout Routine</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </div>

      <div className="px-4 py-6 max-w-4xl mx-auto">
        <div className="space-y-6">
          {/* Routine Name */}
          <Card>
            <CardHeader>
              <CardTitle>Routine Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Routine Name</Label>
                <Input
                  id="name"
                  value={routineName}
                  onChange={(e) => setRoutineName(e.target.value)}
                  placeholder="e.g. Push Day"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Focus on upper body strength..."
                  className="min-h-[80px]"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="difficulty">Difficulty Rating</Label>
                <Select value={difficultyRating} onValueChange={setDifficultyRating}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Beginner">Beginner</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Share with Community Checkbox */}
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="share-community"
                  checked={sharedToCommunity}
                  onCheckedChange={(checked) => setSharedToCommunity(checked === true)}
                />
                <Label htmlFor="share-community" className="cursor-pointer">
                  Share with the community
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Exercise Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Exercises</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[500px]">
                {/* Available Exercises */}
                <div className="flex flex-col h-full border rounded-md overflow-hidden">
                  <div className="p-3 bg-muted font-medium text-sm border-b flex items-center justify-between">
                    <span>All Exercises</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setIsAddExerciseDialogOpen(true)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      New
                    </Button>
                  </div>
                  <div className="p-3 border-b">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search exercises..."
                        value={exerciseSearchQuery}
                        onChange={(e) => setExerciseSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <ScrollArea className="flex-1 p-3">
                    {sortedCategories.length > 0 ? (
                      sortedCategories.map((category) => (
                        <div key={category} className="mb-4">
                          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 sticky top-0 bg-background py-1 z-10">
                            {category}
                          </h3>
                          <div className="space-y-1">
                            {exercisesByCategory[category].map((exercise) => {
                              const isSelected = selectedExercises.some(e => e.id === exercise.id);
                              return (
                                <div key={exercise.id} className="flex items-center space-x-2 mb-1">
                                  <Checkbox
                                    id={exercise.id}
                                    checked={isSelected}
                                    onCheckedChange={() => toggleExerciseSelection(exercise)}
                                  />
                                  <Label htmlFor={exercise.id} className="cursor-pointer text-sm flex-1">
                                    {exercise.name}
                                  </Label>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    ) : (
                      <>
                        {filteredExercises.length === 0 && exercises.length > 0 && (
                          <p className="text-xs text-muted-foreground">No exercises match your search.</p>
                        )}
                        {exercises.length === 0 && (
                          <p className="text-xs text-muted-foreground">No exercises found. Create one!</p>
                        )}
                      </>
                    )}
                  </ScrollArea>
                </div>

                {/* Selected Exercises (Sortable) */}
                <div className="flex flex-col h-full border rounded-md overflow-hidden">
                  <div className="p-3 bg-muted font-medium text-sm border-b">Selected (Drag to Order)</div>
                  <ScrollArea className="flex-1 p-3">
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
                            onEditNotes={() => handleOpenNotesDialog(exercise.id, exercise.name)}
                            hasNotes={!!exerciseNotes[exercise.id]}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                    {selectedExercises.length === 0 && (
                        <div className="text-center py-8 text-xs text-muted-foreground">
                            Select exercises from the left list.
                        </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex gap-4">
            <Button 
              variant="outline" 
              onClick={() => router.push("/workout-routines")}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveRoutine} 
              disabled={!routineName || selectedExercises.length === 0 || loading}
              className="flex-1"
            >
              {loading ? "Saving..." : "Save Routine"}
            </Button>
          </div>
        </div>
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

      {/* Exercise Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={handleCloseNotesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notes for {editingExerciseName}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="exercise-notes">Exercise Notes</Label>
              <Textarea
                id="exercise-notes"
                value={editingNotes}
                onChange={(e) => setEditingNotes(e.target.value)}
                placeholder="Add notes for this exercise..."
                className="min-h-[120px]"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCloseNotesDialog}>
                Cancel
              </Button>
              <Button onClick={handleSaveNotes}>
                Save Notes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

