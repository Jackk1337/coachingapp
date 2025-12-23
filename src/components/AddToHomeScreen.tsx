"use client";

import { useState, useEffect } from "react";
import { X, Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function AddToHomeScreen() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Detect device type
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const ios = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    const android = /android/i.test(userAgent);

    setIsIOS(ios);
    setIsAndroid(android);

    // Check if user has dismissed the prompt before (stored in localStorage)
    const dismissedBefore = localStorage.getItem("a2hs-dismissed");
    if (dismissedBefore) {
      const dismissedTime = parseInt(dismissedBefore, 10);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      // Show again after 7 days
      if (daysSinceDismissed < 7) {
        setDismissed(true);
        return;
      }
    }

    // Handle Android/Chrome install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Show iOS prompt after a delay (only on iOS)
    if (ios) {
      const timer = setTimeout(() => {
        setShowIOSPrompt(true);
      }, 3000); // Show after 3 seconds
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
        setIsInstalled(true);
      }
    }
  };

  const handleDismiss = () => {
    setShowIOSPrompt(false);
    setDeferredPrompt(null);
    setDismissed(true);
    localStorage.setItem("a2hs-dismissed", Date.now().toString());
  };

  // Don't show if already installed or dismissed
  if (isInstalled || dismissed) {
    return null;
  }

  // Android/Chrome prompt
  if (isAndroid && deferredPrompt) {
    return (
      <Dialog open={true} onOpenChange={handleDismiss}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Install Coaching App
            </DialogTitle>
            <DialogDescription>
              Add Coaching App to your home screen for quick access and a better experience.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button onClick={handleInstallClick} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Install App
            </Button>
            <Button variant="outline" onClick={handleDismiss} className="w-full">
              Maybe Later
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // iOS Safari prompt
  if (isIOS && showIOSPrompt) {
    return (
      <Dialog open={true} onOpenChange={handleDismiss}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share className="h-5 w-5" />
              Add to Home Screen
            </DialogTitle>
            <DialogDescription>
              Install Coaching App on your iPhone or iPad for quick access and a better experience.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">Follow these steps:</p>
              <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                <li>Tap the <Share className="inline h-4 w-4" /> Share button at the bottom of your screen</li>
                <li>Scroll down and tap &quot;Add to Home Screen&quot;</li>
                <li>Tap &quot;Add&quot; to confirm</li>
              </ol>
            </div>
            <Button variant="outline" onClick={handleDismiss} className="w-full">
              Got it, thanks!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}

