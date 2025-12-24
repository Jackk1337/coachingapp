"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      // Public routes that don't require authentication
      const publicRoutes = ["/login"];
      
      // Routes that require authentication but not onboarding
      const authOnlyRoutes = ["/onboarding"];

      if (!user) {
        // Not logged in - redirect to login unless already on login page
        if (pathname !== "/login") {
          router.push("/login");
        }
      } else {
        // User is logged in
        const onboardingCompleted = profile?.onboardingCompleted ?? false;

        if (pathname === "/login") {
          // Already logged in, redirect based on onboarding status
          if (onboardingCompleted) {
            router.push("/");
          } else {
            router.push("/onboarding");
          }
        } else if (!onboardingCompleted && pathname !== "/onboarding") {
          // Not completed onboarding - redirect to onboarding
          router.push("/onboarding");
        } else if (onboardingCompleted && pathname === "/onboarding") {
          // Completed onboarding but on onboarding page - redirect to home
          router.push("/");
        }
      }
    }
  }, [user, profile, loading, pathname, router]);

  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center">Loading...</div>;
  }

  // If not logged in and on a protected route, prevent flashing of protected content
  if (!user && pathname !== "/login") {
    return null;
  }

  // If logged in but onboarding not completed and not on onboarding page, prevent flashing
  if (user && !profile?.onboardingCompleted && pathname !== "/onboarding" && pathname !== "/login") {
    return null;
  }

  return <>{children}</>;
}








