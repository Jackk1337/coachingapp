"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format, startOfWeek } from "date-fns";

export default function TestCoachingMessagePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [weekStartDate, setWeekStartDate] = useState(() => {
    // Default to current week's Monday
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    return format(weekStart, "yyyy-MM-dd");
  });

  const handleGenerate = async () => {
    if (!user) {
      toast.error("Please log in first");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/generate-coaching-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          weekStartDate,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Coaching message generated! Message ID: ${result.messageId}`);
      } else {
        const error = await response.json();
        console.error('Error:', error);
        toast.error(`Failed: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error calling API:', error);
      toast.error("Failed to generate coaching message.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="pt-6">
            <p>Please log in to test the coaching message generation.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Test AI Coaching Message Generation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="weekStartDate">Week Start Date (Monday)</Label>
            <Input
              id="weekStartDate"
              type="date"
              value={weekStartDate}
              onChange={(e) => setWeekStartDate(e.target.value)}
              required
            />
            <p className="text-sm text-muted-foreground">
              Format: YYYY-MM-DD (e.g., {format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")})
            </p>
          </div>

          <div className="space-y-2">
            <Label>User ID</Label>
            <Input
              value={user.uid}
              readOnly
              className="bg-muted"
            />
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={loading}
            className="w-full"
          >
            {loading ? "Generating..." : "Generate Coaching Message"}
          </Button>

          <div className="mt-4 p-4 bg-muted rounded-md">
            <p className="text-sm font-semibold mb-2">Instructions:</p>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li>Enter the Monday date of the week you want to analyze</li>
              <li>Make sure you have a weekly checkin saved for that week</li>
              <li>Check the Messages page after generation</li>
              <li>Check browser console for any errors</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
