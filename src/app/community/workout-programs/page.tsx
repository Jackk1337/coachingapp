"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, orderBy, doc, getDoc, getDocs } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users, Dumbbell, ChevronLeft, Heart, Filter } from "lucide-react";
import { toast } from "sonner";

interface CommunityWorkoutProgram {
  id: string;
  name: string;
  routines?: Array<{
    name: string;
    exerciseIds: string[];
    description?: string;
    difficultyRating?: string;
    exerciseNotes?: Record<string, string>;
  }>;
  createdBy: string;
  createdByName?: string;
  createdAt: any;
  copyCount?: number;
  likeCount?: number;
  description?: string;
  difficultyRating?: string;
}

type SortFilter = "newest" | "most_popular" | "most_liked";

export default function CommunityWorkoutProgramsPage() {
  const { user } = useAuth();
  const [programs, setPrograms] = useState<CommunityWorkoutProgram[]>([]);
  const [programSearch, setProgramSearch] = useState("");
  const [sortFilter, setSortFilter] = useState<SortFilter>("newest");
  const [loading, setLoading] = useState(true);

  // Fetch community workout programs
  useEffect(() => {
    if (!user) return;

    const programsQuery = query(
      collection(db, "community_workout_programs"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(programsQuery, async (snapshot) => {
      const programList: CommunityWorkoutProgram[] = [];
      
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        let createdByName = "Unknown User";
        
        // Fetch creator name
        try {
          const userDoc = await getDoc(doc(db, "users", data.createdBy));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            // Prefer handle, fall back to displayName, then email
            createdByName = userData.handle || userData.displayName || userData.email || "Unknown User";
          }
        } catch (error) {
          console.error("Error fetching user name:", error);
        }

        // Fetch copy count - prefer field value, fallback to subcollection count
        let copyCount = data.copyCount || 0;
        if (!copyCount) {
          try {
            const copiesSnapshot = await getDocs(collection(db, "community_workout_programs", docSnap.id, "copies"));
            copyCount = copiesSnapshot.size;
          } catch (error) {
            console.error("Error fetching copy count:", error);
          }
        }

        // Fetch like count
        let likeCount = data.likeCount || 0;
        if (!likeCount) {
          try {
            const likesSnapshot = await getDocs(collection(db, "community_workout_programs", docSnap.id, "likes"));
            likeCount = likesSnapshot.size;
          } catch (error) {
            console.error("Error fetching likes:", error);
          }
        }

        programList.push({
          id: docSnap.id,
          ...data,
          createdByName,
          copyCount,
          likeCount,
        } as CommunityWorkoutProgram);
      }
      
      setPrograms(programList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching community workout programs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);


  // Filter and sort programs
  const filteredAndSortedPrograms = programs
    .filter((program) => {
      if (!programSearch) return true;
      const searchLower = programSearch.toLowerCase();
      const searchWithoutAt = searchLower.startsWith("@") ? searchLower.slice(1) : searchLower;
      
      // Search by name
      if (program.name.toLowerCase().includes(searchLower)) return true;
      
      // Search by handle (with or without @)
      if (program.createdByName) {
        const handleLower = program.createdByName.toLowerCase();
        const handleWithoutAt = handleLower.startsWith("@") ? handleLower.slice(1) : handleLower;
        if (handleLower.includes(searchLower) || handleWithoutAt.includes(searchWithoutAt)) return true;
      }
      
      return false;
    })
    .sort((a, b) => {
      switch (sortFilter) {
        case "most_popular":
          return (b.copyCount || 0) - (a.copyCount || 0);
        case "most_liked":
          return (b.likeCount || 0) - (a.likeCount || 0);
        case "newest":
        default:
          return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
      }
    });

  const routineCount = (program: CommunityWorkoutProgram) => {
    return program.routines?.length || 0;
  };

  const totalExerciseCount = (program: CommunityWorkoutProgram) => {
    return program.routines?.reduce((total, routine) => total + (routine.exerciseIds?.length || 0), 0) || 0;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/community">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Community Workout Programs</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or @handle..."
                value={programSearch}
                onChange={(e) => setProgramSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={sortFilter} onValueChange={(value) => setSortFilter(value as SortFilter)}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="most_popular">Most Popular</SelectItem>
                <SelectItem value="most_liked">Most Liked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading programs...
            </div>
          ) : filteredAndSortedPrograms.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Dumbbell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No community workout programs found.</p>
              <p className="text-sm mt-2">Be the first to share a program!</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredAndSortedPrograms.map((program) => (
                <Card key={program.id} className="cursor-pointer hover:border-primary transition-colors">
                  <Link href={`/community/workout-programs/${program.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{program.name}</CardTitle>
                          <CardDescription className="mt-1">
                            By {program.createdByName}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                        <Badge variant="secondary">
                          {routineCount(program)} {routineCount(program) === 1 ? "routine" : "routines"}
                        </Badge>
                        <Badge variant="secondary">
                          {totalExerciseCount(program)} {totalExerciseCount(program) === 1 ? "exercise" : "exercises"}
                        </Badge>
                        {program.copyCount && program.copyCount > 0 && (
                          <Badge variant="outline">
                            <Users className="h-3 w-3 mr-1" />
                            {program.copyCount} {program.copyCount === 1 ? "copy" : "copies"}
                          </Badge>
                        )}
                        {program.likeCount !== undefined && program.likeCount > 0 && (
                          <Badge variant="outline" className="gap-1">
                            <Heart className="h-3 w-3 fill-red-500 text-red-500" />
                            {program.likeCount} {program.likeCount === 1 ? "like" : "likes"}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
