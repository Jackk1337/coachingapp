"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, updateDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ChevronLeft, Mail } from "lucide-react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  userId: string;
  subject: string;
  body: string;
  coach_id: string;
  coach_name?: string;
  coach_picture?: string;
  read?: boolean;
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
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => setLoading(false), 0);
      return;
    }

    const messagesQuery = query(
      collection(db, "messages"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      async (snapshot) => {
        const messageList: Message[] = [];
        for (const docSnapshot of snapshot.docs) {
          const messageData = docSnapshot.data();
          const message: Message = {
            id: docSnapshot.id,
            ...messageData,
            // Default to unread if read field doesn't exist
            read: messageData.read ?? false,
          } as Message;

          // Fetch coach picture if coach_id exists
          if (message.coach_id && message.coach_id !== 'AI Coach') {
            try {
              const coachRef = doc(db, 'coaches', message.coach_id);
              const coachSnap = await getDoc(coachRef);
              if (coachSnap.exists()) {
                const coachData = coachSnap.data();
                message.coach_picture = coachData.coach_picture;
              }
            } catch (error) {
              console.error('Error fetching coach picture:', error);
            }
          }

          messageList.push(message);
        }
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

  // Mark message as read when opened
  const handleMessageOpen = async (message: Message) => {
    setSelectedMessage(message);
    
    // Mark as read if not already read
    if (!message.read) {
      try {
        const messageRef = doc(db, "messages", message.id);
        await updateDoc(messageRef, { read: true });
      } catch (error) {
        console.error("Error marking message as read:", error);
      }
    }
  };

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
                onClick={() => handleMessageOpen(message)}
                className="p-4 cursor-pointer hover:bg-accent/50 active:bg-accent transition-colors border-b"
              >
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={message.coach_picture} alt={message.coach_name || message.coach_id} />
                      <AvatarFallback>
                        {(message.coach_name || message.coach_id).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {!message.read && (
                      <div className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full border-2 border-background" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-semibold text-sm ${!message.read ? 'font-bold' : ''}`}>
                        {message.coach_name || message.coach_id}
                      </p>
                    </div>
                    <p className={`text-sm truncate ${!message.read ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {message.subject}
                    </p>
                    {message.createdAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(message.createdAt.toDate(), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
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
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={selectedMessage.coach_picture} alt={selectedMessage.coach_name || selectedMessage.coach_id} />
                    <AvatarFallback>
                      {(selectedMessage.coach_name || selectedMessage.coach_id).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-1">
                    <CardTitle className="text-lg">{selectedMessage.subject}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {selectedMessage.coach_name || selectedMessage.coach_id}
                    </p>
                  </div>
                </div>
                {selectedMessage.createdAt && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Date:</span>{" "}
                    {format(selectedMessage.createdAt.toDate(), "MMMM d, yyyy 'at' h:mm a")}
                  </p>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="markdown-content text-sm leading-relaxed">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                    h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-xl font-bold mb-3 mt-5 first:mt-0">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-lg font-semibold mb-2 mt-4 first:mt-0">{children}</h3>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>,
                    li: ({ children }) => <li className="ml-4">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                    code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
                    pre: ({ children }) => <pre className="bg-muted p-4 rounded-lg overflow-x-auto mb-4">{children}</pre>,
                    blockquote: ({ children }) => <blockquote className="border-l-4 border-primary pl-4 italic my-4">{children}</blockquote>,
                    a: ({ href, children }) => <a href={href} className="text-primary underline hover:text-primary/80" target="_blank" rel="noopener noreferrer">{children}</a>,
                  }}
                >
                  {selectedMessage.body}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
