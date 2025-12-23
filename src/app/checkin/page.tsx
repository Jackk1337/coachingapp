"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarCheck, Calendar } from "lucide-react";
import { ChevronLeft } from "lucide-react";

export default function CheckinSelectionPage() {
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
          <h1 className="text-lg font-semibold">Checkin</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </div>

      <div className="px-4 py-6 space-y-4">
        <Link href="/daily-checkin" className="block">
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5" />
                Daily Checkin
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Complete your daily checkin to track your weight, steps, sleep, and daily activities.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/weekly-checkin" className="block">
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Weekly Checkin
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Complete your weekly checkin to reflect on your week, review your progress, and plan for next week.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

