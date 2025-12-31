"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, orderBy, doc, getDoc, addDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Copy, Users, Utensils, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

interface CommunityMeal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  createdBy: string;
  createdByName?: string;
  createdAt: any;
  copyCount?: number;
}

export default function CommunityMealsPage() {
  const { user } = useAuth();
  const [meals, setMeals] = useState<CommunityMeal[]>([]);
  const [mealSearch, setMealSearch] = useState("");

  // Fetch community meals
  useEffect(() => {
    if (!user) return;

    const mealsQuery = query(
      collection(db, "community_meals"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(mealsQuery, async (snapshot) => {
      const mealList: CommunityMeal[] = [];
      
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

        mealList.push({
          id: docSnap.id,
          ...data,
          createdByName,
        } as CommunityMeal);
      }
      
      setMeals(mealList);
    }, (error) => {
      console.error("Error fetching community meals:", error);
    });

    return () => unsubscribe();
  }, [user]);

  const handleCopyMeal = async (meal: CommunityMeal) => {
    if (!user) {
      toast.error("Please log in to copy meals");
      return;
    }

    try {
      // Copy meal to user's food diary
      await addDoc(collection(db, "food_diary"), {
        name: meal.name,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
        userId: user.uid,
        date: new Date(),
        copiedFrom: meal.id,
      });

      // Track copy
      await addDoc(collection(db, "community_meals", meal.id, "copies"), {
        userId: user.uid,
        copiedAt: new Date(),
      });

      toast.success("Meal copied to your food diary!");
    } catch (error) {
      console.error("Error copying meal:", error);
      toast.error("Failed to copy meal");
    }
  };

  const filteredMeals = meals.filter((meal) =>
    meal.name.toLowerCase().includes(mealSearch.toLowerCase())
  );

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
          <h1 className="text-lg font-semibold">Community Meals</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search meals..."
              value={mealSearch}
              onChange={(e) => setMealSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {meals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Utensils className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No community meals found.</p>
              <p className="text-sm mt-2">Be the first to share a meal!</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredMeals.map((meal) => (
                <Card key={meal.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{meal.name}</CardTitle>
                        <CardDescription className="mt-1">
                          By {meal.createdByName}
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyMeal(meal)}
                        className="flex items-center gap-2"
                      >
                        <Copy className="h-4 w-4" />
                        Copy
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Calories</p>
                        <p className="font-semibold">{meal.calories}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Protein</p>
                        <p className="font-semibold">{meal.protein}g</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Carbs</p>
                        <p className="font-semibold">{meal.carbs}g</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Fat</p>
                        <p className="font-semibold">{meal.fat}g</p>
                      </div>
                    </div>
                    {meal.copyCount && meal.copyCount > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <Badge variant="outline" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          {meal.copyCount} {meal.copyCount === 1 ? "copy" : "copies"}
                        </Badge>
                      </div>
                    )}
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

