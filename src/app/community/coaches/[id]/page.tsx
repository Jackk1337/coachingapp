"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, addDoc, updateDoc, increment, query, onSnapshot, orderBy, where, getDocs, Timestamp, deleteDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, ChevronLeft, Heart, MessageSquare, Reply, Users } from "lucide-react";
import { toast } from "sonner";

interface CommunityCoach {
  id: string;
  coach_id: string;
  coach_name: string;
  coach_persona: string;
  intensityLevels: {
    Low: string;
    Medium: string;
    High: string;
    Extreme: string;
  };
  createdBy: string;
  createdByName?: string;
  createdAt: any;
  likeCount?: number;
  copyCount?: number;
  userLiked?: boolean;
}

interface Comment {
  id: string;
  userId: string;
  userName?: string;
  userHandle?: string;
  text: string;
  createdAt: any;
  parentId?: string;
  replies?: Comment[];
}

export default function ViewCommunityCoachPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const coachId = params?.id as string;
  
  const [coach, setCoach] = useState<CommunityCoach | null>(null);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [alreadyCopied, setAlreadyCopied] = useState(false);
  const [checkingCopy, setCheckingCopy] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    if (!user || !coachId) return;

    const fetchCoach = async () => {
      try {
        // Fetch community coach
        const coachDoc = await getDoc(doc(db, "community_coaches", coachId));
        if (!coachDoc.exists()) {
          toast.error("Coach not found");
          router.push("/community/coaches");
          return;
        }

        const coachData = coachDoc.data();
        let createdByName = "Unknown User";
        
        // Fetch creator name
        try {
          const userDoc = await getDoc(doc(db, "users", coachData.createdBy));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            createdByName = userData.handle || userData.displayName || userData.email || "Unknown User";
          }
        } catch (error) {
          console.error("Error fetching user name:", error);
        }

        // Fetch like count
        let likeCount = coachData.likeCount || 0;
        if (!likeCount) {
          try {
            const likesSnapshot = await getDocs(collection(db, "community_coaches", coachId, "likes"));
            likeCount = likesSnapshot.size;
          } catch (error) {
            console.error("Error fetching likes:", error);
          }
        }

        // Fetch copy count
        let copyCount = coachData.copyCount || 0;
        if (!copyCount) {
          try {
            const copiesSnapshot = await getDocs(collection(db, "community_coaches", coachId, "copies"));
            copyCount = copiesSnapshot.size;
          } catch (error) {
            console.error("Error fetching copy count:", error);
          }
        }

        // Check if user has liked this coach
        let userLiked = false;
        try {
          const likesRef = collection(db, "community_coaches", coachId, "likes");
          const userLikeQuery = query(likesRef, where("userId", "==", user.uid));
          const existingLike = await getDocs(userLikeQuery);
          userLiked = !existingLike.empty;
        } catch (error) {
          console.error("Error checking like:", error);
        }

        setCoach({
          id: coachDoc.id,
          coach_id: coachDoc.id,
          ...coachData,
          createdByName,
          likeCount,
          copyCount,
          userLiked,
        } as CommunityCoach);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching coach:", error);
        toast.error("Failed to load coach");
        setLoading(false);
      }
    };

    fetchCoach();
  }, [user, coachId, router]);

  // Check if user has already copied this coach
  useEffect(() => {
    const checkIfCopied = async () => {
      if (!user || !coachId) return;

      try {
        const copiesRef = collection(db, "community_coaches", coachId, "copies");
        const userCopyQuery = query(copiesRef, where("userId", "==", user.uid));
        const existingCopy = await getDocs(userCopyQuery);
        setAlreadyCopied(!existingCopy.empty);
      } catch (error) {
        console.error("Error checking copy:", error);
      } finally {
        setCheckingCopy(false);
      }
    };

    checkIfCopied();
  }, [user, coachId]);

  // Fetch comments
  useEffect(() => {
    if (!coachId) return;

    const commentsRef = collection(db, "community_coaches", coachId, "comments");
    const commentsQuery = query(commentsRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(commentsQuery, async (snapshot) => {
      const commentsList: Comment[] = [];
      const commentsMap = new Map<string, Comment>();

      // First pass: create all comments
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        let userName = "Unknown User";
        let userHandle = "unknown";

        try {
          const userDoc = await getDoc(doc(db, "users", data.userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            userHandle = userData.handle || userData.displayName || userData.email || "unknown";
            userName = userData.handle || userData.displayName || userData.email || "Unknown User";
          }
        } catch (error) {
          console.error("Error fetching user name:", error);
        }

        const comment: Comment = {
          id: docSnap.id,
          userId: data.userId,
          userName,
          userHandle,
          text: data.text,
          createdAt: data.createdAt,
          parentId: data.parentId || undefined,
          replies: [],
        };

        commentsMap.set(docSnap.id, comment);
      }

      // Second pass: build tree structure
      commentsMap.forEach((comment) => {
        if (comment.parentId) {
          const parent = commentsMap.get(comment.parentId);
          if (parent) {
            if (!parent.replies) parent.replies = [];
            parent.replies.push(comment);
          } else {
            // Parent not found, treat as top-level
            commentsList.push(comment);
          }
        } else {
          commentsList.push(comment);
        }
      });

      setComments(commentsList);
    }, (error) => {
      console.error("Error fetching comments:", error);
    });

    return unsubscribe;
  }, [coachId]);

  const handleLikeCoach = async () => {
    if (!user || !coach) {
      toast.error("Please log in to like coaches");
      return;
    }

    setLiking(true);
    try {
      const likesRef = collection(db, "community_coaches", coach.id, "likes");
      const userLikeQuery = query(likesRef, where("userId", "==", user.uid));
      const existingLike = await getDocs(userLikeQuery);

      if (!existingLike.empty) {
        // Unlike - delete the like document
        await deleteDoc(existingLike.docs[0].ref);
        // Update like count
        try {
          await updateDoc(doc(db, "community_coaches", coach.id), {
            likeCount: increment(-1),
          });
        } catch (error) {
          console.log("Like count field not found");
        }
        setCoach({ ...coach, userLiked: false, likeCount: (coach.likeCount || 0) - 1 });
      } else {
        // Like - add the like
        await addDoc(likesRef, {
          userId: user.uid,
          createdAt: Timestamp.now(),
        });
        // Update like count
        try {
          await updateDoc(doc(db, "community_coaches", coach.id), {
            likeCount: increment(1),
          });
        } catch (error) {
          await updateDoc(doc(db, "community_coaches", coach.id), {
            likeCount: 1,
          });
        }
        setCoach({ ...coach, userLiked: true, likeCount: (coach.likeCount || 0) + 1 });
      }
    } catch (error) {
      console.error("Error liking coach:", error);
      toast.error("Failed to update like");
    } finally {
      setLiking(false);
    }
  };

  const handlePostComment = async () => {
    if (!user || !coach || !commentText.trim()) return;

    setPostingComment(true);
    try {
      await addDoc(collection(db, "community_coaches", coach.id, "comments"), {
        userId: user.uid,
        text: commentText.trim(),
        createdAt: Timestamp.now(),
      });

      setCommentText("");
      toast.success("Comment posted!");
    } catch (error) {
      console.error("Error posting comment:", error);
      toast.error("Failed to post comment");
    } finally {
      setPostingComment(false);
    }
  };

  const handlePostReply = async (parentId: string) => {
    if (!user || !coach || !replyText.trim()) return;

    setPostingComment(true);
    try {
      await addDoc(collection(db, "community_coaches", coach.id, "comments"), {
        userId: user.uid,
        text: replyText.trim(),
        parentId,
        createdAt: Timestamp.now(),
      });

      setReplyText("");
      setReplyingTo(null);
      toast.success("Reply posted!");
    } catch (error) {
      console.error("Error posting reply:", error);
      toast.error("Failed to post reply");
    } finally {
      setPostingComment(false);
    }
  };

  const handleCopyCoach = async () => {
    if (!user || !coach) {
      toast.error("Please log in to copy coaches");
      return;
    }

    setCopying(true);
    try {
      // Create new coach for the user (independent copy)
      await addDoc(collection(db, "user_coaches"), {
        coach_name: coach.coach_name,
        coach_persona: coach.coach_persona,
        intensityLevels: coach.intensityLevels,
        userId: user.uid,
        verified: false,
        sharedToCommunity: false,
        copiedFrom: coach.id,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // Track copy in subcollection
      await addDoc(collection(db, "community_coaches", coach.id, "copies"), {
        userId: user.uid,
        copiedAt: Timestamp.now(),
      });

      // Update copy count in main document
      try {
        await updateDoc(doc(db, "community_coaches", coach.id), {
          copyCount: increment(1),
        });
      } catch (error) {
        await updateDoc(doc(db, "community_coaches", coach.id), {
          copyCount: 1,
        });
      }

      setAlreadyCopied(true);
      toast.success("Coach copied to your coaches!");
      router.push("/profile");
    } catch (error) {
      console.error("Error copying coach:", error);
      toast.error("Failed to copy coach");
    } finally {
      setCopying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading coach...</p>
      </div>
    );
  }

  if (!coach) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/community/coaches">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Coach Details</h1>
          <div className="w-10"></div>
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Coach Info */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-2xl">{coach.coach_name}</CardTitle>
                <CardDescription className="mt-1">
                  Created by {coach.createdByName}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Persona</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {coach.coach_persona}
              </p>
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-3">Intensity Levels</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">Low</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {coach.intensityLevels.Low || "No custom instruction set."}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">Medium</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {coach.intensityLevels.Medium || "No custom instruction set."}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">High</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {coach.intensityLevels.High || "No custom instruction set."}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">Extreme</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {coach.intensityLevels.Extreme || "No custom instruction set."}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4 border-t">
              <Button
                variant={coach.userLiked ? "default" : "outline"}
                size="sm"
                onClick={handleLikeCoach}
                disabled={liking}
              >
                <Heart className={`h-4 w-4 mr-2 ${coach.userLiked ? "fill-current" : ""}`} />
                {coach.likeCount || 0}
              </Button>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                {coach.copyCount || 0} {coach.copyCount === 1 ? "copy" : "copies"}
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleCopyCoach}
              disabled={copying || alreadyCopied || checkingCopy}
            >
              {checkingCopy ? (
                "Checking..."
              ) : alreadyCopied ? (
                "Already Copied"
              ) : copying ? (
                "Copying..."
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Coach
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Comments Section */}
        <Card>
          <CardHeader>
            <CardTitle>Comments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Post Comment */}
            <div className="space-y-2">
              <Textarea
                placeholder="Add a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={3}
              />
              <Button
                onClick={handlePostComment}
                disabled={!commentText.trim() || postingComment}
                size="sm"
              >
                {postingComment ? "Posting..." : "Post Comment"}
              </Button>
            </div>

            {/* Comments List */}
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No comments yet. Be the first to comment!
              </p>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="space-y-2">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {comment.userName?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold">
                              {comment.userHandle || comment.userName || "Unknown User"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {comment.createdAt?.toDate?.().toLocaleDateString() || "Recently"}
                            </p>
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {comment.text}
                          </p>
                          {user && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-1 h-6 text-xs"
                              onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                            >
                              <Reply className="h-3 w-3 mr-1" />
                              Reply
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Reply Form */}
                      {replyingTo === comment.id && (
                        <div className="ml-11 space-y-2">
                          <Textarea
                            placeholder="Write a reply..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handlePostReply(comment.id)}
                              disabled={!replyText.trim() || postingComment}
                              size="sm"
                            >
                              {postingComment ? "Posting..." : "Post Reply"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setReplyingTo(null);
                                setReplyText("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Replies */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="ml-11 space-y-2 border-l-2 pl-4">
                          {comment.replies.map((reply) => (
                            <div key={reply.id} className="flex items-start gap-3">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {reply.userName?.charAt(0) || "U"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-xs font-semibold">
                                    {reply.userHandle || reply.userName || "Unknown User"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {reply.createdAt?.toDate?.().toLocaleDateString() || "Recently"}
                                  </p>
                                </div>
                                <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                                  {reply.text}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

