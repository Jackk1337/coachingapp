"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, Mail } from "lucide-react";
import { format } from "date-fns";

interface Message {
  id: string;
  userId: string;
  subject: string;
  body: string;
  coach_id: string;
  createdAt: {
    toDate: () => Date;
  };
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const messagesQuery = query(
      collection(db, "messages"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const messageList: Message[] = [];
        snapshot.forEach((doc) => {
          messageList.push({
            id: doc.id,
            ...doc.data(),
          } as Message);
        });
        setMessages(messageList);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching messages:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Show message list view
  if (!selectedMessage) {
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
            <h1 className="text-lg font-semibold">Messages</h1>
            <div className="w-10"></div> {/* Spacer for centering */}
          </div>
        </div>

        {/* Message list */}
        <div className="divide-y">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No messages yet</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                onClick={() => setSelectedMessage(message)}
                className="p-4 cursor-pointer hover:bg-accent/50 active:bg-accent transition-colors border-b"
              >
                <div className="flex flex-col gap-1">
                  <p className="font-semibold text-sm">
                    {message.coach_id}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {message.subject}
                  </p>
                  {message.createdAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(message.createdAt.toDate(), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // Show message detail view
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedMessage(null)}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Message</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </div>

      {/* Message detail */}
      <ScrollArea className="h-[calc(100vh-64px)]">
        <div className="p-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2">
                <CardTitle className="text-lg">{selectedMessage.subject}</CardTitle>
                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                  <p>
                    <span className="font-medium">From:</span> {selectedMessage.coach_id}
                  </p>
                  {selectedMessage.createdAt && (
                    <p>
                      <span className="font-medium">Date:</span>{" "}
                      {format(selectedMessage.createdAt.toDate(), "MMMM d, yyyy 'at' h:mm a")}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {selectedMessage.body}
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
