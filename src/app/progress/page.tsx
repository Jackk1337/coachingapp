"use client";

import { useState, useEffect } from "react";
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
import { ChevronLeft, ChevronRight } from "lucide-react";
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

interface DailyCheckin {
  date: string;
  currentWeight: number;
  stepCount: number;
  hoursOfSleep: number;
  trainedToday: string;
  cardioToday: string;
  calorieGoalMet: string;
}

export default function ProgressPage() {
  const { user, profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weeklyCheckins, setWeeklyCheckins] = useState<DailyCheckin[]>([]);
  const [allCheckins, setAllCheckins] = useState<DailyCheckin[]>([]);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="p-4 max-w-4xl mx-auto min-h-screen pb-20">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Progress</h1>
        <Link href="/">
          <Button variant="outline">Dashboard</Button>
        </Link>
      </div>

      <div className="flex items-center justify-between bg-card p-4 rounded-lg shadow-sm mb-6 border">
        <Button variant="ghost" size="icon" onClick={() => handleWeekChange(-1)}>
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div className="text-center">
          <span className="text-lg font-medium block">
            {format(start, "dd MMM")} - {format(end, "dd MMM yyyy")}
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => handleWeekChange(1)}>
          <ChevronRight className="h-6 w-6" />
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
    </div>
  );
}
