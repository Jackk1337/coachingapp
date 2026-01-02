"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { calculateExerciseStats } from "@/lib/rep-calculator";

interface DailyCheckin {
  date: string;
  currentWeight: number;
  stepCount: number;
  hoursOfSleep: number;
  trainedToday: string;
  cardioToday: string;
  calorieGoalMet: string;
}

interface WorkoutSet {
  id: string;
  weight: number;
  reps: number;
  rpe: number;
  completed: boolean;
  dropset?: boolean;
  superset?: boolean;
  isPB?: boolean;
}

interface WorkoutExercise {
  exerciseId: string;
  name?: string;
  sets: WorkoutSet[];
}

interface WorkoutLog {
  id: string;
  date: string;
  status: "in_progress" | "completed";
  exercises: WorkoutExercise[];
}

interface Exercise {
  id: string;
  name: string;
  category: string;
  userId: string;
}

interface ExerciseSetData {
  date: string;
  weight: number;
  reps: number;
  rpe: number;
  volume: number; // weight * reps
}

interface AggregatedData {
  date: string;
  maxWeight: number;
  avgRPE: number;
  totalVolume: number;
  setCount: number;
}

export default function ProgressPage() {
  const { user, profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weeklyCheckins, setWeeklyCheckins] = useState<DailyCheckin[]>([]);
  const [allCheckins, setAllCheckins] = useState<DailyCheckin[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Workout Progress state
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseData, setExerciseData] = useState<ExerciseSetData[]>([]);
  const [loadingExerciseData, setLoadingExerciseData] = useState(false);
  const [viewMode, setViewMode] = useState<"all" | "aggregated">("all");
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState<string>("");
  const [showExerciseDropdown, setShowExerciseDropdown] = useState<boolean>(false);
  const exerciseDropdownRef = useRef<HTMLDivElement>(null);
  const [allWorkoutLogs, setAllWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [loadingWorkoutStats, setLoadingWorkoutStats] = useState(false);

  // Determine start and end of the week (Monday start)
  const start = startOfWeek(currentDate, { weekStartsOn: 1 });
  const end = endOfWeek(currentDate, { weekStartsOn: 1 });
  
  // Create array of days for the table headers
  const daysOfWeek = eachDayOfInterval({ start, end });

  // Format dates for query strings
  const startDateStr = format(start, "yyyy-MM-dd");
  const endDateStr = format(end, "yyyy-MM-dd");

  useEffect(() => {
    if (!user) return;

    const fetchWeeklyData = async () => {
      // Weekly Data for Table
      try {
        const qWeekly = query(
          collection(db, "daily_checkins"),
          where("userId", "==", user.uid),
          where("date", ">=", startDateStr),
          where("date", "<=", endDateStr),
          orderBy("date", "asc")
        );
        
        const snapshotWeekly = await getDocs(qWeekly);
        const dataWeekly: DailyCheckin[] = [];
        snapshotWeekly.forEach((doc) => {
          dataWeekly.push(doc.data() as DailyCheckin);
        });
        setWeeklyCheckins(dataWeekly);
      } catch (error) {
        console.error("Error fetching weekly data:", error);
      }
    };

    fetchWeeklyData();
  }, [user, startDateStr, endDateStr]);

  useEffect(() => {
    if (!user) return;

    const fetchAllData = async () => {
      // All Data for Graphs
      setLoading(true);
      try {
        const qAll = query(
          collection(db, "daily_checkins"),
          where("userId", "==", user.uid),
          orderBy("date", "asc")
        );
        
        const snapshotAll = await getDocs(qAll);
        const dataAll: DailyCheckin[] = [];
        snapshotAll.forEach((doc) => {
          dataAll.push(doc.data() as DailyCheckin);
        });
        setAllCheckins(dataAll);
      } catch (error) {
        console.error("Error fetching historical data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [user]);

  // Fetch exercises for workout progress
  useEffect(() => {
    if (!user) return;

    const fetchExercises = async () => {
      try {
        const exercisesQuery = query(
          collection(db, "exercise_library"),
          where("userId", "in", [user.uid, "rallyfit"]),
          orderBy("name")
        );
        
        const snapshot = await getDocs(exercisesQuery);
        const exerciseList: Exercise[] = [];
        snapshot.forEach((doc) => {
          exerciseList.push({ id: doc.id, ...doc.data() } as Exercise);
        });
        setExercises(exerciseList);
      } catch (error) {
        console.error("Error fetching exercises:", error);
      }
    };

    fetchExercises();
  }, [user]);

  // Fetch all workout logs for general statistics
  useEffect(() => {
    if (!user) {
      setAllWorkoutLogs([]);
      return;
    }

    const fetchAllWorkoutLogs = async () => {
      setLoadingWorkoutStats(true);
      try {
        const workoutsQuery = query(
          collection(db, "workout_logs"),
          where("userId", "==", user.uid),
          where("status", "==", "completed"),
          orderBy("date", "desc")
        );

        const snapshot = await getDocs(workoutsQuery);
        const logs: WorkoutLog[] = [];
        snapshot.forEach((doc) => {
          logs.push({ id: doc.id, ...doc.data() } as WorkoutLog);
        });
        setAllWorkoutLogs(logs);
      } catch (error) {
        console.error("Error fetching workout logs:", error);
      } finally {
        setLoadingWorkoutStats(false);
      }
    };

    fetchAllWorkoutLogs();
  }, [user]);

  // Fetch workout data for selected exercise
  useEffect(() => {
    if (!user || !selectedExerciseId) {
      setExerciseData([]);
      return;
    }

    const fetchExerciseWorkoutData = async () => {
      setLoadingExerciseData(true);
      try {
        // Fetch all completed workouts for this user
        const workoutsQuery = query(
          collection(db, "workout_logs"),
          where("userId", "==", user.uid),
          where("status", "==", "completed"),
          orderBy("date", "asc")
        );

        const snapshot = await getDocs(workoutsQuery);
        const allSets: ExerciseSetData[] = [];

        snapshot.forEach((doc) => {
          const workoutData = doc.data() as WorkoutLog;
          const exercise = workoutData.exercises?.find(e => e.exerciseId === selectedExerciseId);
          
          if (exercise && exercise.sets && exercise.sets.length > 0) {
            exercise.sets.forEach((set) => {
              // Only include completed sets with valid data
              if (set.completed && set.weight > 0 && set.reps > 0) {
                allSets.push({
                  date: workoutData.date,
                  weight: set.weight,
                  reps: set.reps,
                  rpe: set.rpe || 0,
                  volume: set.weight * set.reps,
                });
              }
            });
          }
        });

        setExerciseData(allSets);
      } catch (error) {
        console.error("Error fetching exercise workout data:", error);
      } finally {
        setLoadingExerciseData(false);
      }
    };

    fetchExerciseWorkoutData();
  }, [user, selectedExerciseId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exerciseDropdownRef.current && !exerciseDropdownRef.current.contains(event.target as Node)) {
        setShowExerciseDropdown(false);
      }
    };

    if (showExerciseDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showExerciseDropdown]);

  const handleWeekChange = (weeks: number) => {
    setCurrentDate((prev) => (weeks > 0 ? addWeeks(prev, weeks) : subWeeks(prev, Math.abs(weeks))));
  };

  const getCheckinForDay = (day: Date) => {
    return weeklyCheckins.find(c => isSameDay(parseISO(c.date), day));
  };

  // Helper to calculate average
  const calculateAverage = (field: keyof DailyCheckin) => {
    if (weeklyCheckins.length === 0) return "-";
    const sum = weeklyCheckins.reduce((acc, curr) => acc + (Number(curr[field]) || 0), 0);
    const count = weeklyCheckins.filter(c => c[field] !== undefined && c[field] !== null).length; // Only count entries with data
    return count > 0 ? (sum / count).toFixed(1) : "-";
  };
  
  // Format helpers
  const formatValue = (val: string | number | undefined) => {
      if (val === undefined || val === null || val === "") return "-";
      return val;
  }

  // Prepare data for graphs
  const startingWeight = profile?.goals?.startingWeight || 0;
  
  const weightData = allCheckins.map(c => ({
    date: format(parseISO(c.date), 'dd/MM'),
    currentWeight: c.currentWeight,
    startingWeight: startingWeight
  }));

  const stepsData = allCheckins.map(c => ({
    date: format(parseISO(c.date), 'dd/MM'),
    steps: c.stepCount
  }));

  const sleepData = allCheckins.map(c => ({
    date: format(parseISO(c.date), 'dd/MM'),
    sleep: c.hoursOfSleep
  }));

  // Calculate exercise statistics
  const exerciseStats = exerciseData.length > 0
    ? calculateExerciseStats(
        exerciseData.map(set => ({
          weight: set.weight,
          reps: set.reps,
          date: set.date,
        }))
      )
    : null;

  const avgRPE = exerciseData.length > 0
    ? exerciseData.reduce((sum, set) => sum + set.rpe, 0) / exerciseData.length
    : 0;

  const totalVolume = exerciseData.reduce((sum, set) => sum + set.volume, 0);

  // Process data for graphs
  const processGraphData = () => {
    if (viewMode === "all") {
      // All sets view - show each set as a data point
      return exerciseData.map(set => ({
        date: format(parseISO(set.date), 'dd/MM/yyyy'),
        weight: set.weight,
        volume: set.volume,
        rpe: set.rpe,
        reps: set.reps,
      })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else {
      // Aggregated view - group by date
      const dateMap = new Map<string, AggregatedData>();
      
      exerciseData.forEach(set => {
        const dateKey = set.date;
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, {
            date: dateKey,
            maxWeight: 0,
            avgRPE: 0,
            totalVolume: 0,
            setCount: 0,
          });
        }
        
        const dayData = dateMap.get(dateKey)!;
        dayData.maxWeight = Math.max(dayData.maxWeight, set.weight);
        dayData.totalVolume += set.volume;
        dayData.avgRPE += set.rpe;
        dayData.setCount += 1;
      });

      // Calculate averages
      const aggregated: AggregatedData[] = Array.from(dateMap.values()).map(day => ({
        ...day,
        avgRPE: day.setCount > 0 ? day.avgRPE / day.setCount : 0,
      }));

      return aggregated
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(day => ({
          date: format(parseISO(day.date), 'dd/MM/yyyy'),
          weight: day.maxWeight,
          volume: day.totalVolume,
          rpe: Math.round(day.avgRPE * 10) / 10,
        }));
    }
  };

  const graphData = processGraphData();

  // Get selected exercise name
  const selectedExercise = exercises.find(e => e.id === selectedExerciseId);
  const selectedExerciseName = selectedExercise 
    ? `${selectedExercise.name}${selectedExercise.category ? ` (${selectedExercise.category})` : ""}`
    : "";

  // Filter exercises based on search query
  const filteredExercises = exercises.filter(exercise => {
    const searchLower = exerciseSearchQuery.toLowerCase();
    return exercise.name.toLowerCase().includes(searchLower) ||
           (exercise.category && exercise.category.toLowerCase().includes(searchLower));
  });

  const handleExerciseSelect = (exerciseId: string) => {
    setSelectedExerciseId(exerciseId);
    setExerciseSearchQuery("");
    setShowExerciseDropdown(false);
  };

  const handleExerciseSearchChange = (value: string) => {
    setExerciseSearchQuery(value);
    setShowExerciseDropdown(true);
    // Clear selection when user starts typing a new search
    if (selectedExerciseId && value !== selectedExerciseName) {
      setSelectedExerciseId("");
    }
  };

  // Calculate general workout statistics
  const calculateGeneralStats = () => {
    if (allWorkoutLogs.length === 0) {
      return {
        totalWorkouts: 0,
        totalExercises: 0,
        totalVolume: 0,
        totalSets: 0,
        mostPerformedExercise: null as { id: string; name: string; count: number } | null,
        workoutsThisWeek: 0,
        workoutsThisMonth: 0,
        averageWorkoutsPerWeek: 0,
      };
    }

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalVolume = 0;
    let totalSets = 0;
    const exerciseCounts = new Map<string, { name: string; count: number }>();
    let workoutsThisWeek = 0;
    let workoutsThisMonth = 0;
    const uniqueExercises = new Set<string>();

    allWorkoutLogs.forEach((log) => {
      const workoutDate = parseISO(log.date);
      
      if (workoutDate >= weekStart) workoutsThisWeek++;
      if (workoutDate >= monthStart) workoutsThisMonth++;

      log.exercises?.forEach((exercise) => {
        uniqueExercises.add(exercise.exerciseId);
        
        const currentCount = exerciseCounts.get(exercise.exerciseId) || { name: exercise.name || "Unknown", count: 0 };
        exerciseCounts.set(exercise.exerciseId, {
          name: currentCount.name,
          count: currentCount.count + 1,
        });

        exercise.sets?.forEach((set) => {
          if (set.completed && set.weight > 0 && set.reps > 0) {
            totalVolume += set.weight * set.reps;
            totalSets++;
          }
        });
      });
    });

    // Find most performed exercise
    let mostPerformedExercise: { id: string; name: string; count: number } | null = null;
    exerciseCounts.forEach((value, key) => {
      if (!mostPerformedExercise || value.count > mostPerformedExercise.count) {
        mostPerformedExercise = { id: key, name: value.name, count: value.count };
      }
    });

    // Calculate average workouts per week
    if (allWorkoutLogs.length > 0) {
      const firstWorkoutDate = parseISO(allWorkoutLogs[allWorkoutLogs.length - 1].date);
      const weeksSinceFirst = Math.max(1, Math.ceil((now.getTime() - firstWorkoutDate.getTime()) / (1000 * 60 * 60 * 24 * 7)));
      const averageWorkoutsPerWeek = allWorkoutLogs.length / weeksSinceFirst;
      return {
        totalWorkouts: allWorkoutLogs.length,
        totalExercises: uniqueExercises.size,
        totalVolume,
        totalSets,
        mostPerformedExercise,
        workoutsThisWeek,
        workoutsThisMonth,
        averageWorkoutsPerWeek: Math.round(averageWorkoutsPerWeek * 10) / 10,
      };
    }

    return {
      totalWorkouts: 0,
      totalExercises: 0,
      totalVolume: 0,
      totalSets: 0,
      mostPerformedExercise: null,
      workoutsThisWeek: 0,
      workoutsThisMonth: 0,
      averageWorkoutsPerWeek: 0,
    };
  };

  const generalStats = calculateGeneralStats();

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
          <h1 className="text-lg font-semibold">Progress</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </div>

      <div className="px-4 py-6 max-w-4xl mx-auto">
        <Tabs defaultValue="weekly" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="weekly">Weekly Progress</TabsTrigger>
            <TabsTrigger value="workout">Workout Progress</TabsTrigger>
          </TabsList>

          {/* Weekly Progress Tab */}
          <TabsContent value="weekly" className="space-y-6">
            {/* Week Navigation */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
              <Button variant="ghost" size="icon" onClick={() => handleWeekChange(-1)}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="text-center">
                <span className="text-lg font-medium block">
                  {format(start, "dd MMM")} - {format(end, "dd MMM yyyy")}
                </span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleWeekChange(1)}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Weekly Overview</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
            <ScrollArea className="w-full whitespace-nowrap rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px] bg-muted/50 sticky left-0 z-10">Metric</TableHead>
                    {daysOfWeek.map((day) => (
                      <TableHead key={day.toString()} className="text-center min-w-[100px]">
                        {format(day, "EEE dd")}
                      </TableHead>
                    ))}
                    <TableHead className="text-center font-bold min-w-[100px] bg-muted/20">Average</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Weight Row */}
                  <TableRow>
                    <TableCell className="font-medium bg-muted/50 sticky left-0 z-10">Weight (Kg)</TableCell>
                    {daysOfWeek.map((day) => (
                      <TableCell key={`weight-${day}`} className="text-center">
                        {formatValue(getCheckinForDay(day)?.currentWeight)}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold bg-muted/20">{calculateAverage("currentWeight")}</TableCell>
                  </TableRow>

                   {/* Step Count Row */}
                   <TableRow>
                    <TableCell className="font-medium bg-muted/50 sticky left-0 z-10">Steps</TableCell>
                    {daysOfWeek.map((day) => (
                      <TableCell key={`steps-${day}`} className="text-center">
                        {formatValue(getCheckinForDay(day)?.stepCount)}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold bg-muted/20">{Number(calculateAverage("stepCount")).toLocaleString() !== "NaN" ? Number(calculateAverage("stepCount")).toLocaleString() : "-"}</TableCell>
                  </TableRow>

                   {/* Sleep Row */}
                   <TableRow>
                    <TableCell className="font-medium bg-muted/50 sticky left-0 z-10">Sleep (Hrs)</TableCell>
                    {daysOfWeek.map((day) => (
                      <TableCell key={`sleep-${day}`} className="text-center">
                        {formatValue(getCheckinForDay(day)?.hoursOfSleep)}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold bg-muted/20">{calculateAverage("hoursOfSleep")}</TableCell>
                  </TableRow>

                  {/* Trained Today Row */}
                  <TableRow>
                    <TableCell className="font-medium bg-muted/50 sticky left-0 z-10">Trained</TableCell>
                    {daysOfWeek.map((day) => (
                      <TableCell key={`trained-${day}`} className="text-center text-xs">
                        {formatValue(getCheckinForDay(day)?.trainedToday)}
                      </TableCell>
                    ))}
                    <TableCell className="text-center bg-muted/20 text-muted-foreground">-</TableCell>
                  </TableRow>

                  {/* Cardio Row */}
                  <TableRow>
                    <TableCell className="font-medium bg-muted/50 sticky left-0 z-10">Cardio</TableCell>
                    {daysOfWeek.map((day) => (
                      <TableCell key={`cardio-${day}`} className="text-center text-xs">
                        {formatValue(getCheckinForDay(day)?.cardioToday)}
                      </TableCell>
                    ))}
                    <TableCell className="text-center bg-muted/20 text-muted-foreground">-</TableCell>
                  </TableRow>

                   {/* Calorie Goal Row */}
                   <TableRow>
                    <TableCell className="font-medium bg-muted/50 sticky left-0 z-10">Calorie Goal</TableCell>
                    {daysOfWeek.map((day) => (
                      <TableCell key={`cals-${day}`} className="text-center text-xs">
                        {formatValue(getCheckinForDay(day)?.calorieGoalMet)}
                      </TableCell>
                    ))}
                    <TableCell className="text-center bg-muted/20 text-muted-foreground">-</TableCell>
                  </TableRow>

                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
            <CardHeader>
                <CardTitle>Weight Progress</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={weightData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis domain={['auto', 'auto']} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="currentWeight" stroke="#8884d8" name="Current Weight" strokeWidth={2} />
                            <Line type="monotone" dataKey="startingWeight" stroke="#82ca9d" name="Starting Weight" strokeDasharray="5 5" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Step Count History</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={stepsData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="steps" stroke="#82ca9d" name="Step Count" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>

        <Card className="md:col-span-2">
            <CardHeader>
                <CardTitle>Sleep History</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sleepData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis domain={[0, 12]} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="sleep" stroke="#ffc658" name="Hours of Sleep" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
      </div>
          </TabsContent>

          {/* Workout Progress Tab */}
          <TabsContent value="workout" className="space-y-6">
            {/* Exercise Selector */}
            <Card>
              <CardHeader>
                <CardTitle>Select Exercise</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative" ref={exerciseDropdownRef}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search exercises..."
                      value={selectedExerciseId && !showExerciseDropdown ? selectedExerciseName : exerciseSearchQuery}
                      onChange={(e) => handleExerciseSearchChange(e.target.value)}
                      onFocus={() => {
                        setShowExerciseDropdown(true);
                        if (selectedExerciseId) {
                          setExerciseSearchQuery("");
                        }
                      }}
                      className="pl-10 pr-10"
                    />
                    {selectedExerciseId && (
                      <button
                        onClick={() => {
                          setSelectedExerciseId("");
                          setExerciseSearchQuery("");
                          setShowExerciseDropdown(false);
                        }}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {showExerciseDropdown && exerciseSearchQuery && filteredExercises.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-[300px] overflow-auto">
                      {filteredExercises.map((exercise) => (
                        <button
                          key={exercise.id}
                          onClick={() => handleExerciseSelect(exercise.id)}
                          className="w-full text-left px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                          <div className="font-medium">{exercise.name}</div>
                          {exercise.category && (
                            <div className="text-sm text-muted-foreground">{exercise.category}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {showExerciseDropdown && exerciseSearchQuery && filteredExercises.length === 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md p-4 text-center text-muted-foreground">
                      No exercises found
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {selectedExerciseId && (
              <>
                {/* Statistics */}
                {loadingExerciseData ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Loading exercise data...
                    </CardContent>
                  </Card>
                ) : exerciseData.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No workout data found for this exercise.
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">Max Weight</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {exerciseStats?.maxWeight || 0} kg
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">Max Reps</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {exerciseStats?.maxReps || 0}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">Estimated 1RM</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {exerciseStats?.estimated1RM || 0} kg
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">Average RPE</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {avgRPE > 0 ? avgRPE.toFixed(1) : "-"}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">Total Volume</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {totalVolume.toLocaleString()} kg
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">Best Set</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {exerciseStats?.bestSet ? (
                            <div className="space-y-1">
                              <div className="text-lg font-bold">
                                {exerciseStats.bestSet.weight} kg × {exerciseStats.bestSet.reps}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {exerciseStats.bestSet.date ? format(parseISO(exerciseStats.bestSet.date), "dd MMM yyyy") : ""}
                              </div>
                            </div>
                          ) : (
                            <div className="text-muted-foreground">-</div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* View Mode Toggle */}
                    <Card>
                      <CardHeader>
                        <CardTitle>View Mode</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RadioGroup value={viewMode} onValueChange={(value) => setViewMode(value as "all" | "aggregated")}>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="all" id="all" />
                            <Label htmlFor="all" className="cursor-pointer">All Sets</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="aggregated" id="aggregated" />
                            <Label htmlFor="aggregated" className="cursor-pointer">Aggregated (per workout)</Label>
                          </div>
                        </RadioGroup>
                      </CardContent>
                    </Card>

                    {/* Graphs */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Weight Progression</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[300px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={graphData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Line type="monotone" dataKey="weight" stroke="#8884d8" name="Weight (kg)" strokeWidth={2} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Volume Progression</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[300px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={graphData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Line type="monotone" dataKey="volume" stroke="#82ca9d" name="Volume (kg)" strokeWidth={2} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>RPE Progression</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[300px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={graphData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis domain={[0, 10]} />
                              <Tooltip />
                              <Legend />
                              <Line type="monotone" dataKey="rpe" stroke="#ffc658" name="RPE" strokeWidth={2} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </>
            )}

            {!selectedExerciseId && (
              <>
                {loadingWorkoutStats ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Loading workout statistics...
                    </CardContent>
                  </Card>
                ) : generalStats.totalWorkouts === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No workout data found. Complete some workouts to see statistics here.
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle>Overall Workout Statistics</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <div className="text-sm text-muted-foreground mb-1">Total Workouts</div>
                            <div className="text-2xl font-bold">{generalStats.totalWorkouts}</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground mb-1">Total Exercises</div>
                            <div className="text-2xl font-bold">{generalStats.totalExercises}</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground mb-1">Total Sets</div>
                            <div className="text-2xl font-bold">{generalStats.totalSets.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground mb-1">Total Volume</div>
                            <div className="text-2xl font-bold">{Math.round(generalStats.totalVolume).toLocaleString()} kg</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle>Recent Activity</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">This Week</span>
                              <span className="text-lg font-semibold">{generalStats.workoutsThisWeek} workouts</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">This Month</span>
                              <span className="text-lg font-semibold">{generalStats.workoutsThisMonth} workouts</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Avg per Week</span>
                              <span className="text-lg font-semibold">{generalStats.averageWorkoutsPerWeek}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Most Performed Exercise</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {generalStats.mostPerformedExercise ? (
                            <div className="space-y-2">
                              <div className="text-lg font-semibold">
                                {generalStats.mostPerformedExercise.name}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Performed in {generalStats.mostPerformedExercise.count} workout{generalStats.mostPerformedExercise.count !== 1 ? 's' : ''}
                              </div>
                            </div>
                          ) : (
                            <div className="text-muted-foreground">No data available</div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardContent className="py-8 text-center">
                        <p className="text-muted-foreground mb-2">Select an exercise above to view detailed progress</p>
                      </CardContent>
                    </Card>
                  </>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
