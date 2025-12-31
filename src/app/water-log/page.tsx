"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, Timestamp, onSnapshot } from "firebase/firestore";
import { format, addDays, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Droplet } from "lucide-react";
import { toast } from "sonner";

interface WaterLog {
  userId: string;
  date: string;
  totalML: number; // Total milliliters consumed
  entries: WaterEntry[];
  createdAt?: any;
  updatedAt?: any;
}

interface WaterEntry {
  id: string;
  amountML: number;
  timestamp: any;
}

export default function WaterLogPage() {
  const { user, profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [waterLog, setWaterLog] = useState<WaterLog | null>(null);
  const [loading, setLoading] = useState(false);

  const displayDate = format(currentDate, "dd/MM/yyyy");
  const dbDate = format(currentDate, "yyyy-MM-dd");
  const docId = user ? `${user.uid}_${dbDate}` : null;

  // Water goal in liters (convert to ML for calculations)
  const waterGoalLiters = profile?.goals?.waterGoal || 2;
  const waterGoalML = waterGoalLiters * 1000;
  const currentWaterML = waterLog?.totalML || 0;
  const percentage = waterGoalML > 0 ? Math.min(100, (currentWaterML / waterGoalML) * 100) : 0;

  useEffect(() => {
    if (!user || !docId) return;

    const waterLogRef = doc(db, "water_log", docId);
    
    const unsubscribe = onSnapshot(waterLogRef, (snapshot) => {
      if (snapshot.exists()) {
        setWaterLog(snapshot.data() as WaterLog);
      } else {
        setWaterLog(null);
      }
    });

    return () => unsubscribe();
  }, [user, docId]);

  const handleDateChange = (days: number) => {
    setCurrentDate((prev) => (days > 0 ? addDays(prev, days) : subDays(prev, Math.abs(days))));
  };

  const handleAddWater = async (amountML: number) => {
    if (!user || !docId) return;

    setLoading(true);
    try {
      const waterLogRef = doc(db, "water_log", docId);
      const snapshot = await getDoc(waterLogRef);

      const newEntry: WaterEntry = {
        id: Date.now().toString(),
        amountML,
        timestamp: Timestamp.now(),
      };

      if (snapshot.exists()) {
        const existingData = snapshot.data() as WaterLog;
        const updatedEntries = [...(existingData.entries || []), newEntry];
        const newTotalML = existingData.totalML + amountML;

        await setDoc(waterLogRef, {
          ...existingData,
          totalML: newTotalML,
          entries: updatedEntries,
          updatedAt: Timestamp.now(),
        }, { merge: true });
      } else {
        await setDoc(waterLogRef, {
          userId: user.uid,
          date: dbDate,
          totalML: amountML,
          entries: [newEntry],
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }

      toast.success(`Added ${amountML}ML of water`);
    } catch (error) {
      console.error("Error adding water:", error);
      toast.error("Failed to log water");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!user || !docId || !waterLog) return;

    const entryToDelete = waterLog.entries.find(e => e.id === entryId);
    if (!entryToDelete) return;

    setLoading(true);
    try {
      const waterLogRef = doc(db, "water_log", docId);
      const updatedEntries = waterLog.entries.filter(e => e.id !== entryId);
      const newTotalML = waterLog.totalML - entryToDelete.amountML;

      await setDoc(waterLogRef, {
        ...waterLog,
        totalML: newTotalML,
        entries: updatedEntries,
        updatedAt: Timestamp.now(),
      }, { merge: true });

      toast.success("Water entry deleted");
    } catch (error) {
      console.error("Error deleting water entry:", error);
      toast.error("Failed to delete entry");
    } finally {
      setLoading(false);
    }
  };

  const incrementButtons = [
    { label: "250ML", amount: 250 },
    { label: "500ML", amount: 500 },
    { label: "750ML", amount: 750 },
    { label: "1L", amount: 1000 },
  ];

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
          <h1 className="text-lg font-semibold">Water Log</h1>
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

      <div className="px-4 py-6">
        {/* Water Goal Display */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Droplet className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-semibold">Water Goal</h2>
              </div>
              <div className="text-3xl font-bold mb-1">
                {(currentWaterML / 1000).toFixed(2)}L / {waterGoalLiters}L
              </div>
              <div className="text-sm text-muted-foreground">
                {currentWaterML}ML / {waterGoalML}ML
              </div>
            </div>

            {/* Visual Fill Indicator */}
            <div className="relative w-full h-32 bg-muted rounded-lg overflow-hidden mb-4">
              {/* Water Fill */}
              <div
                className="absolute bottom-0 left-0 right-0 bg-primary/80 transition-all duration-500 ease-in-out"
                style={{ height: `${percentage}%` }}
              >
                {/* Water wave effect */}
                <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-primary/40"></div>
              </div>
              
              {/* Percentage overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-foreground drop-shadow-lg">
                  {Math.round(percentage)}%
                </span>
              </div>

              {/* Goal line indicator */}
              {percentage < 100 && (
                <div className="absolute left-0 right-0 border-t-2 border-dashed border-primary/50" style={{ bottom: `${100 - percentage}%` }}></div>
              )}
            </div>

            {/* Increment Buttons */}
            <div className="grid grid-cols-2 gap-3">
              {incrementButtons.map((button) => (
                <Button
                  key={button.amount}
                  onClick={() => handleAddWater(button.amount)}
                  disabled={loading}
                  className="h-12 text-base font-semibold"
                >
                  +{button.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Water Entries */}
        {waterLog && waterLog.entries && waterLog.entries.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Today's Entries</h3>
              <div className="space-y-2">
                {waterLog.entries
                  .sort((a, b) => {
                    const aTime = a.timestamp?.toMillis?.() || 0;
                    const bTime = b.timestamp?.toMillis?.() || 0;
                    return bTime - aTime;
                  })
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Droplet className="h-5 w-5 text-primary" />
                        <div>
                          <div className="font-medium">{entry.amountML}ML</div>
                          {entry.timestamp && (
                            <div className="text-xs text-muted-foreground">
                              {format(entry.timestamp.toDate(), "HH:mm")}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteEntry(entry.id)}
                        disabled={loading}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        ×
                      </Button>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {(!waterLog || !waterLog.entries || waterLog.entries.length === 0) && (
          <div className="text-center py-10 text-muted-foreground">
            No water logged for this day. Use the buttons above to add water.
          </div>
        )}
      </div>
    </div>
  );
}








