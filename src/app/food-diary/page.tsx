"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Html5Qrcode, Html5QrcodeScanType } from "html5-qrcode";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, setDoc, addDoc, getDocs, getDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { format, addDays, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Plus, Trash2, Search, Scan, Utensils, Bookmark, BookmarkPlus } from "lucide-react";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Food {
  id: string;
  name: string;
  caloriesPer100g: number;
  servingSize: number;
  proteinPer100g: number;
  carbPer100g: number;
  fatPer100g: number;
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
  userId?: string;
  barcode?: string;
  source?: "User Submission" | "API";
  createdAt?: any;
  updatedAt?: any;
  missingFields?: string[]; // For API preview only
}

interface Meal {
  id: string;
  mealNumber: number;
  foods: Food[];
}

interface FoodDiary {
  id: string;
  userId: string;
  date: string;
  meals: Meal[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

const COLORS = {
  protein: "#8884d8",
  carbs: "#82ca9d",
  fat: "#ffc658",
};

// Calorie constants per gram
const CALORIES_PER_GRAM_PROTEIN = 4;
const CALORIES_PER_GRAM_CARB = 4;
const CALORIES_PER_GRAM_FAT = 9;

export default function FoodDiaryPage() {
  const { user, profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [foodDiary, setFoodDiary] = useState<FoodDiary | null>(null);
  const [loading, setLoading] = useState(false);
  const [foodSelectionOpen, setFoodSelectionOpen] = useState(false);
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [createFoodOpen, setCreateFoodOpen] = useState(false);
  const [createFoodLoading, setCreateFoodLoading] = useState(false);
  const [createFoodData, setCreateFoodData] = useState({
    name: "",
    caloriesPer100g: "",
    servingSize: "",
    proteinPer100g: "",
    carbPer100g: "",
    fatPer100g: "",
    barcode: "",
  });
  const [editFoodOpen, setEditFoodOpen] = useState(false);
  const [editFoodId, setEditFoodId] = useState<string | null>(null);
  const [editFoodLoading, setEditFoodLoading] = useState(false);
  const [editFoodData, setEditFoodData] = useState({
    name: "",
    caloriesPer100g: "",
    servingSize: "",
    proteinPer100g: "",
    carbPer100g: "",
    fatPer100g: "",
    barcode: "",
  });
  const [servingSizeDialogOpen, setServingSizeDialogOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [adjustedServingSize, setAdjustedServingSize] = useState<string>("");
  const [editServingSizeDialogOpen, setEditServingSizeDialogOpen] = useState(false);
  const [editingFoodItem, setEditingFoodItem] = useState<{ mealId: string; foodIndex: number; food: Food } | null>(null);
  const [editMealFoodData, setEditMealFoodData] = useState({
    name: "",
    caloriesPer100g: "",
    servingSize: "",
    proteinPer100g: "",
    carbPer100g: "",
    fatPer100g: "",
  });
  const [barcodeDialogOpen, setBarcodeDialogOpen] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState<string>("");
  const [barcodeSearchLoading, setBarcodeSearchLoading] = useState(false);
  const [apiFoodPreviewOpen, setApiFoodPreviewOpen] = useState(false);
  const [apiFoodData, setApiFoodData] = useState<Partial<Food> | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string>("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerElementId = "barcode-scanner";
  const [foodLibrary, setFoodLibrary] = useState<Food[]>([]);
  const [recentFoods, setRecentFoods] = useState<string[]>([]); // Array of food IDs
  const [savedMeals, setSavedMeals] = useState<Array<{ id: string; name: string; foods: Food[]; createdAt: any }>>([]);
  const [saveMealDialogOpen, setSaveMealDialogOpen] = useState(false);
  const [mealToSave, setMealToSave] = useState<Meal | null>(null);
  const [savedMealName, setSavedMealName] = useState("");
  const [savedMealsDialogOpen, setSavedMealsDialogOpen] = useState(false);
  const [savedMealsSearchQuery, setSavedMealsSearchQuery] = useState("");

  // Format date for display (DD/MM/YYYY) and storage (YYYY-MM-DD)
  const displayDate = format(currentDate, "dd/MM/yyyy");
  const dbDate = format(currentDate, "yyyy-MM-dd");
  const docId = user ? `${user.uid}_${dbDate}` : null;

  useEffect(() => {
    if (!user || !docId) return;

    const foodDiaryRef = doc(db, "food_diary", docId);
    
    const unsubscribe = onSnapshot(foodDiaryRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as FoodDiary;
        setFoodDiary({ ...data, id: snapshot.id });
      } else {
        // Initialize empty food diary
        setFoodDiary({
          id: docId,
          userId: user.uid,
          date: dbDate,
          meals: [],
          totalCalories: 0,
          totalProtein: 0,
          totalCarbs: 0,
          totalFat: 0,
        });
      }
    });

    return () => unsubscribe();
  }, [user, docId, dbDate]);

  // Fetch food library
  useEffect(() => {
    if (!user) return;

    const foodLibraryRef = collection(db, "food_library");
    const unsubscribe = onSnapshot(foodLibraryRef, (snapshot) => {
      const foods: Food[] = [];
      snapshot.forEach((doc) => {
        foods.push({ id: doc.id, ...doc.data() } as Food);
      });
      setFoodLibrary(foods);
    });

    return () => unsubscribe();
  }, [user]);

  // Load recent foods from localStorage
  useEffect(() => {
    if (!user) return;
    const stored = localStorage.getItem(`recentFoods_${user.uid}`);
    if (stored) {
      try {
        setRecentFoods(JSON.parse(stored));
      } catch (e) {
        console.error("Error loading recent foods:", e);
      }
    }
  }, [user]);

  // Fetch saved meals
  useEffect(() => {
    if (!user) return;

    const savedMealsRef = collection(db, "saved_meals");
    const q = query(savedMealsRef, where("userId", "==", user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const meals: Array<{ id: string; name: string; foods: Food[]; createdAt: any }> = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        meals.push({
          id: doc.id,
          name: data.name,
          foods: data.foods || [],
          createdAt: data.createdAt,
        });
      });
      // Sort by creation date, newest first
      meals.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
      setSavedMeals(meals);
    });

    return () => unsubscribe();
  }, [user]);

  const handleDateChange = (days: number) => {
    setCurrentDate((prev) => (days > 0 ? addDays(prev, days) : subDays(prev, Math.abs(days))));
  };

  const handleAddMeal = async () => {
    if (!user || !docId) return;

    setLoading(true);
    try {
      const currentMeals = foodDiary?.meals || [];
      const nextMealNumber = currentMeals.length + 1;
      
      const newMeal: Meal = {
        id: Date.now().toString(),
        mealNumber: nextMealNumber,
        foods: [],
      };

      const updatedMeals = [...currentMeals, newMeal];
      
      const updateData: any = {
        userId: user.uid,
        date: dbDate,
        meals: updatedMeals,
        totalCalories: foodDiary?.totalCalories || 0,
        totalProtein: foodDiary?.totalProtein || 0,
        totalCarbs: foodDiary?.totalCarbs || 0,
        totalFat: foodDiary?.totalFat || 0,
        updatedAt: Timestamp.now(),
      };

      // Only add createdAt if this is a new document
      if (!foodDiary) {
        updateData.createdAt = Timestamp.now();
      }
      
      await setDoc(doc(db, "food_diary", docId), updateData, { merge: true });
    } catch (error) {
      console.error("Error adding meal:", error);
      toast.error("Failed to add meal");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMeal = async (mealId: string) => {
    if (!user || !docId || !foodDiary) return;

    if (!confirm("Are you sure you want to delete this meal?")) {
      return;
    }

    setLoading(true);
    try {
      const updatedMeals = foodDiary.meals.filter(meal => meal.id !== mealId);
      
      // Recalculate totals
      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFat = 0;

      updatedMeals.forEach(meal => {
        meal.foods.forEach(f => {
          totalCalories += f.caloriesPerServing;
          totalProtein += f.proteinPerServing;
          totalCarbs += f.carbsPerServing;
          totalFat += f.fatPerServing;
        });
      });
      
      const updateData: any = {
        userId: user.uid,
        date: dbDate,
        meals: updatedMeals,
        totalCalories: totalCalories,
        totalProtein: totalProtein,
        totalCarbs: totalCarbs,
        totalFat: totalFat,
        updatedAt: Timestamp.now(),
      };
      
      await setDoc(doc(db, "food_diary", docId), updateData, { merge: true });
      toast.success("Meal deleted successfully");
    } catch (error) {
      console.error("Error deleting meal:", error);
      toast.error("Failed to delete meal");
    } finally {
      setLoading(false);
    }
  };

  // Handle opening save meal dialog
  const handleOpenSaveMeal = (meal: Meal) => {
    if (!meal.foods || meal.foods.length === 0) {
      toast.error("Cannot save an empty meal");
      return;
    }
    setMealToSave(meal);
    setSavedMealName("");
    setSaveMealDialogOpen(true);
  };

  // Handle saving a meal
  const handleSaveMeal = async () => {
    if (!user || !mealToSave || !savedMealName.trim()) {
      toast.error("Please enter a meal name");
      return;
    }

    setLoading(true);
    try {
      const mealData = {
        userId: user.uid,
        name: savedMealName.trim(),
        foods: mealToSave.foods,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await addDoc(collection(db, "saved_meals"), mealData);
      toast.success("Meal saved successfully!");
      setSaveMealDialogOpen(false);
      setMealToSave(null);
      setSavedMealName("");
    } catch (error) {
      console.error("Error saving meal:", error);
      toast.error("Failed to save meal");
    } finally {
      setLoading(false);
    }
  };

  // Handle creating a new meal with saved meal foods
  const handleCreateMealWithSavedMeal = async (savedMeal: { id: string; name: string; foods: Food[] }) => {
    if (!user || !docId) {
      toast.error("User not authenticated");
      return;
    }

    if (!savedMeal.foods || savedMeal.foods.length === 0) {
      toast.error("This saved meal has no food items");
      return;
    }

    setLoading(true);
    try {
      const currentMeals = foodDiary?.meals || [];
      const nextMealNumber = currentMeals.length + 1;
      
      // Create new meal with saved meal foods
      const newMeal: Meal = {
        id: Date.now().toString(),
        mealNumber: nextMealNumber,
        foods: savedMeal.foods,
      };

      const updatedMeals = [...currentMeals, newMeal];
      
      // Recalculate totals
      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFat = 0;

      updatedMeals.forEach(meal => {
        meal.foods.forEach(f => {
          totalCalories += f.caloriesPerServing;
          totalProtein += f.proteinPerServing;
          totalCarbs += f.carbsPerServing;
          totalFat += f.fatPerServing;
        });
      });
      
      const updateData: any = {
        userId: user.uid,
        date: dbDate,
        meals: updatedMeals,
        totalCalories: totalCalories,
        totalProtein: totalProtein,
        totalCarbs: totalCarbs,
        totalFat: totalFat,
        updatedAt: Timestamp.now(),
      };

      // Only add createdAt if this is a new document
      if (!foodDiary) {
        updateData.createdAt = Timestamp.now();
      }
      
      await setDoc(doc(db, "food_diary", docId), updateData, { merge: true });
      toast.success(`${savedMeal.name} meal created`);
      setSavedMealsDialogOpen(false);
    } catch (error) {
      console.error("Error creating meal with saved meal:", error);
      toast.error("Failed to create meal");
    } finally {
      setLoading(false);
    }
  };

  // Handle adding a saved meal to existing meal (when clicking meal header)
  const handleAddSavedMealToExisting = async (savedMeal: { id: string; name: string; foods: Food[] }) => {
    if (!user || !docId || !foodDiary || !selectedMealId) {
      toast.error("Please select a meal first");
      return;
    }

    if (!savedMeal.foods || savedMeal.foods.length === 0) {
      toast.error("This saved meal has no food items");
      return;
    }

    setLoading(true);
    try {
      // Find the meal to add foods to
      const mealIndex = foodDiary.meals.findIndex(m => m.id === selectedMealId);
      if (mealIndex === -1) {
        toast.error("Meal not found");
        return;
      }

      // Add all foods from saved meal to the current meal
      const updatedMeals = [...foodDiary.meals];
      updatedMeals[mealIndex] = {
        ...updatedMeals[mealIndex],
        foods: [...updatedMeals[mealIndex].foods, ...savedMeal.foods],
      };

      // Recalculate totals
      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFat = 0;

      updatedMeals.forEach(meal => {
        meal.foods.forEach(f => {
          totalCalories += f.caloriesPerServing;
          totalProtein += f.proteinPerServing;
          totalCarbs += f.carbsPerServing;
          totalFat += f.fatPerServing;
        });
      });

      const updateData: any = {
        userId: user.uid,
        date: dbDate,
        meals: updatedMeals,
        totalCalories: totalCalories,
        totalProtein: totalProtein,
        totalCarbs: totalCarbs,
        totalFat: totalFat,
        updatedAt: Timestamp.now(),
      };

      await setDoc(doc(db, "food_diary", docId), updateData, { merge: true });
      toast.success(`${savedMeal.name} added to meal`);
      setSavedMealsDialogOpen(false);
      setSelectedMealId(null);
    } catch (error) {
      console.error("Error adding saved meal:", error);
      toast.error("Failed to add saved meal");
    } finally {
      setLoading(false);
    }
  };

  // Handle deleting a saved meal
  const handleDeleteSavedMeal = async (savedMealId: string) => {
    if (!confirm("Are you sure you want to delete this saved meal?")) {
      return;
    }

    setLoading(true);
    try {
      const savedMealRef = doc(db, "saved_meals", savedMealId);
      await deleteDoc(savedMealRef);
      toast.success("Saved meal deleted");
    } catch (error) {
      console.error("Error deleting saved meal:", error);
      toast.error("Failed to delete saved meal");
    } finally {
      setLoading(false);
    }
  };

  // Handle editing serving size of an existing food item
  const handleEditFoodItem = (mealId: string, foodIndex: number) => {
    if (!foodDiary) return;
    
    const meal = foodDiary.meals.find(m => m.id === mealId);
    if (!meal || !meal.foods[foodIndex]) return;
    
    const food = meal.foods[foodIndex];
    setEditingFoodItem({ mealId, foodIndex, food });
    setEditMealFoodData({
      name: food.name || "",
      caloriesPer100g: food.caloriesPer100g?.toString() || "",
      servingSize: food.servingSize?.toString() || "100",
      proteinPer100g: food.proteinPer100g?.toString() || "",
      carbPer100g: food.carbPer100g?.toString() || "",
      fatPer100g: food.fatPer100g?.toString() || "",
    });
    setEditServingSizeDialogOpen(true);
  };

  const handleEditMealFoodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditMealFoodData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // Handle updating food item
  const handleUpdateFoodItem = async () => {
    if (!user || !docId || !foodDiary || !editingFoodItem) return;

    const name = editMealFoodData.name.trim();
    const servingSize = Number(editMealFoodData.servingSize) || 100;
    const proteinPer100g = Number(editMealFoodData.proteinPer100g) || 0;
    const carbPer100g = Number(editMealFoodData.carbPer100g) || 0;
    const fatPer100g = Number(editMealFoodData.fatPer100g) || 0;
    const manualCalories = Number(editMealFoodData.caloriesPer100g) || 0;

    if (!name) {
      toast.error("Food name is required");
      return;
    }

    if (servingSize <= 0) {
      toast.error("Serving size must be greater than 0");
      return;
    }

    setLoading(true);
    try {
      // Calculate calories from macros if not provided
      const calculatedCaloriesPer100g = calculateCaloriesFromMacros(proteinPer100g, carbPer100g, fatPer100g);
      const caloriesPer100g = manualCalories > 0 ? manualCalories : calculatedCaloriesPer100g;

      // Calculate values for the serving size
      const ratio = servingSize / 100;
      
      const updatedFood: Food = {
        ...editingFoodItem.food,
        name: name,
        caloriesPer100g: caloriesPer100g,
        proteinPer100g: proteinPer100g,
        carbPer100g: carbPer100g,
        fatPer100g: fatPer100g,
        servingSize: servingSize,
        caloriesPerServing: caloriesPer100g * ratio,
        proteinPerServing: proteinPer100g * ratio,
        carbsPerServing: carbPer100g * ratio,
        fatPerServing: fatPer100g * ratio,
      };

      // Find the meal and update the food item
      const mealIndex = foodDiary.meals.findIndex(m => m.id === editingFoodItem.mealId);
      if (mealIndex === -1) {
        toast.error("Meal not found");
        return;
      }

      const updatedMeals = [...foodDiary.meals];
      updatedMeals[mealIndex] = {
        ...updatedMeals[mealIndex],
        foods: updatedMeals[mealIndex].foods.map((food, index) => 
          index === editingFoodItem.foodIndex ? updatedFood : food
        ),
      };

      // Recalculate totals
      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFat = 0;

      updatedMeals.forEach(meal => {
        meal.foods.forEach(f => {
          totalCalories += f.caloriesPerServing;
          totalProtein += f.proteinPerServing;
          totalCarbs += f.carbsPerServing;
          totalFat += f.fatPerServing;
        });
      });

      const updateData: any = {
        userId: user.uid,
        date: dbDate,
        meals: updatedMeals,
        totalCalories: totalCalories,
        totalProtein: totalProtein,
        totalCarbs: totalCarbs,
        totalFat: totalFat,
        updatedAt: Timestamp.now(),
      };

      await setDoc(doc(db, "food_diary", docId), updateData, { merge: true });
      
      // Also update the food_library entry if this food exists in the library
      // Only update if the food has an id and belongs to the user or came from API
      if (editingFoodItem.food.id && (editingFoodItem.food.userId === user.uid || editingFoodItem.food.source)) {
        try {
          const foodLibraryRef = doc(db, "food_library", editingFoodItem.food.id);
          const foodLibrarySnap = await getDoc(foodLibraryRef);
          
          if (foodLibrarySnap.exists()) {
            // Update the food_library entry with corrected values
            // Note: We update per-100g values and default serving size, but keep per-serving values calculated
            const foodLibraryData = {
              name: name,
              caloriesPer100g: caloriesPer100g,
              proteinPer100g: proteinPer100g,
              carbPer100g: carbPer100g,
              fatPer100g: fatPer100g,
              servingSize: servingSize, // Update default serving size
              // Recalculate per-serving values based on default serving size
              caloriesPerServing: caloriesPer100g * (servingSize / 100),
              proteinPerServing: proteinPer100g * (servingSize / 100),
              carbsPerServing: carbPer100g * (servingSize / 100),
              fatPerServing: fatPer100g * (servingSize / 100),
              updatedAt: Timestamp.now(),
            };
            
            await setDoc(foodLibraryRef, foodLibraryData, { merge: true });
          }
        } catch (libraryError) {
          console.error("Error updating food library:", libraryError);
          // Don't fail the whole operation if library update fails
        }
      }
      
      toast.success(`${updatedFood.name} updated`);
      setEditServingSizeDialogOpen(false);
      setEditingFoodItem(null);
      setEditMealFoodData({
        name: "",
        caloriesPer100g: "",
        servingSize: "",
        proteinPer100g: "",
        carbPer100g: "",
        fatPer100g: "",
      });
    } catch (error) {
      console.error("Error updating food item:", error);
      toast.error("Failed to update food item");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFoodFromMeal = async (mealId: string, foodIndex: number) => {
    if (!user || !docId || !foodDiary) return;

    setLoading(true);
    try {
      // Find the meal
      const mealIndex = foodDiary.meals.findIndex(m => m.id === mealId);
      if (mealIndex === -1) {
        toast.error("Meal not found");
        return;
      }

      // Remove food from meal
      const updatedMeals = [...foodDiary.meals];
      const meal = updatedMeals[mealIndex];
      const removedFood = meal.foods[foodIndex];
      
      updatedMeals[mealIndex] = {
        ...meal,
        foods: meal.foods.filter((_, index) => index !== foodIndex),
      };

      // Recalculate totals
      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFat = 0;

      updatedMeals.forEach(m => {
        m.foods.forEach(f => {
          totalCalories += f.caloriesPerServing;
          totalProtein += f.proteinPerServing;
          totalCarbs += f.carbsPerServing;
          totalFat += f.fatPerServing;
        });
      });

      const updateData: any = {
        userId: user.uid,
        date: dbDate,
        meals: updatedMeals,
        totalCalories: totalCalories,
        totalProtein: totalProtein,
        totalCarbs: totalCarbs,
        totalFat: totalFat,
        updatedAt: Timestamp.now(),
      };

      await setDoc(doc(db, "food_diary", docId), updateData, { merge: true });
      toast.success(`${removedFood.name} removed from meal`);
    } catch (error) {
      console.error("Error removing food from meal:", error);
      toast.error("Failed to remove food from meal");
    } finally {
      setLoading(false);
    }
  };

  const calculateCaloriesFromMacros = (protein: number, carbs: number, fat: number) => {
    return (protein * CALORIES_PER_GRAM_PROTEIN) + (carbs * CALORIES_PER_GRAM_CARB) + (fat * CALORIES_PER_GRAM_FAT);
  };

  const handleCreateFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const protein = Number(createFoodData.proteinPer100g) || 0;
    const carbs = Number(createFoodData.carbPer100g) || 0;
    const fat = Number(createFoodData.fatPer100g) || 0;
    const servingSize = Number(createFoodData.servingSize) || 0;
    const manualCalories = Number(createFoodData.caloriesPer100g) || 0;

    // Calculate calories from macros
    const calculatedCaloriesPer100g = calculateCaloriesFromMacros(protein, carbs, fat);

    // Use manual calories if provided, otherwise use calculated
    const caloriesPer100g = manualCalories > 0 ? manualCalories : calculatedCaloriesPer100g;

    // Validate that manual calories match calculated (within 5 calorie tolerance)
    if (manualCalories > 0 && Math.abs(manualCalories - calculatedCaloriesPer100g) > 5) {
      const proceed = confirm(
        `The calories per 100g (${manualCalories}) doesn't match the calculated value from macros (${calculatedCaloriesPer100g.toFixed(1)}). ` +
        `Do you want to use the manual value anyway?`
      );
      if (!proceed) return;
    }

    if (!createFoodData.name || servingSize <= 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    setCreateFoodLoading(true);
    try {
      // Calculate values per serving
      const servingRatio = servingSize / 100;
      const caloriesPerServing = caloriesPer100g * servingRatio;
      const proteinPerServing = protein * servingRatio;
      const carbsPerServing = carbs * servingRatio;
      const fatPerServing = fat * servingRatio;

      const foodData: any = {
        userId: user.uid,
        name: createFoodData.name,
        caloriesPer100g: caloriesPer100g,
        servingSize: servingSize,
        proteinPer100g: protein,
        carbPer100g: carbs,
        fatPer100g: fat,
        // Per serving values for easy access
        caloriesPerServing: caloriesPerServing,
        proteinPerServing: proteinPerServing,
        carbsPerServing: carbsPerServing,
        fatPerServing: fatPerServing,
        source: "User Submission",
        createdAt: Timestamp.now(),
      };

      // Add barcode if provided
      if (createFoodData.barcode.trim()) {
        foodData.barcode = createFoodData.barcode.trim();
      }

      await addDoc(collection(db, "food_library"), foodData);

      toast.success("Food created successfully!");
      setCreateFoodOpen(false);
      setCreateFoodData({
        name: "",
        caloriesPer100g: "",
        servingSize: "",
        proteinPer100g: "",
        carbPer100g: "",
        fatPer100g: "",
        barcode: "",
      });
    } catch (error) {
      console.error("Error creating food:", error);
      toast.error("Failed to create food");
    } finally {
      setCreateFoodLoading(false);
    }
  };

  const handleCreateFoodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCreateFoodData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // Update recent foods in localStorage
  const updateRecentFoods = (foodId: string) => {
    if (!user) return;
    const current = [...recentFoods];
    // Remove if already exists
    const index = current.indexOf(foodId);
    if (index > -1) {
      current.splice(index, 1);
    }
    // Add to beginning
    current.unshift(foodId);
    // Keep only last 20
    const updated = current.slice(0, 20);
    setRecentFoods(updated);
    localStorage.setItem(`recentFoods_${user.uid}`, JSON.stringify(updated));
  };

  // Handle food selection - open serving size dialog
  const handleFoodSelection = (food: Food) => {
    setSelectedFood(food);
    setAdjustedServingSize(food.servingSize?.toString() || "100");
    setServingSizeDialogOpen(true);
  };

  // Calculate adjusted values based on serving size
  const calculateAdjustedValues = (food: Food, servingSize: number) => {
    const ratio = servingSize / 100;
    return {
      caloriesPerServing: food.caloriesPer100g * ratio,
      proteinPerServing: food.proteinPer100g * ratio,
      carbsPerServing: food.carbPer100g * ratio,
      fatPerServing: food.fatPer100g * ratio,
      servingSize: servingSize,
    };
  };

  // Handle adding food to meal with adjusted serving size
  const handleAddFoodToMeal = async () => {
    if (!user || !docId || !foodDiary || !selectedMealId || !selectedFood) return;

    const servingSize = Number(adjustedServingSize) || selectedFood.servingSize || 100;
    if (servingSize <= 0) {
      toast.error("Serving size must be greater than 0");
      return;
    }

    setLoading(true);
    try {
      // Calculate adjusted values
      const adjusted = calculateAdjustedValues(selectedFood, servingSize);

      // Create food object with adjusted values
      const adjustedFood: Food = {
        ...selectedFood,
        caloriesPerServing: adjusted.caloriesPerServing,
        proteinPerServing: adjusted.proteinPerServing,
        carbsPerServing: adjusted.carbsPerServing,
        fatPerServing: adjusted.fatPerServing,
        servingSize: adjusted.servingSize,
      };

      // Find the meal
      const mealIndex = foodDiary.meals.findIndex(m => m.id === selectedMealId);
      if (mealIndex === -1) {
        toast.error("Meal not found");
        return;
      }

      // Add food to meal
      const updatedMeals = [...foodDiary.meals];
      updatedMeals[mealIndex] = {
        ...updatedMeals[mealIndex],
        foods: [...updatedMeals[mealIndex].foods, adjustedFood],
      };

      // Recalculate totals
      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFat = 0;

      updatedMeals.forEach(meal => {
        meal.foods.forEach(f => {
          totalCalories += f.caloriesPerServing;
          totalProtein += f.proteinPerServing;
          totalCarbs += f.carbsPerServing;
          totalFat += f.fatPerServing;
        });
      });

      const updateData: any = {
        userId: user.uid,
        date: dbDate,
        meals: updatedMeals,
        totalCalories: totalCalories,
        totalProtein: totalProtein,
        totalCarbs: totalCarbs,
        totalFat: totalFat,
        updatedAt: Timestamp.now(),
      };

      await setDoc(doc(db, "food_diary", docId), updateData, { merge: true });
      
      // Update recent foods
      updateRecentFoods(selectedFood.id);
      
      toast.success(`${selectedFood.name} added to meal`);
      setServingSizeDialogOpen(false);
      setSelectedFood(null);
      setAdjustedServingSize("");
      setFoodSelectionOpen(false);
      setSelectedMealId(null);
    } catch (error) {
      console.error("Error adding food to meal:", error);
      toast.error("Failed to add food to meal");
    } finally {
      setLoading(false);
    }
  };

  // Fetch food from Open Food Facts API
  const fetchFromOpenFoodFacts = async (barcode: string): Promise<Partial<Food> | null> => {
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await response.json();

      if (data.status === 0 || !data.product) {
        return null; // Product not found
      }

      const product = data.product;
      const nutriments = product.nutriments || {};

      // Convert energy from kJ to kcal if needed (1 kcal = 4.184 kJ)
      let caloriesPer100g = 0;
      if (nutriments["energy-kcal_100g"]) {
        caloriesPer100g = nutriments["energy-kcal_100g"];
      } else if (nutriments["energy_100g"]) {
        // Energy is in kJ, convert to kcal
        caloriesPer100g = nutriments["energy_100g"] / 4.184;
      } else if (nutriments["energy-kcal"]) {
        // Per serving, need to calculate per 100g
        const servingSize = product.serving_size || 100;
        caloriesPer100g = (nutriments["energy-kcal"] / servingSize) * 100;
      } else if (nutriments["energy"]) {
        // Energy in kJ per serving, convert and calculate per 100g
        const servingSize = product.serving_size || 100;
        caloriesPer100g = ((nutriments["energy"] / 4.184) / servingSize) * 100;
      }

      // Extract nutritional values per 100g
      const proteinPer100g = nutriments["proteins_100g"] || nutriments["protein_100g"] || 0;
      const carbPer100g = nutriments["carbohydrates_100g"] || nutriments["carbohydrate_100g"] || 0;
      const fatPer100g = nutriments["fat_100g"] || 0;

      // Default serving size to 100g
      const servingSize = 100;

      // Check for missing data
      const missingFields: string[] = [];
      if (!product.product_name || product.product_name.trim() === "") {
        missingFields.push("Product Name");
      }
      if (caloriesPer100g === 0) {
        missingFields.push("Calories");
      }
      if (proteinPer100g === 0) {
        missingFields.push("Protein");
      }
      if (carbPer100g === 0) {
        missingFields.push("Carbs");
      }
      if (fatPer100g === 0) {
        missingFields.push("Fat");
      }

      return {
        name: product.product_name || "",
        caloriesPer100g: caloriesPer100g,
        servingSize: servingSize,
        proteinPer100g: proteinPer100g,
        carbPer100g: carbPer100g,
        fatPer100g: fatPer100g,
        barcode: barcode.trim(),
        source: "API" as const,
        missingFields: missingFields,
      };
    } catch (error) {
      console.error("Error fetching from Open Food Facts:", error);
      return null;
    }
  };

  // Start barcode scanner
  const startScanner = async () => {
    try {
      setScanError("");
      
      // Check if HTTPS (required for camera access)
      if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        setScanError("Camera access requires HTTPS. Please use a secure connection or try manual entry.");
        setIsScanning(false);
        return;
      }

      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setScanError("Your browser doesn't support camera access. Please use a modern browser or try manual entry.");
        setIsScanning(false);
        return;
      }
      
      // Wait for the element to be available in the DOM
      const element = document.getElementById(scannerElementId);
      if (!element) {
        // Retry after a short delay
        setTimeout(() => {
          startScanner();
        }, 100);
        return;
      }

      const html5QrCode = new Html5Qrcode(scannerElementId);
      scannerRef.current = html5QrCode;

      // Check if we're on mobile
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // Configure camera based on device
      const cameraConfig = isMobile 
        ? { facingMode: "environment" } // Back camera on mobile
        : { facingMode: "environment" }; // Back camera on desktop (better for barcode scanning)

      // Get element dimensions for better scanning box
      const elementWidth = element.clientWidth || 300;
      const elementHeight = element.clientHeight || 300;
      const qrboxSize = Math.min(250, Math.min(elementWidth - 20, elementHeight - 20));

      // Use simpler configuration that works better across devices
      const config = {
        fps: 10,
        qrbox: { width: qrboxSize, height: qrboxSize },
        aspectRatio: 1.0,
        disableFlip: false,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        rememberLastUsedCamera: true,
      };

      await html5QrCode.start(
        cameraConfig,
        config,
        async (decodedText) => {
          // Successfully scanned
          setBarcodeInput(decodedText);
          await stopScanner();
          // Small delay to ensure scanner is stopped before searching
          setTimeout(() => {
            handleBarcodeSearch(decodedText);
          }, 100);
        },
        (errorMessage) => {
          // Scanning error (ignore, it's normal during scanning)
          // Only log if it's not a common scanning error
          if (!errorMessage.includes("NotFoundException") && !errorMessage.includes("No MultiFormat Readers")) {
            console.debug("Scanner:", errorMessage);
          }
        }
      );
      
      // Wait a moment for video to render, then check if it's visible
      setTimeout(() => {
        const videoElement = element.querySelector('video');
        if (videoElement) {
          videoElement.style.width = '100%';
          videoElement.style.height = 'auto';
          videoElement.style.display = 'block';
          videoElement.style.objectFit = 'contain';
          console.log('Video element found and styled');
        } else {
          console.warn('Video element not found in scanner container');
        }
      }, 500);
      
      setIsScanning(true);
    } catch (error: any) {
      console.error("Error starting scanner:", error);
      let errorMessage = "Failed to start camera. ";
      
      if (error.message?.includes("streaming not supported") || error.message?.includes("NotSupportedError")) {
        errorMessage += "Your browser doesn't support camera streaming. Please use Chrome, Firefox, or Safari, or try manual entry.";
      } else if (error.message?.includes("Permission denied") || error.message?.includes("NotAllowedError")) {
        errorMessage += "Camera permission denied. Please allow camera access in your browser settings and try again.";
      } else if (error.message?.includes("NotFoundError") || error.message?.includes("DevicesNotFoundError")) {
        errorMessage += "No camera found. Please connect a camera or use manual entry.";
      } else if (error.message?.includes("OverconstrainedError") || error.message?.includes("ConstraintNotSatisfiedError")) {
        errorMessage += "Camera constraints not supported. Please try manual entry.";
      } else {
        errorMessage += error.message || "Please check camera permissions and try again.";
      }
      
      setScanError(errorMessage);
      setIsScanning(false);
    }
  };

  // Stop barcode scanner
  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (error) {
        console.error("Error stopping scanner:", error);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
    setScanError("");
  };

  // Cleanup scanner on unmount or dialog close
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        stopScanner();
      }
    };
  }, []);

  // Search for food by barcode
  const handleBarcodeSearch = async (barcode?: string) => {
    const barcodeToSearch = barcode || barcodeInput.trim();
    
    if (!barcodeToSearch) {
      toast.error("Please enter a barcode");
      return;
    }

    if (!selectedMealId) {
      toast.error("Please select a meal first");
      setBarcodeDialogOpen(false);
      return;
    }

    setBarcodeSearchLoading(true);
    try {
      // First, search in food_library collection for matching barcode
      const foodLibraryRef = collection(db, "food_library");
      const q = query(foodLibraryRef, where("barcode", "==", barcodeToSearch));
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // Found a match in local database
        const foodDoc = querySnapshot.docs[0];
        const foodData = { id: foodDoc.id, ...foodDoc.data() } as Food;
        
        // Close barcode dialog and food selection dialog, then open edit food item dialog
        setBarcodeDialogOpen(false);
        setBarcodeInput("");
        if (foodSelectionOpen) {
          setFoodSelectionOpen(false);
        }
        // Populate edit meal food data for the dialog
        setEditMealFoodData({
          name: foodData.name || "",
          caloriesPer100g: foodData.caloriesPer100g?.toString() || "",
          servingSize: foodData.servingSize?.toString() || "100",
          proteinPer100g: foodData.proteinPer100g?.toString() || "",
          carbPer100g: foodData.carbPer100g?.toString() || "",
          fatPer100g: foodData.fatPer100g?.toString() || "",
        });
        // Use apiFoodData to store the food for adding to meal
        setApiFoodData(foodData);
        setApiFoodPreviewOpen(true);
        toast.success("Food found in your library!");
        } else {
          // Not found locally, try Open Food Facts API
          const apiFood = await fetchFromOpenFoodFacts(barcodeToSearch);
          
          if (apiFood) {
            // Found in API, automatically save to database
            if (!user) {
              toast.error("User not authenticated");
              return;
            }
            try {
              const protein = apiFood.proteinPer100g || 0;
              const carbs = apiFood.carbPer100g || 0;
              const fat = apiFood.fatPer100g || 0;
              const servingSize = apiFood.servingSize || 100;
              const caloriesPer100g = apiFood.caloriesPer100g || 0;

              // Calculate values per serving
              const servingRatio = servingSize / 100;
              const caloriesPerServing = caloriesPer100g * servingRatio;
              const proteinPerServing = protein * servingRatio;
              const carbsPerServing = carbs * servingRatio;
              const fatPerServing = fat * servingRatio;

              const foodData: any = {
                userId: user.uid,
                name: apiFood.name || "",
                caloriesPer100g: caloriesPer100g,
                servingSize: servingSize,
                proteinPer100g: protein,
                carbPer100g: carbs,
                fatPer100g: fat,
                caloriesPerServing: caloriesPerServing,
                proteinPerServing: proteinPerServing,
                carbsPerServing: carbsPerServing,
                fatPerServing: fatPerServing,
                source: "API",
                barcode: barcodeToSearch,
                createdAt: Timestamp.now(),
              };

              const docRef = await addDoc(collection(db, "food_library"), foodData);
              const savedFood: Food = { id: docRef.id, ...foodData };

              // Show edit food item dialog instead of preview
              setBarcodeDialogOpen(false);
              setBarcodeInput("");
              setApiFoodData({ ...savedFood, missingFields: apiFood.missingFields });
              // Populate edit meal food data for the dialog
              setEditMealFoodData({
                name: savedFood.name || "",
                caloriesPer100g: savedFood.caloriesPer100g?.toString() || "",
                servingSize: savedFood.servingSize?.toString() || "100",
                proteinPer100g: savedFood.proteinPer100g?.toString() || "",
                carbPer100g: savedFood.carbPer100g?.toString() || "",
                fatPer100g: savedFood.fatPer100g?.toString() || "",
              });
              setApiFoodPreviewOpen(true);
              toast.success("Food found and saved to your library!");
            } catch (error) {
              console.error("Error saving API food:", error);
              toast.error("Failed to save food from API");
            }
          } else {
            // Not found anywhere, open Create Food dialog
            setBarcodeDialogOpen(false);
            setBarcodeInput("");
            if (foodSelectionOpen) {
              setFoodSelectionOpen(false);
            }
              // Pre-fill barcode in create food dialog
              setCreateFoodData({
                name: "",
                caloriesPer100g: "",
                servingSize: "",
                proteinPer100g: "",
                carbPer100g: "",
                fatPer100g: "",
                barcode: barcodeToSearch,
              });
            setCreateFoodOpen(true);
            toast.info("Food not found. Please create it manually.");
          }
        }
    } catch (error) {
      console.error("Error searching barcode:", error);
      toast.error("Failed to search barcode");
    } finally {
      setBarcodeSearchLoading(false);
    }
  };

  // Handle opening edit food dialog
  const handleEditFood = (food: Food) => {
    if (food.userId !== user?.uid) {
      toast.error("You can only edit foods you created");
      return;
    }
    setEditFoodId(food.id);
    setEditFoodData({
      name: food.name,
      caloriesPer100g: food.caloriesPer100g.toString(),
      servingSize: food.servingSize.toString(),
      proteinPer100g: food.proteinPer100g.toString(),
      carbPer100g: food.carbPer100g.toString(),
      fatPer100g: food.fatPer100g.toString(),
      barcode: food.barcode || "",
    });
    setEditFoodOpen(true);
  };

  // Handle edit food change
  const handleEditFoodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditFoodData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // Handle updating food
  const handleUpdateFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editFoodId) return;

    const protein = Number(editFoodData.proteinPer100g) || 0;
    const carbs = Number(editFoodData.carbPer100g) || 0;
    const fat = Number(editFoodData.fatPer100g) || 0;
    const servingSize = Number(editFoodData.servingSize) || 0;
    const manualCalories = Number(editFoodData.caloriesPer100g) || 0;

    // Calculate calories from macros
    const calculatedCaloriesPer100g = calculateCaloriesFromMacros(protein, carbs, fat);

    // Use manual calories if provided, otherwise use calculated
    const caloriesPer100g = manualCalories > 0 ? manualCalories : calculatedCaloriesPer100g;

    // Validate that manual calories match calculated (within 5 calorie tolerance)
    if (manualCalories > 0 && Math.abs(manualCalories - calculatedCaloriesPer100g) > 5) {
      const proceed = confirm(
        `The calories per 100g (${manualCalories}) doesn't match the calculated value from macros (${calculatedCaloriesPer100g.toFixed(1)}). ` +
        `Do you want to use the manual value anyway?`
      );
      if (!proceed) return;
    }

    if (!editFoodData.name || servingSize <= 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    setEditFoodLoading(true);
    try {
      // Calculate values per serving
      const servingRatio = servingSize / 100;
      const caloriesPerServing = caloriesPer100g * servingRatio;
      const proteinPerServing = protein * servingRatio;
      const carbsPerServing = carbs * servingRatio;
      const fatPerServing = fat * servingRatio;

      const foodData: any = {
        userId: user.uid,
        name: editFoodData.name,
        caloriesPer100g: caloriesPer100g,
        servingSize: servingSize,
        proteinPer100g: protein,
        carbPer100g: carbs,
        fatPer100g: fat,
        // Per serving values for easy access
        caloriesPerServing: caloriesPerServing,
        proteinPerServing: proteinPerServing,
        carbsPerServing: carbsPerServing,
        fatPerServing: fatPerServing,
        updatedAt: Timestamp.now(),
      };

      // Add barcode if provided
      if (editFoodData.barcode.trim()) {
        foodData.barcode = editFoodData.barcode.trim();
      } else {
        // Remove barcode if it was cleared
        foodData.barcode = null;
      }

      await setDoc(doc(db, "food_library", editFoodId), foodData, { merge: true });

      toast.success("Food updated successfully!");
      setEditFoodOpen(false);
      setEditFoodId(null);
      setEditFoodData({
        name: "",
        caloriesPer100g: "",
        servingSize: "",
        proteinPer100g: "",
        carbPer100g: "",
        fatPer100g: "",
        barcode: "",
      });
    } catch (error) {
      console.error("Error updating food:", error);
      toast.error("Failed to update food");
    } finally {
      setEditFoodLoading(false);
    }
  };

  // Add API food to meal with selected serving size
  const handleAddApiFoodToMeal = async () => {
    if (!user || !docId || !foodDiary || !selectedMealId || !apiFoodData || !apiFoodData.id) return;

    const name = editMealFoodData.name.trim();
    const servingSize = Number(editMealFoodData.servingSize) || 100;
    const proteinPer100g = Number(editMealFoodData.proteinPer100g) || 0;
    const carbPer100g = Number(editMealFoodData.carbPer100g) || 0;
    const fatPer100g = Number(editMealFoodData.fatPer100g) || 0;
    const manualCalories = Number(editMealFoodData.caloriesPer100g) || 0;

    if (!name) {
      toast.error("Food name is required");
      return;
    }

    if (servingSize <= 0) {
      toast.error("Serving size must be greater than 0");
      return;
    }

    setLoading(true);
    try {
      // Calculate calories from macros if not provided
      const calculatedCaloriesPer100g = calculateCaloriesFromMacros(proteinPer100g, carbPer100g, fatPer100g);
      const caloriesPer100g = manualCalories > 0 ? manualCalories : calculatedCaloriesPer100g;

      // Update the food in database with edited values
      const defaultServingRatio = 100 / 100;
      const foodData: any = {
        userId: user.uid,
        name: name,
        caloriesPer100g: caloriesPer100g,
        servingSize: 100, // Store per 100g in database
        proteinPer100g: proteinPer100g,
        carbPer100g: carbPer100g,
        fatPer100g: fatPer100g,
        caloriesPerServing: caloriesPer100g * defaultServingRatio,
        proteinPerServing: proteinPer100g * defaultServingRatio,
        carbsPerServing: carbPer100g * defaultServingRatio,
        fatPerServing: fatPer100g * defaultServingRatio,
        source: apiFoodData.source || "User Submission", // Preserve original source or default to User Submission
        barcode: apiFoodData.barcode || "",
        updatedAt: Timestamp.now(),
      };

      // Update the food in database
      await setDoc(doc(db, "food_library", apiFoodData.id), foodData, { merge: true });

      // Calculate adjusted values based on user's selected serving size
      const ratio = servingSize / 100;
      const caloriesPerServing = caloriesPer100g * ratio;
      const proteinPerServing = proteinPer100g * ratio;
      const carbsPerServing = carbPer100g * ratio;
      const fatPerServing = fatPer100g * ratio;

      // Create food object with adjusted values for the meal
      const adjustedFood: Food = {
        ...apiFoodData,
        name: name,
        caloriesPer100g: caloriesPer100g,
        proteinPer100g: proteinPer100g,
        carbPer100g: carbPer100g,
        fatPer100g: fatPer100g,
        caloriesPerServing: caloriesPerServing,
        proteinPerServing: proteinPerServing,
        carbsPerServing: carbsPerServing,
        fatPerServing: fatPerServing,
        servingSize: servingSize,
      } as Food;

      // Find the meal
      const mealIndex = foodDiary.meals.findIndex(m => m.id === selectedMealId);
      if (mealIndex === -1) {
        toast.error("Meal not found");
        return;
      }

      // Add food to meal
      const updatedMeals = [...foodDiary.meals];
      updatedMeals[mealIndex] = {
        ...updatedMeals[mealIndex],
        foods: [...updatedMeals[mealIndex].foods, adjustedFood],
      };

      // Recalculate totals
      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFat = 0;

      updatedMeals.forEach(meal => {
        meal.foods.forEach(f => {
          totalCalories += f.caloriesPerServing;
          totalProtein += f.proteinPerServing;
          totalCarbs += f.carbsPerServing;
          totalFat += f.fatPerServing;
        });
      });

      const updateData: any = {
        userId: user.uid,
        date: dbDate,
        meals: updatedMeals,
        totalCalories: totalCalories,
        totalProtein: totalProtein,
        totalCarbs: totalCarbs,
        totalFat: totalFat,
        updatedAt: Timestamp.now(),
      };

      await setDoc(doc(db, "food_diary", docId), updateData, { merge: true });
      
      // Update recent foods
      if (apiFoodData.id) {
        updateRecentFoods(apiFoodData.id);
      }
      
      toast.success(`${adjustedFood.name} added to meal`);
      setApiFoodPreviewOpen(false);
      setApiFoodData(null);
      setEditMealFoodData({
        name: "",
        caloriesPer100g: "",
        servingSize: "",
        proteinPer100g: "",
        carbPer100g: "",
        fatPer100g: "",
      });
      setFoodSelectionOpen(false);
      setSelectedMealId(null);
    } catch (error) {
      console.error("Error adding food to meal:", error);
      toast.error("Failed to add food to meal");
    } finally {
      setLoading(false);
    }
  };

  // Filter foods based on active tab and search query
  const getFilteredFoods = (): Food[] => {
    let filtered = foodLibrary;

    // Filter by tab
    if (activeTab === "my-foods") {
      filtered = filtered.filter(food => food.userId === user?.uid);
    } else if (activeTab === "recent") {
      filtered = filtered.filter(food => recentFoods.includes(food.id));
    }
    // "all" tab shows all foods

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(food => 
        food.name.toLowerCase().includes(query) ||
        food.barcode?.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  // Calculate macro data for pie chart
  const macroData = foodDiary ? [
    { name: "Protein", value: foodDiary.totalProtein, calories: foodDiary.totalProtein * 4 },
    { name: "Carbs", value: foodDiary.totalCarbs, calories: foodDiary.totalCarbs * 4 },
    { name: "Fat", value: foodDiary.totalFat, calories: foodDiary.totalFat * 9 },
  ].filter(item => item.value > 0) : [];

  const calorieGoal = profile?.goals?.calorieLimit || 0;
  const consumedCalories = foodDiary?.totalCalories || 0;
  const remainingCalories = calorieGoal - consumedCalories;

  // Macro goals from profile
  const proteinGoal = profile?.goals?.proteinGoal || 0;
  const carbGoal = profile?.goals?.carbGoal || 0;
  const fatGoal = profile?.goals?.fatGoal || 0;

  // Consumed macros
  const consumedProtein = foodDiary?.totalProtein || 0;
  const consumedCarbs = foodDiary?.totalCarbs || 0;
  const consumedFat = foodDiary?.totalFat || 0;

  // Remaining macros
  const remainingProtein = proteinGoal - consumedProtein;
  const remainingCarbs = carbGoal - consumedCarbs;
  const remainingFat = fatGoal - consumedFat;

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
          <h1 className="text-lg font-semibold">Diary</h1>
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

      {/* Calories Remaining - MyFitnessPal Style */}
      <div className="px-4 py-4 border-b bg-background">
        <div className="mb-2">
          <h2 className="text-sm font-semibold text-muted-foreground text-center">Calories Remaining</h2>
        </div>
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="font-semibold">{Math.ceil(calorieGoal).toLocaleString()}</span>
          <span className="text-muted-foreground">Goal</span>
          <span className="mx-1">-</span>
          <span className="font-semibold">{Math.ceil(consumedCalories).toLocaleString()}</span>
          <span className="text-muted-foreground">Food</span>
          <span className="mx-1">=</span>
          <span className={`font-bold text-lg ${remainingCalories >= 0 ? "text-green-600" : "text-red-600"}`}>
            {Math.ceil(remainingCalories).toLocaleString()}
          </span>
          <span className="text-muted-foreground">Remaining</span>
        </div>

        {/* Macro Progress Bars */}
        {(proteinGoal > 0 || carbGoal > 0 || fatGoal > 0) && (
          <div className="mt-4 space-y-3">
            {/* Protein Progress */}
            {proteinGoal > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Protein</span>
                  <span className="font-medium">
                    {Math.ceil(consumedProtein)}g / {Math.ceil(proteinGoal)}g
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#8884d8] transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, (consumedProtein / proteinGoal) * 100))}%`
                    }}
                  />
                </div>
              </div>
            )}

            {/* Carb Progress */}
            {carbGoal > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Carbs</span>
                  <span className="font-medium">
                    {Math.ceil(consumedCarbs)}g / {Math.ceil(carbGoal)}g
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#82ca9d] transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, (consumedCarbs / carbGoal) * 100))}%`
                    }}
                  />
                </div>
              </div>
            )}

            {/* Fat Progress */}
            {fatGoal > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Fat</span>
                  <span className="font-medium">
                    {Math.ceil(consumedFat)}g / {Math.ceil(fatGoal)}g
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#ffc658] transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, (consumedFat / fatGoal) * 100))}%`
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Meals Section - Full Width */}
      <div className="pb-20">
        {foodDiary?.meals && foodDiary.meals.length > 0 ? (
          <div>
            {foodDiary.meals.map((meal) => {
              const mealTotalCalories = meal.foods.reduce((sum, food) => sum + food.caloriesPerServing, 0);
              const mealTotalProtein = meal.foods.reduce((sum, food) => sum + food.proteinPerServing, 0);
              const mealTotalCarbs = meal.foods.reduce((sum, food) => sum + food.carbsPerServing, 0);
              const mealTotalFat = meal.foods.reduce((sum, food) => sum + food.fatPerServing, 0);
              
              return (
                <div key={meal.id} className="border-b">
                  {/* Meal Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                    <div 
                      className="flex items-center gap-3 flex-wrap flex-1 cursor-pointer hover:bg-muted/50 -mx-4 px-4 py-1 rounded transition-colors"
                      onClick={() => {
                        setSelectedMealId(meal.id);
                        setSavedMealsDialogOpen(true);
                      }}
                    >
                      <h3 className="text-base font-semibold">Meal {meal.mealNumber}</h3>
                      <span className="text-sm text-muted-foreground">
                        {meal.foods.length} {meal.foods.length === 1 ? 'item' : 'items'}
                      </span>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-muted-foreground">
                          <span className="font-semibold text-foreground">{Math.ceil(mealTotalCalories)}</span> cal
                        </span>
                        <span className="text-muted-foreground">
                          <span className="font-semibold text-foreground">{Math.ceil(mealTotalProtein)}</span>g P
                        </span>
                        <span className="text-muted-foreground">
                          <span className="font-semibold text-foreground">{Math.ceil(mealTotalCarbs)}</span>g C
                        </span>
                        <span className="text-muted-foreground">
                          <span className="font-semibold text-foreground">{Math.ceil(mealTotalFat)}</span>g F
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {meal.foods && meal.foods.length > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-primary hover:bg-primary/10"
                          onClick={() => handleOpenSaveMeal(meal)}
                          disabled={loading}
                          title="Save Meal"
                        >
                          <Bookmark className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteMeal(meal.id)}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Meal Foods Table */}
                  {meal.foods && meal.foods.length > 0 ? (
                    <div className="w-full">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b bg-muted/50">
                            <TableHead className="font-bold text-sm text-muted-foreground uppercase tracking-wider py-3">Food Name</TableHead>
                            <TableHead className="text-right font-bold text-sm text-muted-foreground uppercase tracking-wider py-3">Calories</TableHead>
                            <TableHead className="text-right font-bold text-sm text-muted-foreground uppercase tracking-wider py-3">P</TableHead>
                            <TableHead className="text-right font-bold text-sm text-muted-foreground uppercase tracking-wider py-3">C</TableHead>
                            <TableHead className="text-right font-bold text-sm text-muted-foreground uppercase tracking-wider py-3">F</TableHead>
                            <TableHead className="w-[50px] py-3"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {meal.foods.map((food, index) => (
                            <TableRow 
                              key={index}
                              className="cursor-pointer hover:bg-accent/50 transition-colors border-b"
                              onClick={() => handleEditFoodItem(meal.id, index)}
                            >
                              <TableCell className="font-medium py-3">{food.name}</TableCell>
                              <TableCell className="text-right py-3">{Math.ceil(food.caloriesPerServing)}</TableCell>
                              <TableCell className="text-right py-3">{Math.ceil(food.proteinPerServing)}</TableCell>
                              <TableCell className="text-right py-3">{Math.ceil(food.carbsPerServing)}</TableCell>
                              <TableCell className="text-right py-3">{Math.ceil(food.fatPerServing)}</TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()} className="py-3">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                  onClick={() => handleRemoveFoodFromMeal(meal.id, index)}
                                  disabled={loading}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter className="bg-muted/20">
                          <TableRow className="font-semibold border-t-2">
                            <TableCell className="py-3">Total</TableCell>
                            <TableCell className="text-right py-3">{Math.ceil(mealTotalCalories)}</TableCell>
                            <TableCell className="text-right py-3">{Math.ceil(mealTotalProtein)}</TableCell>
                            <TableCell className="text-right py-3">{Math.ceil(mealTotalCarbs)}</TableCell>
                            <TableCell className="text-right py-3">{Math.ceil(mealTotalFat)}</TableCell>
                            <TableCell className="py-3"></TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                  ) : null}

                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-8">
            <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
              <p className="mb-4">No meals logged for this day.</p>
            </div>
          </div>
        )}

        {/* Add Meal Button - Always visible */}
        <div className="px-4 py-4 border-t bg-muted/20">
          <Button 
            onClick={() => {
              setSelectedMealId(null); // Clear selection - we're creating a new meal
              setSavedMealsDialogOpen(true);
            }} 
            disabled={loading} 
            className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground" 
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Meal
          </Button>
        </div>
      </div>

      {/* Food Selection Dialog */}
      <Dialog open={foodSelectionOpen} onOpenChange={(open) => {
        setFoodSelectionOpen(open);
        if (!open) {
          setSearchQuery("");
          setActiveTab("all");
          setSelectedMealId(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Food Selection</DialogTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFoodSelectionOpen(false);
                  setCreateFoodOpen(true);
                }}
              >
                <Utensils className="h-4 w-4 mr-2" />
                Create Food
              </Button>
            </div>
          </DialogHeader>
          
          <div className="flex flex-col gap-4 flex-1 overflow-hidden">
            {/* Search and Scan Bar */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search foods..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" onClick={() => {
                setBarcodeDialogOpen(true);
              }}>
                <Scan className="h-4 w-4 mr-2" />
                Scan
              </Button>
            </div>

            {/* Tabs for filtering */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="recent">Recent</TabsTrigger>
                <TabsTrigger value="my-foods">My Foods</TabsTrigger>
              </TabsList>
              
              <TabsContent value="all" className="flex-1 overflow-hidden mt-4">
                <ScrollArea className="h-[400px]">
                  {getFilteredFoods().length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Food Name</TableHead>
                          <TableHead className="text-right font-bold text-sm text-muted-foreground uppercase tracking-wider">Calories</TableHead>
                          <TableHead className="text-right font-bold text-sm text-muted-foreground uppercase tracking-wider">P</TableHead>
                          <TableHead className="text-right font-bold text-sm text-muted-foreground uppercase tracking-wider">C</TableHead>
                          <TableHead className="text-right font-bold text-sm text-muted-foreground uppercase tracking-wider">F</TableHead>
                          <TableHead className="text-right font-bold text-sm text-muted-foreground uppercase tracking-wider">Serving</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getFilteredFoods().map((food) => (
                          <TableRow 
                            key={food.id}
                            className="cursor-pointer hover:bg-accent transition-colors"
                            onClick={() => handleFoodSelection(food)}
                          >
                            <TableCell className="font-medium">{food.name}</TableCell>
                            <TableCell className="text-right">{Math.ceil(food.caloriesPerServing)}</TableCell>
                            <TableCell className="text-right">{Math.ceil(food.proteinPerServing)}</TableCell>
                            <TableCell className="text-right">{Math.ceil(food.carbsPerServing)}</TableCell>
                            <TableCell className="text-right">{Math.ceil(food.fatPerServing)}</TableCell>
                            <TableCell className="text-right">{food.servingSize ? `${Math.ceil(food.servingSize)}g` : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="flex items-center justify-center h-full py-8">
                      <p className="text-sm text-muted-foreground text-center">
                        {searchQuery ? "No foods found matching your search." : "No foods available. Create a food to get started."}
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="recent" className="flex-1 overflow-hidden mt-4">
                <ScrollArea className="h-[400px]">
                  {getFilteredFoods().length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Food Name</TableHead>
                          <TableHead className="text-right font-bold text-sm text-muted-foreground uppercase tracking-wider">Calories</TableHead>
                          <TableHead className="text-right font-bold text-sm text-muted-foreground uppercase tracking-wider">P</TableHead>
                          <TableHead className="text-right font-bold text-sm text-muted-foreground uppercase tracking-wider">C</TableHead>
                          <TableHead className="text-right font-bold text-sm text-muted-foreground uppercase tracking-wider">F</TableHead>
                          <TableHead className="text-right font-bold text-sm text-muted-foreground uppercase tracking-wider">Serving</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getFilteredFoods().map((food) => (
                          <TableRow 
                            key={food.id}
                            className="cursor-pointer hover:bg-accent transition-colors"
                            onClick={() => handleFoodSelection(food)}
                          >
                            <TableCell className="font-medium">{food.name}</TableCell>
                            <TableCell className="text-right">{Math.ceil(food.caloriesPerServing)}</TableCell>
                            <TableCell className="text-right">{Math.ceil(food.proteinPerServing)}</TableCell>
                            <TableCell className="text-right">{Math.ceil(food.carbsPerServing)}</TableCell>
                            <TableCell className="text-right">{Math.ceil(food.fatPerServing)}</TableCell>
                            <TableCell className="text-right">{food.servingSize ? `${Math.ceil(food.servingSize)}g` : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="flex items-center justify-center h-full py-8">
                      <p className="text-sm text-muted-foreground text-center">
                        {searchQuery ? "No recent foods found matching your search." : "No recent foods. Select foods to see them here."}
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="my-foods" className="flex-1 overflow-hidden mt-4">
                <ScrollArea className="h-[400px]">
                  {getFilteredFoods().length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Food Name</TableHead>
                          <TableHead className="text-right font-bold text-sm text-muted-foreground uppercase tracking-wider">Calories</TableHead>
                          <TableHead className="text-right font-bold text-sm text-muted-foreground uppercase tracking-wider">P</TableHead>
                          <TableHead className="text-right font-bold text-sm text-muted-foreground uppercase tracking-wider">C</TableHead>
                          <TableHead className="text-right font-bold text-sm text-muted-foreground uppercase tracking-wider">F</TableHead>
                          <TableHead className="text-right font-bold text-sm text-muted-foreground uppercase tracking-wider">Serving</TableHead>
                          <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getFilteredFoods().map((food) => (
                          <TableRow 
                            key={food.id}
                            className="cursor-pointer hover:bg-accent transition-colors"
                          >
                            <TableCell 
                              className="font-medium"
                              onClick={() => handleFoodSelection(food)}
                            >
                              {food.name}
                            </TableCell>
                            <TableCell 
                              className="text-right"
                              onClick={() => handleFoodSelection(food)}
                            >
                              {Math.ceil(food.caloriesPerServing)}
                            </TableCell>
                            <TableCell 
                              className="text-right"
                              onClick={() => handleFoodSelection(food)}
                            >
                              {Math.ceil(food.proteinPerServing)}
                            </TableCell>
                            <TableCell 
                              className="text-right"
                              onClick={() => handleFoodSelection(food)}
                            >
                              {Math.ceil(food.carbsPerServing)}
                            </TableCell>
                            <TableCell 
                              className="text-right"
                              onClick={() => handleFoodSelection(food)}
                            >
                              {Math.ceil(food.fatPerServing)}
                            </TableCell>
                            <TableCell 
                              className="text-right"
                              onClick={() => handleFoodSelection(food)}
                            >
                              {food.servingSize ? `${Math.ceil(food.servingSize)}g` : '-'}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleEditFood(food)}
                                title="Edit food"
                              >
                                <Utensils className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="flex items-center justify-center h-full py-8">
                      <p className="text-sm text-muted-foreground text-center">
                        {searchQuery ? "No custom foods found matching your search." : "No custom foods found. Create your own foods using the 'Create Food' button."}
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Serving Size Adjustment Dialog */}
      <Dialog open={servingSizeDialogOpen} onOpenChange={(open) => {
        setServingSizeDialogOpen(open);
        if (!open) {
          setSelectedFood(null);
          setAdjustedServingSize("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Serving Size</DialogTitle>
          </DialogHeader>
          
          {selectedFood && (
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-lg mb-2">{selectedFood.name}</p>
                <p className="text-sm text-muted-foreground">
                  Default serving: {Math.ceil(selectedFood.servingSize || 100)}g
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="servingSize">Serving Size (grams) *</Label>
                <Input
                  id="servingSize"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={adjustedServingSize}
                  onChange={(e) => setAdjustedServingSize(e.target.value)}
                  placeholder="Enter serving size"
                />
              </div>

              {adjustedServingSize && Number(adjustedServingSize) > 0 && (
                <div className="p-4 bg-muted/30 rounded-lg space-y-2 border">
                  <p className="text-sm font-semibold mb-2">Nutritional Values:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Calories</p>
                      <p className="font-semibold">
                        {Math.ceil(calculateAdjustedValues(selectedFood, Number(adjustedServingSize)).caloriesPerServing)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Protein</p>
                      <p className="font-semibold">
                        {Math.ceil(calculateAdjustedValues(selectedFood, Number(adjustedServingSize)).proteinPerServing)}g
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Carbs</p>
                      <p className="font-semibold">
                        {Math.ceil(calculateAdjustedValues(selectedFood, Number(adjustedServingSize)).carbsPerServing)}g
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Fat</p>
                      <p className="font-semibold">
                        {Math.ceil(calculateAdjustedValues(selectedFood, Number(adjustedServingSize)).fatPerServing)}g
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setServingSizeDialogOpen(false);
                    setSelectedFood(null);
                    setAdjustedServingSize("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAddFoodToMeal}
                  disabled={loading || !adjustedServingSize || Number(adjustedServingSize) <= 0}
                >
                  {loading ? "Adding..." : "Add to Meal"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner Dialog */}
      <Dialog open={barcodeDialogOpen} onOpenChange={(open) => {
        setBarcodeDialogOpen(open);
        if (!open) {
          setBarcodeInput("");
          stopScanner();
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Barcode</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Scanner Element - Always in DOM */}
            <div className={isScanning ? "w-full" : "hidden"}>
              <div 
                id={scannerElementId} 
                className="w-full rounded-lg"
                style={{ 
                  minHeight: "300px", 
                  backgroundColor: "#000",
                  position: "relative",
                  overflow: "hidden"
                }}
              ></div>
            </div>

            {/* Scanner Controls */}
            {isScanning ? (
              <div className="space-y-3">
                {scanError && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive font-medium">{scanError}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      You can still enter the barcode manually below.
                    </p>
                  </div>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={stopScanner}
                >
                  Stop Scanning
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={startScanner}
                >
                  <Scan className="h-4 w-4 mr-2" />
                  Start Camera Scanner
                </Button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or enter manually</span>
                  </div>
                </div>
              </div>
            )}

            {/* Manual Input */}
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode Number</Label>
              <Input
                id="barcode"
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Enter or scan barcode"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isScanning) {
                    handleBarcodeSearch();
                  }
                }}
                disabled={isScanning}
                autoFocus={!isScanning}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setBarcodeDialogOpen(false);
                  setBarcodeInput("");
                  stopScanner();
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => handleBarcodeSearch()}
                disabled={barcodeSearchLoading || !barcodeInput.trim() || isScanning}
              >
                {barcodeSearchLoading ? "Searching..." : "Search"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Food Dialog */}
      <Dialog open={createFoodOpen} onOpenChange={(open) => {
        setCreateFoodOpen(open);
        if (!open) {
          setCreateFoodData({
            name: "",
            caloriesPer100g: "",
            servingSize: "",
            proteinPer100g: "",
            carbPer100g: "",
            fatPer100g: "",
            barcode: "",
          });
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Food</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleCreateFood} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="foodName">Food Name *</Label>
              <Input
                id="foodName"
                name="name"
                value={createFoodData.name}
                onChange={handleCreateFoodChange}
                placeholder="e.g. Chicken Breast"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="barcode"
                  name="barcode"
                  value={createFoodData.barcode}
                  onChange={handleCreateFoodChange}
                  placeholder="Enter barcode number or scan"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    // TODO: Implement barcode scanner
                    toast.info("Barcode scanner coming soon!");
                  }}
                >
                  <Scan className="h-4 w-4 mr-2" />
                  Scan
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="servingSize">Serving Size (grams) *</Label>
              <Input
                id="servingSize"
                name="servingSize"
                type="number"
                step="0.1"
                value={createFoodData.servingSize}
                onChange={handleCreateFoodChange}
                placeholder="e.g. 100"
                required
              />
            </div>

            <div className="p-4 bg-muted/30 rounded-lg space-y-4">
              <p className="text-sm font-semibold">Macros per 100g</p>
              
              <div className="space-y-2">
                <Label htmlFor="proteinPer100g">Protein (g)</Label>
                <Input
                  id="proteinPer100g"
                  name="proteinPer100g"
                  type="number"
                  step="0.1"
                  value={createFoodData.proteinPer100g}
                  onChange={handleCreateFoodChange}
                  placeholder="e.g. 25"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="carbPer100g">Carbs (g)</Label>
                <Input
                  id="carbPer100g"
                  name="carbPer100g"
                  type="number"
                  step="0.1"
                  value={createFoodData.carbPer100g}
                  onChange={handleCreateFoodChange}
                  placeholder="e.g. 0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fatPer100g">Fat (g)</Label>
                <Input
                  id="fatPer100g"
                  name="fatPer100g"
                  type="number"
                  step="0.1"
                  value={createFoodData.fatPer100g}
                  onChange={handleCreateFoodChange}
                  placeholder="e.g. 3"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="caloriesPer100g">Calories per 100g (optional)</Label>
                <Input
                  id="caloriesPer100g"
                  name="caloriesPer100g"
                  type="number"
                  step="0.1"
                  value={createFoodData.caloriesPer100g}
                  onChange={handleCreateFoodChange}
                  placeholder="Auto-calculated from macros"
                />
                <p className="text-xs text-muted-foreground">
                  If left empty, calories will be calculated from macros: (Protein × 4) + (Carbs × 4) + (Fat × 9)
                </p>
              </div>

              {/* Show calculated values */}
              {(createFoodData.proteinPer100g || createFoodData.carbPer100g || createFoodData.fatPer100g) && (
                <div className="pt-3 border-t space-y-2">
                  <p className="text-xs font-semibold">Calculated Values:</p>
                  <div className="text-xs space-y-1">
                    <p className="text-muted-foreground">
                      Calories per 100g: {Math.ceil(calculateCaloriesFromMacros(
                        Number(createFoodData.proteinPer100g) || 0,
                        Number(createFoodData.carbPer100g) || 0,
                        Number(createFoodData.fatPer100g) || 0
                      ))} cal
                    </p>
                    {createFoodData.servingSize && (
                      <p className="text-muted-foreground">
                        Calories per serving ({Math.ceil(Number(createFoodData.servingSize))}g): {
                          Math.ceil(
                            calculateCaloriesFromMacros(
                              Number(createFoodData.proteinPer100g) || 0,
                              Number(createFoodData.carbPer100g) || 0,
                              Number(createFoodData.fatPer100g) || 0
                            ) * (Number(createFoodData.servingSize) / 100)
                          )
                        } cal
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={createFoodLoading}>
              {createFoodLoading ? "Creating..." : "Create Food"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Food Dialog */}
      <Dialog open={editFoodOpen} onOpenChange={(open) => {
        setEditFoodOpen(open);
        if (!open) {
          setEditFoodId(null);
          setEditFoodData({
            name: "",
            caloriesPer100g: "",
            servingSize: "",
            proteinPer100g: "",
            carbPer100g: "",
            fatPer100g: "",
            barcode: "",
          });
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Food</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleUpdateFood} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editFoodName">Food Name *</Label>
              <Input
                id="editFoodName"
                name="name"
                value={editFoodData.name}
                onChange={handleEditFoodChange}
                placeholder="e.g. Chicken Breast"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editBarcode">Barcode (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="editBarcode"
                  name="barcode"
                  value={editFoodData.barcode}
                  onChange={handleEditFoodChange}
                  placeholder="Enter barcode number or scan"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setBarcodeDialogOpen(true);
                  }}
                >
                  <Scan className="h-4 w-4 mr-2" />
                  Scan
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editServingSize">Serving Size (grams) *</Label>
              <Input
                id="editServingSize"
                name="servingSize"
                type="number"
                step="0.1"
                value={editFoodData.servingSize}
                onChange={handleEditFoodChange}
                placeholder="e.g. 100"
                required
              />
            </div>

            <div className="p-4 bg-muted/30 rounded-lg space-y-4">
              <p className="text-sm font-semibold">Macros per 100g</p>
              
              <div className="space-y-2">
                <Label htmlFor="editProteinPer100g">Protein (g)</Label>
                <Input
                  id="editProteinPer100g"
                  name="proteinPer100g"
                  type="number"
                  step="0.1"
                  value={editFoodData.proteinPer100g}
                  onChange={handleEditFoodChange}
                  placeholder="e.g. 25"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editCarbPer100g">Carbs (g)</Label>
                <Input
                  id="editCarbPer100g"
                  name="carbPer100g"
                  type="number"
                  step="0.1"
                  value={editFoodData.carbPer100g}
                  onChange={handleEditFoodChange}
                  placeholder="e.g. 0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editFatPer100g">Fat (g)</Label>
                <Input
                  id="editFatPer100g"
                  name="fatPer100g"
                  type="number"
                  step="0.1"
                  value={editFoodData.fatPer100g}
                  onChange={handleEditFoodChange}
                  placeholder="e.g. 3"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editCaloriesPer100g">Calories per 100g (optional)</Label>
                <Input
                  id="editCaloriesPer100g"
                  name="caloriesPer100g"
                  type="number"
                  step="0.1"
                  value={editFoodData.caloriesPer100g}
                  onChange={handleEditFoodChange}
                  placeholder="Auto-calculated from macros"
                />
                <p className="text-xs text-muted-foreground">
                  If left empty, calories will be calculated from macros: (Protein × 4) + (Carbs × 4) + (Fat × 9)
                </p>
              </div>

              {/* Show calculated values */}
              {(editFoodData.proteinPer100g || editFoodData.carbPer100g || editFoodData.fatPer100g) && (
                <div className="pt-3 border-t space-y-2">
                  <p className="text-xs font-semibold">Calculated Values:</p>
                  <div className="text-xs space-y-1">
                    <p className="text-muted-foreground">
                      Calories per 100g: {Math.ceil(calculateCaloriesFromMacros(
                        Number(editFoodData.proteinPer100g) || 0,
                        Number(editFoodData.carbPer100g) || 0,
                        Number(editFoodData.fatPer100g) || 0
                      ))} cal
                    </p>
                    {editFoodData.servingSize && (
                      <p className="text-muted-foreground">
                        Calories per serving ({Math.ceil(Number(editFoodData.servingSize))}g): {
                          Math.ceil(
                            calculateCaloriesFromMacros(
                              Number(editFoodData.proteinPer100g) || 0,
                              Number(editFoodData.carbPer100g) || 0,
                              Number(editFoodData.fatPer100g) || 0
                            ) * (Number(editFoodData.servingSize) / 100)
                          )
                        } cal
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={editFoodLoading}>
              {editFoodLoading ? "Updating..." : "Update Food"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Serving Size Dialog for Existing Food Items */}
      <Dialog open={editServingSizeDialogOpen} onOpenChange={(open) => {
        setEditServingSizeDialogOpen(open);
        if (!open) {
          setEditingFoodItem(null);
          setEditMealFoodData({
            name: "",
            caloriesPer100g: "",
            servingSize: "",
            proteinPer100g: "",
            carbPer100g: "",
            fatPer100g: "",
          });
        }
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Food Item</DialogTitle>
          </DialogHeader>
          
          {editingFoodItem && (
            <form onSubmit={(e) => { e.preventDefault(); handleUpdateFoodItem(); }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editMealFoodName">Food Name *</Label>
                <Input
                  id="editMealFoodName"
                  name="name"
                  value={editMealFoodData.name}
                  onChange={handleEditMealFoodChange}
                  placeholder="e.g. Chicken Breast"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editMealFoodServingSize">Serving Size (grams) *</Label>
                <Input
                  id="editMealFoodServingSize"
                  name="servingSize"
                  type="number"
                  step="0.1"
                  value={editMealFoodData.servingSize}
                  onChange={handleEditMealFoodChange}
                  placeholder="e.g. 100"
                  required
                />
              </div>

              <div className="p-4 bg-muted/30 rounded-lg space-y-4">
                <p className="text-sm font-semibold">Macros per 100g</p>
                
                <div className="space-y-2">
                  <Label htmlFor="editMealFoodProtein">Protein (g)</Label>
                  <Input
                    id="editMealFoodProtein"
                    name="proteinPer100g"
                    type="number"
                    step="0.1"
                    value={editMealFoodData.proteinPer100g}
                    onChange={handleEditMealFoodChange}
                    placeholder="e.g. 25"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editMealFoodCarbs">Carbs (g)</Label>
                  <Input
                    id="editMealFoodCarbs"
                    name="carbPer100g"
                    type="number"
                    step="0.1"
                    value={editMealFoodData.carbPer100g}
                    onChange={handleEditMealFoodChange}
                    placeholder="e.g. 0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editMealFoodFat">Fat (g)</Label>
                  <Input
                    id="editMealFoodFat"
                    name="fatPer100g"
                    type="number"
                    step="0.1"
                    value={editMealFoodData.fatPer100g}
                    onChange={handleEditMealFoodChange}
                    placeholder="e.g. 3"
                  />
                </div>

                  <div className="space-y-2">
                    <Label htmlFor="editMealFoodCalories">Calories per 100g (optional)</Label>
                    <Input
                      id="editMealFoodCalories"
                      name="caloriesPer100g"
                      type="number"
                      step="0.1"
                      value={editMealFoodData.caloriesPer100g}
                      onChange={handleEditMealFoodChange}
                      placeholder="Auto-calculated from macros"
                    />
                  </div>

                {/* Show calculated values */}
                {(editMealFoodData.proteinPer100g || editMealFoodData.carbPer100g || editMealFoodData.fatPer100g) && (
                  <div className="pt-3 border-t space-y-2">
                    <p className="text-xs font-semibold">Calculated Values:</p>
                    <div className="text-xs space-y-1">
                      <p className="text-muted-foreground">
                        Calories per 100g: {Math.ceil(calculateCaloriesFromMacros(
                          Number(editMealFoodData.proteinPer100g) || 0,
                          Number(editMealFoodData.carbPer100g) || 0,
                          Number(editMealFoodData.fatPer100g) || 0
                        ))} cal
                      </p>
                      {editMealFoodData.servingSize && (
                        <p className="text-muted-foreground">
                          Calories per serving ({Math.ceil(Number(editMealFoodData.servingSize))}g): {
                            Math.ceil(
                              calculateCaloriesFromMacros(
                                Number(editMealFoodData.proteinPer100g) || 0,
                                Number(editMealFoodData.carbPer100g) || 0,
                                Number(editMealFoodData.fatPer100g) || 0
                              ) * (Number(editMealFoodData.servingSize) / 100)
                            )
                          } cal
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setEditServingSizeDialogOpen(false);
                    setEditingFoodItem(null);
                    setEditMealFoodData({
                      name: "",
                      caloriesPer100g: "",
                      servingSize: "",
                      proteinPer100g: "",
                      carbPer100g: "",
                      fatPer100g: "",
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading || !editMealFoodData.name || !editMealFoodData.servingSize}
                >
                  {loading ? "Updating..." : "Update Food"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* API Food Preview Dialog - Using Edit Food Item Structure */}
      <Dialog open={apiFoodPreviewOpen} onOpenChange={(open) => {
        setApiFoodPreviewOpen(open);
        if (!open) {
          setApiFoodData(null);
          setEditMealFoodData({
            name: "",
            caloriesPer100g: "",
            servingSize: "",
            proteinPer100g: "",
            carbPer100g: "",
            fatPer100g: "",
          });
        }
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Food Item</DialogTitle>
          </DialogHeader>
          
          {apiFoodData && (
            <form onSubmit={(e) => { e.preventDefault(); handleAddApiFoodToMeal(); }} className="space-y-4">
              {apiFoodData.missingFields && apiFoodData.missingFields.length > 0 && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
                    ⚠️ Missing Information
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    The following fields are missing: {apiFoodData.missingFields.join(", ")}. 
                    You can edit these values before adding to meal.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="apiFoodName">Food Name *</Label>
                <Input
                  id="apiFoodName"
                  name="name"
                  value={editMealFoodData.name}
                  onChange={handleEditMealFoodChange}
                  placeholder="e.g. Chicken Breast"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiFoodServingSize">Serving Size (grams) *</Label>
                <Input
                  id="apiFoodServingSize"
                  name="servingSize"
                  type="number"
                  step="0.1"
                  value={editMealFoodData.servingSize}
                  onChange={handleEditMealFoodChange}
                  placeholder="e.g. 100"
                  required
                />
              </div>

              {/* Show calculated values */}
              {(editMealFoodData.proteinPer100g || editMealFoodData.carbPer100g || editMealFoodData.fatPer100g) && (
                <div className="pt-3 border-t space-y-2">
                  <p className="text-xs font-semibold">Calculated Values:</p>
                  <div className="text-xs space-y-1">
                    <p className="text-muted-foreground">
                      Calories per 100g: {Math.ceil(calculateCaloriesFromMacros(
                        Number(editMealFoodData.proteinPer100g) || 0,
                        Number(editMealFoodData.carbPer100g) || 0,
                        Number(editMealFoodData.fatPer100g) || 0
                      ))} cal
                    </p>
                    {editMealFoodData.servingSize && (
                      <p className="text-muted-foreground">
                        Calories per serving ({Math.ceil(Number(editMealFoodData.servingSize))}g): {
                          Math.ceil(
                            calculateCaloriesFromMacros(
                              Number(editMealFoodData.proteinPer100g) || 0,
                              Number(editMealFoodData.carbPer100g) || 0,
                              Number(editMealFoodData.fatPer100g) || 0
                            ) * (Number(editMealFoodData.servingSize) / 100)
                          )
                        } cal
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="p-4 bg-muted/30 rounded-lg space-y-4">
                <p className="text-sm font-semibold">Macros per 100g</p>
                
                <div className="space-y-2">
                  <Label htmlFor="apiFoodProtein">Protein (g)</Label>
                  <Input
                    id="apiFoodProtein"
                    name="proteinPer100g"
                    type="number"
                    step="0.1"
                    value={editMealFoodData.proteinPer100g}
                    onChange={handleEditMealFoodChange}
                    placeholder="e.g. 25"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiFoodCarbs">Carbs (g)</Label>
                  <Input
                    id="apiFoodCarbs"
                    name="carbPer100g"
                    type="number"
                    step="0.1"
                    value={editMealFoodData.carbPer100g}
                    onChange={handleEditMealFoodChange}
                    placeholder="e.g. 0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiFoodFat">Fat (g)</Label>
                  <Input
                    id="apiFoodFat"
                    name="fatPer100g"
                    type="number"
                    step="0.1"
                    value={editMealFoodData.fatPer100g}
                    onChange={handleEditMealFoodChange}
                    placeholder="e.g. 3"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiFoodCalories">Calories per 100g (optional)</Label>
                  <Input
                    id="apiFoodCalories"
                    name="caloriesPer100g"
                    type="number"
                    step="0.1"
                    value={editMealFoodData.caloriesPer100g}
                    onChange={handleEditMealFoodChange}
                    placeholder="Auto-calculated from macros"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setApiFoodPreviewOpen(false);
                    setApiFoodData(null);
                    setEditMealFoodData({
                      name: "",
                      caloriesPer100g: "",
                      servingSize: "",
                      proteinPer100g: "",
                      carbPer100g: "",
                      fatPer100g: "",
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading || !editMealFoodData.name || !editMealFoodData.servingSize}
                >
                  {loading ? "Adding..." : "Add to Meal"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Save Meal Dialog */}
      <Dialog open={saveMealDialogOpen} onOpenChange={(open) => {
        setSaveMealDialogOpen(open);
        if (!open) {
          setMealToSave(null);
          setSavedMealName("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save Meal</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="savedMealName">Meal Name *</Label>
              <Input
                id="savedMealName"
                value={savedMealName}
                onChange={(e) => setSavedMealName(e.target.value)}
                placeholder="e.g. Breakfast Bowl"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && savedMealName.trim()) {
                    e.preventDefault();
                    handleSaveMeal();
                  }
                }}
              />
            </div>

            {mealToSave && mealToSave.foods && mealToSave.foods.length > 0 && (
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-sm font-semibold mb-2">Meal Contents:</p>
                <div className="space-y-1 text-sm">
                  {mealToSave.foods.map((food, index) => (
                    <div key={index} className="text-muted-foreground">
                      • {food.name} ({Math.ceil(food.caloriesPerServing)} cal)
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t text-sm font-semibold">
                  Total: {Math.ceil(mealToSave.foods.reduce((sum, f) => sum + f.caloriesPerServing, 0))} calories
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setSaveMealDialogOpen(false);
                  setMealToSave(null);
                  setSavedMealName("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={handleSaveMeal}
                disabled={loading || !savedMealName.trim()}
              >
                {loading ? "Saving..." : "Save Meal"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Meal Dialog - Unified */}
      <Dialog open={savedMealsDialogOpen} onOpenChange={(open) => {
        setSavedMealsDialogOpen(open);
        if (!open) {
          setSavedMealsSearchQuery("");
        }
      }}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Meal</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Create Blank Meal Option */}
            <Button
              variant="outline"
              className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              onClick={async () => {
                // Create a new blank meal first
                await handleAddMeal();
                // Wait for meal to be created, then open food selection
                setTimeout(() => {
                  const meals = foodDiary?.meals || [];
                  if (meals.length > 0) {
                    const newestMeal = meals[meals.length - 1];
                    setSelectedMealId(newestMeal.id);
                    setSavedMealsDialogOpen(false);
                    setFoodSelectionOpen(true);
                  }
                }, 200);
              }}
              disabled={loading}
            >
              <Plus className="h-4 w-4 mr-2" /> Create Blank Meal
            </Button>

            {/* Divider */}
            {savedMeals.length > 0 && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or choose a saved meal</span>
                </div>
              </div>
            )}

            {/* Search */}
            {savedMeals.length > 0 && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search saved meals..."
                    value={savedMealsSearchQuery}
                    onChange={(e) => setSavedMealsSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            )}

            {/* Saved Meals List */}
            <ScrollArea className="flex-1 pr-4">
              {savedMeals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bookmark className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No saved meals yet</p>
                  <p className="text-sm mt-1">Save a meal to use it again later</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {savedMeals
                    .filter(meal => 
                      meal.name.toLowerCase().includes(savedMealsSearchQuery.toLowerCase())
                    )
                    .map((savedMeal) => {
                      const totalCalories = savedMeal.foods.reduce((sum, f) => sum + f.caloriesPerServing, 0);
                      const totalProtein = savedMeal.foods.reduce((sum, f) => sum + f.proteinPerServing, 0);
                      const totalCarbs = savedMeal.foods.reduce((sum, f) => sum + f.carbsPerServing, 0);
                      const totalFat = savedMeal.foods.reduce((sum, f) => sum + f.fatPerServing, 0);
                      
                      return (
                        <div
                          key={savedMeal.id}
                          className="p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                          onClick={() => {
                            if (selectedMealId) {
                              // Adding to existing meal (clicked meal header)
                              handleAddSavedMealToExisting(savedMeal);
                            } else {
                              // Creating new meal with saved meal
                              handleCreateMealWithSavedMeal(savedMeal);
                            }
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold text-sm">{savedMeal.name}</h4>
                              <p className="text-xs text-muted-foreground mt-1">
                                {savedMeal.foods.length} {savedMeal.foods.length === 1 ? 'item' : 'items'}
                              </p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span>{Math.ceil(totalCalories)} cal</span>
                                <span>{Math.ceil(totalProtein)}g P</span>
                                <span>{Math.ceil(totalCarbs)}g C</span>
                                <span>{Math.ceil(totalFat)}g F</span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSavedMeal(savedMeal.id);
                              }}
                              disabled={loading}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
