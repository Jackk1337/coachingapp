"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, addDoc, getDoc, doc, deleteDoc } from "firebase/firestore";
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
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [todaysWorkouts, setTodaysWorkouts] = useState<WorkoutSession[]>([]);
  const [isStartWorkoutOpen, setIsStartWorkoutOpen] = useState(false);

  // Format date for display (DD/MM/YYYY) and storage (YYYY-MM-DD)
  const displayDate = format(currentDate, "dd/MM/yyyy");
  const dbDate = format(currentDate, "yyyy-MM-dd");

  useEffect(() => {
    if (!user) return;

    // Fetch Routines for selection
    const routinesQuery = query(
      collection(db, "workout_routines"),
      where("userId", "==", user.uid),
      orderBy("name")
    );

    const unsubscribeRoutines = onSnapshot(routinesQuery, (snapshot) => {
      const routineList: Routine[] = [];
      snapshot.forEach((doc) => {
        routineList.push({ id: doc.id, ...doc.data() } as Routine);
      });
      setRoutines(routineList);
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
      unsubscribeRoutines();
      unsubscribeWorkouts();
    };
  }, [user, dbDate]);

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
          <Link href="/workout-routines" className="flex-1">
            <Button variant="outline" className="w-full" size="sm">
              Workout Routines
            </Button>
          </Link>
          <Link href="/exercise-library" className="flex-1">
            <Button variant="outline" className="w-full" size="sm">
              Exercise Library
            </Button>
          </Link>
        </div>
        <Dialog open={isStartWorkoutOpen} onOpenChange={setIsStartWorkoutOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" size="sm">
              <Plus className="mr-2 h-4 w-4" /> Start New Workout
            </Button>
          </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select a Routine</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[300px] mt-2">
            <div className="grid gap-2 pr-4">
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
                  No routines found. Please create one first.
                  <div className="mt-4">
                    <Link href="/workout-routines">
                      <Button variant="outline" onClick={() => setIsStartWorkoutOpen(false)}>
                        Go to Routines
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
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
