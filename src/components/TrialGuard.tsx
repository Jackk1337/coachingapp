"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function TrialGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  const [trialExpired, setTrialExpired] = useState(false);

  useEffect(() => {
    if (loading || !profile) {
      return;
    }

    // Check if user has a trialEnds field
    if (!profile.trialEnds) {
      // No trial set, allow access (for users without trials)
      setTrialExpired(false);
      return;
    }

    // Convert Firestore Timestamp to Date
    let trialEndDate: Date;
    if (profile.trialEnds?.toDate) {
      // Firestore Timestamp object
      trialEndDate = profile.trialEnds.toDate();
    } else if (profile.trialEnds?.seconds) {
      // Firestore Timestamp with seconds property
      trialEndDate = new Date(profile.trialEnds.seconds * 1000);
    } else if (typeof profile.trialEnds === 'string') {
      // ISO string
      trialEndDate = new Date(profile.trialEnds);
    } else if (profile.trialEnds instanceof Date) {
      // Already a Date object
      trialEndDate = profile.trialEnds;
    } else {
      // Unknown format, allow access
      console.warn("Unknown trialEnds format:", profile.trialEnds);
      setTrialExpired(false);
      return;
    }

    // Check if trial has expired
    const now = new Date();
    if (trialEndDate < now) {
      setTrialExpired(true);
    } else {
      setTrialExpired(false);
    }
  }, [profile, loading]);

  // If trial is expired, block all app usage
  if (trialExpired) {
    return (
      <>
        {/* Render children but make them non-interactive and visually disabled */}
        <div className="pointer-events-none opacity-30 select-none">
          {children}
        </div>
        {/* Modal dialog that blocks all interaction */}
        <Dialog open={true} modal={true}>
          <DialogContent 
            className="sm:max-w-md z-[100]"
            showCloseButton={false}
            onInteractOutside={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onEscapeKeyDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <DialogHeader>
              <DialogTitle>Trial Expired</DialogTitle>
              <DialogDescription>
                Your 2-week trial has ended. Subscribe to continue using RallyFit and unlock all features.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center">
              <Button
                onClick={() => {
                  window.location.href = "https://rallyfitapp.com/#pricing";
                }}
                className="w-full sm:w-auto"
              >
                View Pricing & Subscribe
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Trial is active or no trial set, allow normal access
  return <>{children}</>;
}

