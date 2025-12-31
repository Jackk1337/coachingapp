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

interface CommunityWorkout {
  id: string;
  name: string;
  exerciseIds: string[];
  createdBy: string;
  createdByName?: string;
  createdAt: any;
  copyCount?: number;
  likeCount?: number;
  description?: string;
  difficultyRating?: string;
  exerciseNotes?: Record<string, string>;
}

type SortFilter = "newest" | "most_popular" | "most_liked";

export default function CommunityWorkoutsPage() {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<CommunityWorkout[]>([]);
  const [workoutSearch, setWorkoutSearch] = useState("");
  const [sortFilter, setSortFilter] = useState<SortFilter>("newest");
  const [loading, setLoading] = useState(true);

  // Fetch community workouts
  useEffect(() => {
    if (!user) return;

    const workoutsQuery = query(
      collection(db, "community_workouts"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(workoutsQuery, async (snapshot) => {
      const workoutList: CommunityWorkout[] = [];
      
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
            const copiesSnapshot = await getDocs(collection(db, "community_workouts", docSnap.id, "copies"));
            copyCount = copiesSnapshot.size;
          } catch (error) {
            console.error("Error fetching copy count:", error);
          }
        }

        // Fetch like count
        let likeCount = data.likeCount || 0;
        if (!likeCount) {
          try {
            const likesSnapshot = await getDocs(collection(db, "community_workouts", docSnap.id, "likes"));
            likeCount = likesSnapshot.size;
          } catch (error) {
            console.error("Error fetching likes:", error);
          }
        }

        workoutList.push({
          id: docSnap.id,
          ...data,
          createdByName,
          copyCount,
          likeCount,
        } as CommunityWorkout);
      }
      
      setWorkouts(workoutList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching community workouts:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);


  // Filter and sort workouts
  const filteredAndSortedWorkouts = workouts
    .filter((workout) => {
      if (!workoutSearch) return true;
      const searchLower = workoutSearch.toLowerCase();
      const searchWithoutAt = searchLower.startsWith("@") ? searchLower.slice(1) : searchLower;
      
      // Search by name
      if (workout.name.toLowerCase().includes(searchLower)) return true;
      
      // Search by handle (with or without @)
      if (workout.createdByName) {
        const handleLower = workout.createdByName.toLowerCase();
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
          <h1 className="text-lg font-semibold">Community Workouts</h1>
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
                value={workoutSearch}
                onChange={(e) => setWorkoutSearch(e.target.value)}
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
              Loading workouts...
            </div>
          ) : filteredAndSortedWorkouts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Dumbbell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No community workouts found.</p>
              <p className="text-sm mt-2">Be the first to share a workout!</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredAndSortedWorkouts.map((workout) => (
                <Card key={workout.id} className="cursor-pointer hover:border-primary transition-colors">
                  <Link href={`/community/workouts/${workout.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{workout.name}</CardTitle>
                          <CardDescription className="mt-1">
                            By {workout.createdByName}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                        <Badge variant="secondary">
                          {workout.exerciseIds.length} {workout.exerciseIds.length === 1 ? "exercise" : "exercises"}
                        </Badge>
                        {workout.copyCount && workout.copyCount > 0 && (
                          <Badge variant="outline">
                            <Users className="h-3 w-3 mr-1" />
                            {workout.copyCount} {workout.copyCount === 1 ? "copy" : "copies"}
                          </Badge>
                        )}
                        {workout.likeCount !== undefined && workout.likeCount > 0 && (
                          <Badge variant="outline" className="gap-1">
                            <Heart className="h-3 w-3 fill-red-500 text-red-500" />
                            {workout.likeCount} {workout.likeCount === 1 ? "like" : "likes"}
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

