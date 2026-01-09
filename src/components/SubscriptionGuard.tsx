"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const [subscriptionActive, setSubscriptionActive] = useState<boolean | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(true);

  useEffect(() => {
    const checkSubscription = async () => {
      if (loading || !user || !profile) {
        setCheckingSubscription(true);
        return;
      }

      try {
        // Query the subscriptions subcollection for this user
        const subscriptionsRef = collection(db, "users", user.uid, "subscriptions");
        const subscriptionsSnapshot = await getDocs(subscriptionsRef);

        // Check if any subscription has status === "active"
        let hasActiveSubscription = false;
        
        if (subscriptionsSnapshot.empty) {
          // No subscriptions found
          hasActiveSubscription = false;
        } else {
          subscriptionsSnapshot.forEach((doc) => {
            const subscriptionData = doc.data();
            // Check if the status field is "active"
            if (subscriptionData.status === "active") {
              hasActiveSubscription = true;
            }
          });
        }

        setSubscriptionActive(hasActiveSubscription);
      } catch (error) {
        console.error("Error checking subscription status:", error);
        // On error, block access (fail closed for security)
        setSubscriptionActive(false);
      } finally {
        setCheckingSubscription(false);
      }
    };

    checkSubscription();
  }, [user, profile, loading]);

  // Show loading state while checking subscription
  if (checkingSubscription || loading) {
    return <>{children}</>;
  }

  // If subscription is not active (or null/undefined), block all app usage
  if (subscriptionActive !== true) {
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
              <DialogTitle>You're not subscribed!</DialogTitle>
              <DialogDescription>
                Please subscribe to continue using RallyFit and unlock all features.
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

  // Subscription is active, allow normal access
  return <>{children}</>;
}

