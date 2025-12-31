"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, getDoc, deleteDoc, updateDoc, getDocs, documentId } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Pencil, ChevronLeft, Plus, Edit } from "lucide-react";
import { toast } from "sonner";

interface Program {
  id: string;
  name: string;
  description?: string;
  difficultyRating?: string;
  userId: string;
  routineIds?: string[];
  createdAt?: any;
  updatedAt?: any;
}

interface Routine {
  id: string;
  name: string;
  exerciseIds: string[];
  description?: string;
  difficultyRating?: string;
  programId?: string;
}

interface Exercise {
  id: string;
  name: string;
  category: string;
}

export default function ProgramDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const programId = params?.id as string;
  
  const [program, setProgram] = useState<Program | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !programId) return;

    // Fetch Program
    const fetchProgram = async () => {
      try {
        const programDoc = await getDoc(doc(db, "workout_programs", programId));
        if (programDoc.exists()) {
          const programData = { id: programDoc.id, ...programDoc.data() } as Program;
          if (programData.userId !== user.uid) {
            toast.error("Access denied");
            router.push("/workout-programs");
            return;
          }
          setProgram(programData);
        } else {
          toast.error("Program not found");
          router.push("/workout-programs");
        }
      } catch (error) {
        console.error("Error fetching program:", error);
        toast.error("Failed to load program");
        router.push("/workout-programs");
      } finally {
        setLoading(false);
      }
    };

    fetchProgram();
  }, [user, programId, router]);

  useEffect(() => {
    if (!user || !program) return;

    // Fetch Exercises for display
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
        exerciseList.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setExercises(exerciseList);
      },
      (error) => {
        console.error("Error fetching exercises:", error);
        setExercises([]);
      }
    );

    // Fetch Routines for this program
    if (program.routineIds && program.routineIds.length > 0) {
      // Use batch queries if more than 10 routines
      const routineIds = program.routineIds;
      const routinesList: Routine[] = [];

      // Firestore 'in' query limit is 10, so batch if needed
      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < routineIds.length; i += batchSize) {
        batches.push(routineIds.slice(i, i + batchSize));
      }

      Promise.all(
        batches.map((batch) => {
          const routinesQuery = query(
            collection(db, "workout_routines"),
            where(documentId(), "in", batch),
            where("userId", "==", user.uid)
          );
          return getDocs(routinesQuery);
        })
      ).then((snapshots) => {
        snapshots.forEach((snapshot) => {
          snapshot.forEach((doc) => {
            routinesList.push({ id: doc.id, ...doc.data() } as Routine);
          });
        });
        
        // Sort routines by the order in program.routineIds
        routinesList.sort((a, b) => {
          const aIndex = routineIds.indexOf(a.id);
          const bIndex = routineIds.indexOf(b.id);
          return aIndex - bIndex;
        });
        
        setRoutines(routinesList);
      }).catch((error) => {
        console.error("Error fetching routines:", error);
        toast.error("Failed to load routines");
      });
    } else {
      setRoutines([]);
    }

    return () => {
      unsubscribeExercises();
    };
  }, [user, program]);

  const handleDeleteRoutine = async (routineId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (confirm("Are you sure you want to delete this routine?")) {
      try {
        // Delete routine
        await deleteDoc(doc(db, "workout_routines", routineId));
        
        // Remove from program's routineIds array
        if (program) {
          const updatedRoutineIds = (program.routineIds || []).filter(id => id !== routineId);
          await updateDoc(doc(db, "workout_programs", program.id), {
            routineIds: updatedRoutineIds,
            updatedAt: new Date(),
          });
        }
        
        toast.success("Routine deleted.");
      } catch (error) {
        console.error("Error deleting routine:", error);
        toast.error("Failed to delete routine.");
      }
    }
  };

  const getExerciseName = (id: string) => {
    const exercise = exercises.find((e) => e.id === id);
    return exercise ? exercise.name : "Unknown Exercise";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading program...</p>
      </div>
    );
  }

  if (!program) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/workout-programs">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">{program.name}</h1>
          <Link href={`/workout-programs/${program.id}/edit`}>
            <Button variant="ghost" size="icon">
              <Edit className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        {/* Program Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{program.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {program.description && (
              <p className="text-sm text-muted-foreground mb-2">{program.description}</p>
            )}
            {program.difficultyRating && (
              <p className="text-sm text-muted-foreground">
                Difficulty: {program.difficultyRating}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Create Routine Button */}
        <Link href={`/workout-routines/create?programId=${program.id}`} className="block mb-6">
          <Button className="w-full">
            <Plus className="mr-2 h-4 w-4" /> Add Routine to Program
          </Button>
        </Link>

        {/* Routines List */}
        <div className="grid gap-4">
          {routines.map((routine) => (
            <Card 
              key={routine.id} 
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => router.push(`/workout-routines/${routine.id}/edit`)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">{routine.name}</CardTitle>
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <Link href={`/workout-routines/${routine.id}/edit`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleDeleteRoutine(routine.id, e)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {routine.description && (
                  <p className="text-sm text-muted-foreground mb-2">{routine.description}</p>
                )}
                <p className="text-sm text-muted-foreground mb-2">Exercises:</p>
                <ol className="list-decimal list-inside text-sm">
                  {routine.exerciseIds.slice(0, 3).map((id) => (
                    <li key={id}>{getExerciseName(id)}</li>
                  ))}
                  {routine.exerciseIds.length > 3 && (
                    <li>...and {routine.exerciseIds.length - 3} more</li>
                  )}
                </ol>
              </CardContent>
            </Card>
          ))}
          {routines.length === 0 && (
            <p className="text-center text-muted-foreground mt-4">
              No routines in this program. Add one!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
