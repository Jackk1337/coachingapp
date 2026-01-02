"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export default function CreateWorkoutProgramPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [programName, setProgramName] = useState("");
  const [description, setDescription] = useState("");
  const [difficultyRating, setDifficultyRating] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleSaveProgram = async () => {
    if (!programName || !user) return;

    setLoading(true);
    try {
      await addDoc(collection(db, "workout_programs"), {
        name: programName,
        description: description || null,
        difficultyRating: difficultyRating || null,
        userId: user.uid,
        routineIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      toast.success("Program created successfully!");
      router.push("/workout-programs");
    } catch (error) {
      console.error("Error saving program: ", error);
      toast.error("Failed to save program.");
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-lg font-semibold">Create Workout Program</h1>
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
                  onChange={(e) => setProgramName(e.target.value)}
                  placeholder="e.g. Starting Strength"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. A comprehensive strength training program..."
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
                    <SelectItem value="Advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => router.push("/workout-programs")}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveProgram}
              disabled={!programName || loading}
              className="flex-1"
            >
              {loading ? "Creating..." : "Create Program"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

