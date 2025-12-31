"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function MigrateToProgramsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkMigrationStatus();
  }, [user]);

  const checkMigrationStatus = async () => {
    if (!user) {
      setChecking(false);
      return;
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/migrate-to-programs", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error("Error checking migration status:", error);
      toast.error("Failed to check migration status");
    } finally {
      setChecking(false);
    }
  };

  const runMigration = async () => {
    if (!user) {
      toast.error("Please log in first");
      return;
    }

    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/migrate-to-programs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(`Migration completed! Processed ${data.processed} routines.`);
        setStatus(data);
        // Recheck status
        await checkMigrationStatus();
      } else {
        toast.error(`Migration failed: ${data.error}`);
      }
    } catch (error) {
      console.error("Error running migration:", error);
      toast.error("Failed to run migration");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle>Migration Tool</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Please log in to run the migration.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Migrate to Workout Programs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {checking ? (
            <p className="text-muted-foreground">Checking migration status...</p>
          ) : status ? (
            <>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Has My Program:</span>
                  <span className="text-sm">{status.hasMyProgram ? "Yes" : "No"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Routines without Program:</span>
                  <span className="text-sm">{status.routinesWithoutProgram || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Total Routines:</span>
                  <span className="text-sm">{status.totalRoutines || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Needs Migration:</span>
                  <span className="text-sm font-semibold">
                    {status.needsMigration ? "Yes" : "No"}
                  </span>
                </div>
              </div>

              {status.needsMigration ? (
                <Button
                  onClick={runMigration}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? "Running Migration..." : "Run Migration"}
                </Button>
              ) : (
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-md">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Migration already completed! All routines have been assigned to programs.
                  </p>
                </div>
              )}
            </>
          ) : (
            <Button
              onClick={runMigration}
              disabled={loading}
              className="w-full"
            >
              {loading ? "Running Migration..." : "Run Migration"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

