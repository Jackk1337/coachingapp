"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, addDoc, deleteDoc, doc } from "firebase/firestore";
import { format, addDays, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Plus, Trash2, Activity, Timer, Flame, Heart } from "lucide-react";
import { toast } from "sonner";

interface CardioSession {
  id: string;
  name: string;
  time: number; // minutes
  avgHeartRate: number;
  calories: number;
  date: string;
}

export default function CardioLogPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [cardioSessions, setCardioSessions] = useState<CardioSession[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    name: "",
    time: "",
    avgHeartRate: "",
    calories: "",
  });

  const displayDate = format(currentDate, "dd/MM/yyyy");
  const dbDate = format(currentDate, "yyyy-MM-dd");

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "cardio_log"),
      where("userId", "==", user.uid),
      where("date", "==", dbDate)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessions: CardioSession[] = [];
      snapshot.forEach((doc) => {
        sessions.push({ id: doc.id, ...doc.data() } as CardioSession);
      });
      setCardioSessions(sessions);
    });

    return () => unsubscribe();
  }, [user, dbDate]);

  const handleDateChange = (days: number) => {
    setCurrentDate((prev) => (days > 0 ? addDays(prev, days) : subDays(prev, Math.abs(days))));
  };

  const handleAddCardio = async () => {
    if (!user || !formData.name || !formData.time) return;

    try {
      await addDoc(collection(db, "cardio_log"), {
        userId: user.uid,
        date: dbDate,
        name: formData.name,
        time: Number(formData.time),
        avgHeartRate: Number(formData.avgHeartRate),
        calories: Number(formData.calories),
        createdAt: new Date(),
      });
      
      setFormData({ name: "", time: "", avgHeartRate: "", calories: "" });
      setIsDialogOpen(false);
      toast.success("Cardio session logged!");
    } catch (error) {
      console.error("Error logging cardio:", error);
      toast.error("Failed to log cardio session.");
    }
  };

  const handleDeleteCardio = async (id: string) => {
    if (confirm("Are you sure you want to delete this session?")) {
      try {
        await deleteDoc(doc(db, "cardio_log", id));
        toast.success("Cardio session deleted.");
      } catch (error) {
        console.error("Error deleting session:", error);
        toast.error("Failed to delete session.");
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

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
          <h1 className="text-lg font-semibold">Cardio Log</h1>
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full mb-6">
            <Plus className="mr-2 h-5 w-5" /> Log Cardio Session
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Cardio Session</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Activity Name</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Running, Cycling"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="time">Duration (minutes)</Label>
              <Input
                id="time"
                name="time"
                type="number"
                value={formData.time}
                onChange={handleChange}
                placeholder="e.g. 30"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="avgHeartRate">Avg Heart Rate (bpm)</Label>
              <Input
                id="avgHeartRate"
                name="avgHeartRate"
                type="number"
                value={formData.avgHeartRate}
                onChange={handleChange}
                placeholder="e.g. 145"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="calories">Calories Burned</Label>
              <Input
                id="calories"
                name="calories"
                type="number"
                value={formData.calories}
                onChange={handleChange}
                placeholder="e.g. 300"
              />
            </div>
            <Button onClick={handleAddCardio} disabled={!formData.name || !formData.time}>
              Save Session
            </Button>
          </div>
        </DialogContent>
        </Dialog>

        <div className="space-y-4">
        {cardioSessions.map((session) => (
          <Card key={session.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                {session.name}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteCardio(session.id)}
                className="text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="flex flex-col items-center p-2 bg-secondary/50 rounded-md">
                  <Timer className="h-4 w-4 mb-1 text-muted-foreground" />
                  <span className="font-bold">{session.time}</span>
                  <span className="text-xs text-muted-foreground">mins</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-secondary/50 rounded-md">
                  <Heart className="h-4 w-4 mb-1 text-muted-foreground" />
                  <span className="font-bold">{session.avgHeartRate || "-"}</span>
                  <span className="text-xs text-muted-foreground">bpm</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-secondary/50 rounded-md">
                  <Flame className="h-4 w-4 mb-1 text-muted-foreground" />
                  <span className="font-bold">{session.calories || "-"}</span>
                  <span className="text-xs text-muted-foreground">cal</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {cardioSessions.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            No cardio sessions logged for this day.
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
