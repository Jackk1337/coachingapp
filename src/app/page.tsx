import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dumbbell, Utensils, Activity, CalendarCheck, TrendingUp, User } from "lucide-react";

export default function Home() {
  const menuItems = [
    { name: "Workout Log", href: "/workout-log", icon: Dumbbell },
    { name: "Food Diary", href: "/food-diary", icon: Utensils },
    { name: "Cardio Log", href: "/cardio-log", icon: Activity },
    { name: "Daily Checkin", href: "/daily-checkin", icon: CalendarCheck },
    { name: "Progress", href: "/progress", icon: TrendingUp },
    { name: "Profile", href: "/profile", icon: User },
  ];

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col items-center">
      <header className="w-full max-w-md mb-8 mt-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Coaching App</h1>
        <p className="text-muted-foreground mt-2">Track your fitness journey</p>
      </header>

      <main className="w-full max-w-md grid grid-cols-1 gap-4 sm:grid-cols-2">
        {menuItems.map((item) => (
          <Link key={item.href} href={item.href} className="w-full">
            <Button
              variant="outline"
              className="w-full h-32 flex flex-col items-center justify-center gap-4 text-lg hover:bg-accent"
            >
              <item.icon className="w-8 h-8" />
              {item.name}
            </Button>
          </Link>
        ))}
      </main>
    </div>
  );
}
