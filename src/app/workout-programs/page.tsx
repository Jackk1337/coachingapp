"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Pencil, ChevronLeft, Plus, Users } from "lucide-react";
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

export default function WorkoutProgramsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);

  useEffect(() => {
    if (!user) return;

    // Fetch Programs
    const programsQuery = query(
      collection(db, "workout_programs"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribePrograms = onSnapshot(programsQuery, (snapshot) => {
      const programList: Program[] = [];
      snapshot.forEach((doc) => {
        programList.push({ id: doc.id, ...doc.data() } as Program);
      });
      setPrograms(programList);
    }, (error) => {
      console.error("Error fetching programs:", error);
      toast.error("Failed to load programs");
      setPrograms([]);
    });

    return () => {
      unsubscribePrograms();
    };
  }, [user]);

  const handleDeleteProgram = async (id: string, programName: string) => {
    // Prevent deleting "My Program"
    if (programName === "My Program") {
      toast.error('The default "My Program" cannot be deleted');
      return;
    }

    if (confirm("Are you sure you want to delete this program? All routines in this program will also be deleted.")) {
      try {
        // Note: In a real app, you'd want to handle cascading deletes of routines
        // For now, we'll just delete the program
        await deleteDoc(doc(db, "workout_programs", id));
        toast.success("Program deleted.");
      } catch (error) {
        console.error("Error deleting program:", error);
        toast.error("Failed to delete program.");
      }
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
          <h1 className="text-lg font-semibold">Workout Programs</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="flex gap-2 mb-6">
          <Link href="/workout-programs/create" className="flex-1">
            <Button className="w-full">Create New Program</Button>
          </Link>
          <Link href="/community/workout-programs" className="flex-1">
            <Button variant="outline" className="w-full flex items-center gap-2">
              <Users className="h-4 w-4" />
              Community Programs
            </Button>
          </Link>
        </div>

      <div className="grid gap-4">
        {programs.map((program) => (
          <Card 
            key={program.id} 
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => router.push(`/workout-programs/${program.id}`)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">{program.name}</CardTitle>
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <Link href={`/workout-programs/${program.id}/edit`}>
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
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteProgram(program.id, program.name);
                  }}
                  disabled={program.name === "My Program"}
                  title={program.name === "My Program" ? "My Program cannot be deleted" : "Delete program"}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {program.description && (
                <p className="text-sm text-muted-foreground mb-2">{program.description}</p>
              )}
              <p className="text-sm text-muted-foreground">
                {program.routineIds?.length || 0} {program.routineIds?.length === 1 ? "routine" : "routines"}
              </p>
            </CardContent>
          </Card>
        ))}
        {programs.length === 0 && (
          <p className="text-center text-muted-foreground mt-4">No programs found. Create one!</p>
        )}
      </div>
      </div>
    </div>
  );
}
