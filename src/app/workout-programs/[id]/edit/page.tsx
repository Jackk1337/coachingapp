"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft } from "lucide-react";
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
  sharedToCommunity?: boolean;
  communityProgramId?: string;
}

export default function EditWorkoutProgramPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const programId = params?.id as string;
  
  const [program, setProgram] = useState<Program | null>(null);
  const [programName, setProgramName] = useState("");
  const [description, setDescription] = useState("");
  const [difficultyRating, setDifficultyRating] = useState<string>("");
  const [sharedToCommunity, setSharedToCommunity] = useState(false);
  const [originalCommunityProgramId, setOriginalCommunityProgramId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isMyProgram = program?.name === "My Program";

  useEffect(() => {
    if (!user || !programId) return;

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
          setProgramName(programData.name);
          setDescription(programData.description || "");
          setDifficultyRating(programData.difficultyRating || "");
          setSharedToCommunity(!!programData.communityProgramId || !!programData.sharedToCommunity);
          setOriginalCommunityProgramId(programData.communityProgramId || null);
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

  const handleSaveProgram = async () => {
    if (!programName || !user || !programId) return;

    // Prevent editing "My Program" name or sharing it
    if (isMyProgram && (programName !== "My Program" || sharedToCommunity)) {
      if (programName !== "My Program") {
        toast.error('The default "My Program" cannot be renamed');
        setProgramName("My Program");
        return;
      }
      if (sharedToCommunity) {
        toast.error('The default "My Program" cannot be shared with the community');
        setSharedToCommunity(false);
        return;
      }
    }

    setSaving(true);
    try {
      const { collection: getCollection, addDoc, setDoc, deleteDoc } = await import("firebase/firestore");

      // Update program
      await updateDoc(doc(db, "workout_programs", programId), {
        name: programName,
        description: description || null,
        difficultyRating: difficultyRating || null,
        updatedAt: new Date(),
        sharedToCommunity: isMyProgram ? false : sharedToCommunity,
      });

      // Handle sharing/unsharing logic (only if not "My Program")
      if (!isMyProgram) {
        if (sharedToCommunity) {
          // If already shared, update the community program
          if (originalCommunityProgramId) {
            // Fetch routines for the program
            const routinesQuery = await import("firebase/firestore");
            const routineIds = program?.routineIds || [];
            
            if (routineIds.length > 0) {
              const routines: any[] = [];
              const batchSize = 10;
              for (let i = 0; i < routineIds.length; i += batchSize) {
                const batch = routineIds.slice(i, i + batchSize);
                const { getDocs, query, where, documentId } = await import("firebase/firestore");
                const routinesSnapshot = await getDocs(
                  query(
                    getCollection(db, "workout_routines"),
                    where(documentId(), "in", batch),
                    where("userId", "==", user.uid)
                  )
                );
                routinesSnapshot.forEach((doc) => {
                  const data = doc.data();
                  routines.push({
                    name: data.name,
                    exerciseIds: data.exerciseIds || [],
                    description: data.description,
                    difficultyRating: data.difficultyRating,
                    exerciseNotes: data.exerciseNotes,
                  });
                });
              }

              await updateDoc(doc(db, "community_workout_programs", originalCommunityProgramId), {
                name: programName,
                description: description || null,
                difficultyRating: difficultyRating || null,
                routines: routines,
              });
            }
          } else {
            // If not previously shared, create new community program
            const routineIds = program?.routineIds || [];
            const routines: any[] = [];
            
            if (routineIds.length > 0) {
              const batchSize = 10;
              for (let i = 0; i < routineIds.length; i += batchSize) {
                const batch = routineIds.slice(i, i + batchSize);
                const { getDocs, query, where, documentId } = await import("firebase/firestore");
                const routinesSnapshot = await getDocs(
                  query(
                    getCollection(db, "workout_routines"),
                    where(documentId(), "in", batch),
                    where("userId", "==", user.uid)
                  )
                );
                routinesSnapshot.forEach((doc) => {
                  const data = doc.data();
                  routines.push({
                    name: data.name,
                    exerciseIds: data.exerciseIds || [],
                    description: data.description,
                    difficultyRating: data.difficultyRating,
                    exerciseNotes: data.exerciseNotes,
                  });
                });
              }
            }

            const communityProgramRef = doc(getCollection(db, "community_workout_programs"));
            await setDoc(communityProgramRef, {
              name: programName,
              description: description || null,
              difficultyRating: difficultyRating || null,
              routines: routines,
              createdBy: user.uid,
              createdAt: new Date(),
              sourceProgramId: programId,
            });

            // Update program with community program ID
            await updateDoc(doc(db, "workout_programs", programId), {
              communityProgramId: communityProgramRef.id,
            });
          }
        } else {
          // If unsharing, delete the community program if it exists
          if (originalCommunityProgramId) {
            try {
              await deleteDoc(doc(db, "community_workout_programs", originalCommunityProgramId));
            } catch (error) {
              console.error("Error deleting community program:", error);
            }
            
            // Clear community program ID from program
            await updateDoc(doc(db, "workout_programs", programId), {
              communityProgramId: null,
            });
          }
        }
      }

      toast.success("Program updated successfully!");
      router.push(`/workout-programs/${programId}`);
    } catch (error) {
      console.error("Error saving program: ", error);
      toast.error("Failed to save program.");
    } finally {
      setSaving(false);
    }
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
          <Link href={`/workout-programs/${programId}`}>
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Edit Program</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto">
        <div className="space-y-6">
          {/* Program Details */}
          <Card>
            <CardHeader>
              <CardTitle>Program Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Program Name</Label>
                <Input
                  id="name"
                  value={programName}
                  onChange={(e) => {
                    if (isMyProgram) {
                      toast.error('The default "My Program" cannot be renamed');
                      return;
                    }
                    setProgramName(e.target.value);
                  }}
                  placeholder="e.g. Starting Strength"
                  disabled={isMyProgram}
                />
                {isMyProgram && (
                  <p className="text-xs text-muted-foreground">
                    The default "My Program" cannot be renamed
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. A comprehensive strength training program..."
                  className="min-h-[80px]"
                  disabled={isMyProgram}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="difficulty">Difficulty Rating</Label>
                <Select value={difficultyRating} onValueChange={setDifficultyRating} disabled={isMyProgram}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Beginner">Beginner</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Share with Community Checkbox */}
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="share-community"
                  checked={sharedToCommunity}
                  onCheckedChange={(checked) => setSharedToCommunity(checked === true)}
                  disabled={isMyProgram}
                />
                <Label htmlFor="share-community" className={isMyProgram ? "cursor-not-allowed opacity-50" : "cursor-pointer"}>
                  Share with the community
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => router.push(`/workout-programs/${programId}`)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveProgram}
              disabled={!programName || saving}
              className="flex-1"
            >
              {saving ? "Saving..." : "Update Program"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

