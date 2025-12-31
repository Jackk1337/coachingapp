"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, addDoc, getDoc, doc, deleteDoc, getDocs, documentId } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { format, addDays, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface Routine {
  id: string;
  name: string;
  programId?: string;
}

interface Program {
  id: string;
  name: string;
  routineIds?: string[];
}

interface WorkoutSession {
  id: string;
  date: string; // YYYY-MM-DD
  routineName: string;
  routineId: string;
  status?: "in_progress" | "completed";
}

export default function WorkoutLogPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [programs, setPrograms] = useState<Program[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [todaysWorkouts, setTodaysWorkouts] = useState<WorkoutSession[]>([]);
  const [isStartWorkoutOpen, setIsStartWorkoutOpen] = useState(false);

  // Format date for display (DD/MM/YYYY) and storage (YYYY-MM-DD)
  const displayDate = format(currentDate, "dd/MM/yyyy");
  const dbDate = format(currentDate, "yyyy-MM-dd");

  useEffect(() => {
    if (!user) return;

    // Fetch Programs
    const programsQuery = query(
      collection(db, "workout_programs"),
      where("userId", "==", user.uid),
      orderBy("name")
    );

    const unsubscribePrograms = onSnapshot(programsQuery, (snapshot) => {
      const programList: Program[] = [];
      snapshot.forEach((doc) => {
        programList.push({ id: doc.id, ...doc.data() } as Program);
      });
      setPrograms(programList);
    });

    // Fetch Workouts for current date
    const workoutsQuery = query(
      collection(db, "workout_logs"),
      where("userId", "==", user.uid),
      where("date", "==", dbDate)
    );

    const unsubscribeWorkouts = onSnapshot(workoutsQuery, (snapshot) => {
      const workoutList: WorkoutSession[] = [];
      snapshot.forEach((doc) => {
        workoutList.push({ id: doc.id, ...doc.data() } as WorkoutSession);
      });
      setTodaysWorkouts(workoutList);
    });

    return () => {
      unsubscribePrograms();
      unsubscribeWorkouts();
    };
  }, [user, dbDate]);

  // Fetch routines when program is selected
  useEffect(() => {
    if (!user || !selectedProgramId) {
      setRoutines([]);
      return;
    }

    const fetchRoutinesForProgram = async () => {
      try {
        // Get program to find routineIds
        const programDoc = await getDoc(doc(db, "workout_programs", selectedProgramId));
        if (!programDoc.exists()) {
          setRoutines([]);
          return;
        }

        const programData = programDoc.data() as Program;
        const routineIds = programData.routineIds || [];

        if (routineIds.length === 0) {
          setRoutines([]);
          return;
        }

        // Fetch routines in batches (Firestore 'in' limit is 10)
        const batchSize = 10;
        const batches = [];
        for (let i = 0; i < routineIds.length; i += batchSize) {
          batches.push(routineIds.slice(i, i + batchSize));
        }

        const allRoutines: Routine[] = [];
        await Promise.all(
          batches.map(async (batch) => {
            const routinesQuery = query(
              collection(db, "workout_routines"),
              where(documentId(), "in", batch),
              where("userId", "==", user.uid)
            );
            const snapshot = await getDocs(routinesQuery);
            snapshot.forEach((doc) => {
              allRoutines.push({ id: doc.id, ...doc.data() } as Routine);
            });
          })
        );

        // Sort by name
        allRoutines.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setRoutines(allRoutines);
      } catch (error) {
        console.error("Error fetching routines:", error);
        toast.error("Failed to load routines");
        setRoutines([]);
      }
    };

    fetchRoutinesForProgram();
  }, [user, selectedProgramId]);

  const handleDateChange = (days: number) => {
    setCurrentDate((prev) => (days > 0 ? addDays(prev, days) : subDays(prev, Math.abs(days))));
  };

  const handleStartWorkout = async (routine: Routine) => {
    if (!user) return;
    
    try {
      // Create a new workout log entry
      const docRef = await addDoc(collection(db, "workout_logs"), {
        userId: user.uid,
        date: dbDate,
        routineId: routine.id,
        routineName: routine.name,
        createdAt: new Date(),
        status: "in_progress" 
      });
      setIsStartWorkoutOpen(false);
      toast.success("Workout started!");
      router.push(`/workout-log/${docRef.id}`);
    } catch (error) {
      console.error("Error starting workout:", error);
      toast.error("Failed to start workout.");
    }
  };

  const handleDeleteWorkout = async (workoutId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click event
    
    if (!confirm("Are you sure you want to delete this workout?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "workout_logs", workoutId));
      toast.success("Workout deleted successfully");
    } catch (error) {
      console.error("Error deleting workout:", error);
      toast.error("Failed to delete workout");
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
          <h1 className="text-lg font-semibold">Workout Log</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
        <Button variant="ghost" size="icon" onClick={() => handleDateChange(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-base font-medium">
          {format(currentDate, "EEEE") === format(new Date(), "EEEE") && 
           format(currentDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") 
           ? "Today" 
           : displayDate}
        </span>
        <Button variant="ghost" size="icon" onClick={() => handleDateChange(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="px-4 py-3 border-b bg-muted/30">
        <div className="flex gap-2 mb-3">
          <Link href="/workout-programs" className="flex-1">
            <Button variant="outline" className="w-full" size="sm">
              Workout Programs
            </Button>
          </Link>
          <Link href="/exercise-library" className="flex-1">
            <Button variant="outline" className="w-full" size="sm">
              Exercise Library
            </Button>
          </Link>
        </div>
        <Dialog open={isStartWorkoutOpen} onOpenChange={(open) => {
          setIsStartWorkoutOpen(open);
          if (!open) {
            setSelectedProgramId("");
            setRoutines([]);
          }
        }}>
          <DialogTrigger asChild>
            <Button className="w-full" size="sm">
              <Plus className="mr-2 h-4 w-4" /> Start New Workout
            </Button>
          </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedProgramId ? "Select a Routine" : "Select a Program"}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[300px] mt-2">
            {!selectedProgramId ? (
              <div className="grid gap-2 pr-4">
                {programs.map((program) => (
                  <Button
                    key={program.id}
                    variant="secondary"
                    className="w-full justify-start text-left h-auto py-3 px-4"
                    onClick={() => setSelectedProgramId(program.id)}
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{program.name}</span>
                      <span className="text-xs text-muted-foreground mt-1">
                        {program.routineIds?.length || 0} routines
                      </span>
                    </div>
                  </Button>
                ))}
                {programs.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No programs found. Please create one first.
                    <div className="mt-4">
                      <Link href="/workout-programs">
                        <Button variant="outline" onClick={() => setIsStartWorkoutOpen(false)}>
                          Go to Programs
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-2 pr-4">
                <Button
                  variant="ghost"
                  className="w-full justify-start mb-2"
                  onClick={() => setSelectedProgramId("")}
                >
                  ← Back to Programs
                </Button>
                {routines.map((routine) => (
                  <Button
                    key={routine.id}
                    variant="secondary"
                    className="w-full justify-start text-left h-auto py-3 px-4"
                    onClick={() => handleStartWorkout(routine)}
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{routine.name}</span>
                    </div>
                  </Button>
                ))}
                {routines.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No routines in this program.
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
        </Dialog>
      </div>

      <div>
        {todaysWorkouts.length === 0 ? (
          <div className="px-4 py-8">
            <p className="text-center text-muted-foreground py-8 border border-dashed rounded-lg">
              No workouts logged for this day.
            </p>
          </div>
        ) : (
          <div className="border-t">
            {todaysWorkouts.map((workout) => (
              <div 
                key={workout.id} 
                className="border-b cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => router.push(`/workout-log/${workout.id}`)}
              >
                <div className="flex items-center justify-between px-4 py-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-base">{workout.routineName}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Status: {workout.status === "completed" ? "Completed" : "In Progress"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={(e) => handleDeleteWorkout(workout.id, e)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
