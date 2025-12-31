"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, orderBy, doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, ChevronLeft } from "lucide-react";

interface PersonalRecord {
  id: string;
  exerciseName: string;
  weight: number;
  reps: number;
  userId: string;
  userName?: string;
  userPhotoURL?: string;
  date: any;
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<PersonalRecord[]>([]);

  // Fetch leaderboard (Personal Records)
  useEffect(() => {
    if (!user) return;

    const recordsQuery = query(
      collection(db, "personal_records"),
      orderBy("weight", "desc"),
      orderBy("reps", "desc")
    );

    const unsubscribe = onSnapshot(recordsQuery, async (snapshot) => {
      const recordList: PersonalRecord[] = [];
      
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        let userName = "Unknown User";
        let userPhotoURL: string | undefined;
        
        // Fetch user info
        try {
          const userDoc = await getDoc(doc(db, "users", data.userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            // Prefer handle, fall back to displayName, then email
            userName = userData.handle || userData.displayName || userData.email || "Unknown User";
            userPhotoURL = userData.photoURL;
          }
        } catch (error) {
          console.error("Error fetching user info:", error);
        }

        recordList.push({
          id: docSnap.id,
          ...data,
          userName,
          userPhotoURL,
        } as PersonalRecord);
      }
      
      // Group by exercise and keep only the top record for each
      const groupedByExercise = recordList.reduce((acc, record) => {
        const key = record.exerciseName;
        if (!acc[key] || 
            record.weight > acc[key].weight || 
            (record.weight === acc[key].weight && record.reps > acc[key].reps)) {
          acc[key] = record;
        }
        return acc;
      }, {} as Record<string, PersonalRecord>);
      
      const topRecords = Object.values(groupedByExercise)
        .sort((a, b) => {
          if (b.weight !== a.weight) return b.weight - a.weight;
          return b.reps - a.reps;
        })
        .slice(0, 50); // Top 50 records
      
      setLeaderboard(topRecords);
    }, (error) => {
      console.error("Error fetching leaderboard:", error);
    });

    return () => unsubscribe();
  }, [user]);

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
          <h1 className="text-lg font-semibold">Leaderboards</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="space-y-4">
          {leaderboard.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No personal records yet.</p>
              <p className="text-sm mt-2">Start logging workouts to see records here!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((record, index) => (
                <Card key={record.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={record.userPhotoURL} alt={record.userName} />
                            <AvatarFallback className="text-xs">
                              {record.userName?.charAt(0) || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <p className="font-semibold">{record.userName}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">{record.exerciseName}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">
                          {record.weight}kg
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {record.reps} {record.reps === 1 ? "rep" : "reps"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

