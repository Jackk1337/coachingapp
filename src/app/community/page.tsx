"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dumbbell, Trophy, ChevronLeft, Sparkles } from "lucide-react";

export default function CommunityPage() {
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
          <h1 className="text-lg font-semibold">Community</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="space-y-4">
          {/* Community Workout Programs Card */}
          <Link href="/community/workout-programs">
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Dumbbell className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-xl">Community Workout Programs</CardTitle>
                    <CardDescription className="mt-1">
                      Browse and copy workout programs developed by the community
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>

          {/* User Created AI Coaches Card */}
          <Link href="/community/coaches">
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-xl">User Created AI Coaches</CardTitle>
                    <CardDescription className="mt-1">
                      Browse and copy custom AI coaches created by the community
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>

          {/* Leaderboards Card */}
          <Link href="/community/leaderboard">
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Trophy className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-xl">Leaderboards</CardTitle>
                    <CardDescription className="mt-1">
                      View current Personal Records set by the community
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
