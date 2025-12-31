"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WorkoutRoutinesRedirectPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace("/workout-programs");
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Redirecting to Workout Programs...</p>
    </div>
  );
}