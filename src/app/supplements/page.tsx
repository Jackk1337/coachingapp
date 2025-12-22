"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { format, addDays, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Pill, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Supplement {
  id: string;
  name: string;
  amount: string;
  userId: string;
  createdAt?: any;
  updatedAt?: any;
}

interface SupplementLog {
  id?: string;
  supplementId: string;
  date: string;
  taken: boolean;
  timestamp?: any;
}

export default function SupplementsPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [supplementLogs, setSupplementLogs] = useState<SupplementLog[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newSupplement, setNewSupplement] = useState({ name: "", amount: "" });

  const displayDate = format(currentDate, "dd/MM/yyyy");
  const dbDate = format(currentDate, "yyyy-MM-dd");

  // Fetch supplements and supplement logs for selected date
  useEffect(() => {
    if (!user) {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setSupplements([]);
        setSupplementLogs([]);
      }, 0);
      return;
    }

    // Listen to user's supplements
    const supplementsQuery = query(
      collection(db, "supplements"),
      where("userId", "==", user.uid)
    );

    const unsubscribeSupplements = onSnapshot(supplementsQuery, (snapshot) => {
      const supplementsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Supplement[];
      setSupplements(supplementsData);
    }, (error) => {
      console.error("Error listening to supplements:", error);
    });

    // Listen to supplement logs for selected date
    const supplementLogsQuery = query(
      collection(db, "supplement_logs"),
      where("userId", "==", user.uid),
      where("date", "==", dbDate)
    );

    const unsubscribeLogs = onSnapshot(supplementLogsQuery, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (SupplementLog & { id: string })[];
      setSupplementLogs(logsData);
    }, (error) => {
      console.error("Error listening to supplement logs:", error);
    });

    return () => {
      unsubscribeSupplements();
      unsubscribeLogs();
    };
  }, [user, dbDate]);

  const handleDateChange = (days: number) => {
    setCurrentDate((prev) => (days > 0 ? addDays(prev, days) : subDays(prev, Math.abs(days))));
  };

  const handleAddSupplement = async () => {
    if (!user || !newSupplement.name.trim() || !newSupplement.amount.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const supplementRef = doc(collection(db, "supplements"));
      await setDoc(supplementRef, {
        name: newSupplement.name.trim(),
        amount: newSupplement.amount.trim(),
        userId: user.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      setNewSupplement({ name: "", amount: "" });
      setIsAddDialogOpen(false);
      toast.success("Supplement added successfully");
    } catch (error) {
      console.error("Error adding supplement:", error);
      toast.error("Failed to add supplement");
    }
  };

  const handleDeleteSupplement = async (supplementId: string) => {
    if (!user) return;

    try {
      await deleteDoc(doc(db, "supplements", supplementId));
      toast.success("Supplement deleted");
    } catch (error) {
      console.error("Error deleting supplement:", error);
      toast.error("Failed to delete supplement");
    }
  };

  const handleToggleTaken = async (supplementId: string, taken: boolean) => {
    if (!user) return;

    const logDocId = `${user.uid}_${supplementId}_${dbDate}`;
    const logRef = doc(db, "supplement_logs", logDocId);

    try {
      if (taken) {
        await setDoc(logRef, {
          userId: user.uid,
          supplementId,
          date: dbDate,
          taken: true,
          timestamp: Timestamp.now(),
        });
      } else {
        await deleteDoc(logRef);
      }
    } catch (error) {
      console.error("Error updating supplement log:", error);
      toast.error("Failed to update supplement status");
    }
  };

  const isSupplementTaken = (supplementId: string): boolean => {
    const log = supplementLogs.find(log => log.supplementId === supplementId);
    return log?.taken || false;
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
          <h1 className="text-lg font-semibold">Supplements</h1>
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
        {/* Supplements Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Pill className="h-5 w-5" />
                My Supplements
              </CardTitle>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Supplement</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="supplement-name">Supplement Name</Label>
                      <Input
                        id="supplement-name"
                        placeholder="e.g., Vitamin D"
                        value={newSupplement.name}
                        onChange={(e) => setNewSupplement({ ...newSupplement, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="supplement-amount">Amount</Label>
                      <Input
                        id="supplement-amount"
                        placeholder="e.g., 1000mg, 1 tablet"
                        value={newSupplement.amount}
                        onChange={(e) => setNewSupplement({ ...newSupplement, amount: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddSupplement}>
                      Add Supplement
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {supplements.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Pill className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No supplements added yet</p>
                <p className="text-sm mt-1">Click "Add" to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {supplements.map((supplement) => {
                  const taken = isSupplementTaken(supplement.id);
                  return (
                    <div
                      key={supplement.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <Checkbox
                          checked={taken}
                          onCheckedChange={(checked) =>
                            handleToggleTaken(supplement.id, checked as boolean)
                          }
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">
                            {supplement.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {supplement.amount}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteSupplement(supplement.id)}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
