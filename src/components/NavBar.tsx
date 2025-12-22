"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export default function NavBar() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isAtTop, setIsAtTop] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  const handleProfileSettings = () => {
    router.push("/profile");
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      setIsAtTop(scrollTop === 0);
    };

    // Check initial scroll position
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fetch unread messages count
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const messagesQuery = query(
      collection(db, "messages"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        let count = 0;
        snapshot.docs.forEach((docSnapshot) => {
          const messageData = docSnapshot.data();
          // Count as unread if read field is false or doesn't exist
          if (!messageData.read) {
            count++;
          }
        });
        setUnreadCount(count);
      },
      (error) => {
        console.error("Error fetching unread messages count:", error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  if (!user || pathname === "/login") {
    return null;
  }

  if (!isAtTop) {
    return null;
  }

  const userInitials = profile?.displayName
    ? profile.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email
    ? user.email[0].toUpperCase()
    : "U";

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          {/* Inbox Icon */}
          <Link href="/messages">
            <Button variant="ghost" size="icon" className="relative">
              <Mail className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </Link>
        </div>

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.photoURL || user.photoURL || undefined} alt={profile?.displayName || user.displayName || "User"} />
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={handleProfileSettings}>
              <User className="mr-2 h-4 w-4" />
              Profile Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
