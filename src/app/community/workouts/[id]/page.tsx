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
import { Copy, ChevronLeft, Dumbbell, Heart, MessageSquare, Reply } from "lucide-react";
import { toast } from "sonner";

interface Exercise {
  id: string;
  name: string;
  category: string;
}

interface CommunityWorkout {
  id: string;
  name: string;
  exerciseIds: string[];
  createdBy: string;
  createdByName?: string;
  createdAt: any;
  description?: string;
  difficultyRating?: string;
  exerciseNotes?: Record<string, string>;
  likeCount?: number;
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

export default function ViewCommunityWorkoutPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const workoutId = params?.id as string;
  
  const [workout, setWorkout] = useState<CommunityWorkout | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [liking, setLiking] = useState(false);
  const [alreadyCopied, setAlreadyCopied] = useState(false);
  const [checkingCopy, setCheckingCopy] = useState(true);

  useEffect(() => {
    if (!user || !workoutId) return;

    const fetchWorkout = async () => {
      try {
        // Fetch community workout
        const workoutDoc = await getDoc(doc(db, "community_workouts", workoutId));
        if (!workoutDoc.exists()) {
          toast.error("Workout not found");
          router.push("/community/workouts");
          return;
        }

        const workoutData = workoutDoc.data();
        let createdByName = "Unknown User";
        
        // Fetch creator name
        try {
          const userDoc = await getDoc(doc(db, "users", workoutData.createdBy));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            createdByName = userData.handle || userData.displayName || userData.email || "Unknown User";
          }
        } catch (error) {
          console.error("Error fetching user name:", error);
        }

        // Fetch likes
        let likeCount = 0;
        let userLiked = false;
        try {
          const likesSnapshot = await getDocs(collection(db, "community_workouts", workoutDoc.id, "likes"));
          likeCount = likesSnapshot.size;
          
          if (user) {
            likesSnapshot.forEach((likeDoc) => {
              const likeData = likeDoc.data();
              if (likeData.userId === user.uid) {
                userLiked = true;
              }
            });
          }
        } catch (error) {
          console.error("Error fetching likes:", error);
        }

        setWorkout({
          id: workoutDoc.id,
          ...workoutData,
          createdByName,
          likeCount,
          userLiked,
        } as CommunityWorkout);

        // Fetch exercises - try to get each exercise by ID
        // Exercises might be from different users (including rallyfit)
        if (workoutData.exerciseIds && workoutData.exerciseIds.length > 0) {
          const exercisePromises = workoutData.exerciseIds.map(async (exerciseId: string) => {
            try {
              // Try to get exercise directly by ID
              const exerciseDoc = await getDoc(doc(db, "exercise_library", exerciseId));
              if (exerciseDoc.exists()) {
                return {
                  id: exerciseDoc.id,
                  ...exerciseDoc.data(),
                } as Exercise;
              }
              return null;
            } catch (error) {
              console.error(`Error fetching exercise ${exerciseId}:`, error);
              return null;
            }
          });

          const exerciseResults = await Promise.all(exercisePromises);
          const validExercises = exerciseResults.filter((e): e is Exercise => e !== null);
          
          // Sort exercises to match the order in exerciseIds
          const sortedExercises = workoutData.exerciseIds
            .map((id: string) => validExercises.find(e => e.id === id))
            .filter((e: Exercise | undefined): e is Exercise => e !== undefined);
          
          setExercises(sortedExercises);
        }
      } catch (error) {
        console.error("Error fetching workout:", error);
        toast.error("Failed to load workout");
        router.push("/community/workouts");
      } finally {
        setLoading(false);
      }
    };

    fetchWorkout();
  }, [user, workoutId, router]);

  // Check if workout is already copied
  useEffect(() => {
    if (!user || !workoutId) {
      setCheckingCopy(false);
      return;
    }

    const checkIfCopied = async () => {
      try {
        const routinesRef = collection(db, "workout_routines");
        const copiedQuery = query(
          routinesRef,
          where("userId", "==", user.uid),
          where("copiedFrom", "==", workoutId)
        );
        const snapshot = await getDocs(copiedQuery);
        setAlreadyCopied(!snapshot.empty);
      } catch (error) {
        console.error("Error checking if workout is copied:", error);
        setAlreadyCopied(false);
      } finally {
        setCheckingCopy(false);
      }
    };

    checkIfCopied();
  }, [user, workoutId]);

  // Fetch comments
  useEffect(() => {
    if (!workoutId) return;

    const commentsRef = collection(db, "community_workouts", workoutId, "comments");
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
  }, [workoutId]);

  const handleLikeWorkout = async () => {
    if (!user || !workout) {
      toast.error("Please log in to like workouts");
      return;
    }

    setLiking(true);
    try {
      const likesRef = collection(db, "community_workouts", workout.id, "likes");
      const userLikeQuery = query(likesRef, where("userId", "==", user.uid));
      const existingLike = await getDocs(userLikeQuery);

      if (!existingLike.empty) {
        // Unlike - delete the like document
        await deleteDoc(existingLike.docs[0].ref);
        // Update like count
        try {
          await updateDoc(doc(db, "community_workouts", workout.id), {
            likeCount: increment(-1),
          });
        } catch (error) {
          // If likeCount field doesn't exist, that's okay
          console.log("Like count field not found");
        }
        setWorkout({ ...workout, userLiked: false, likeCount: (workout.likeCount || 0) - 1 });
      } else {
        // Like - add the like
        await addDoc(likesRef, {
          userId: user.uid,
          createdAt: Timestamp.now(),
        });
        // Update like count
        try {
          await updateDoc(doc(db, "community_workouts", workout.id), {
            likeCount: increment(1),
          });
        } catch (error) {
          // If likeCount field doesn't exist, create it
          await updateDoc(doc(db, "community_workouts", workout.id), {
            likeCount: 1,
          });
        }
        setWorkout({ ...workout, userLiked: true, likeCount: (workout.likeCount || 0) + 1 });
      }
    } catch (error) {
      console.error("Error liking workout:", error);
      toast.error("Failed to update like");
    } finally {
      setLiking(false);
    }
  };

  const handlePostComment = async () => {
    if (!user || !workout || !commentText.trim()) return;

    setPostingComment(true);
    try {
      await addDoc(collection(db, "community_workouts", workout.id, "comments"), {
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
    if (!user || !workout || !replyText.trim()) return;

    setPostingComment(true);
    try {
      await addDoc(collection(db, "community_workouts", workout.id, "comments"), {
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

  const handleCopyWorkout = async () => {
    if (!user || !workout) {
      toast.error("Please log in to copy workouts");
      return;
    }

    setCopying(true);
    try {
      // Copy workout to user's workout_routines
      await addDoc(collection(db, "workout_routines"), {
        name: workout.name,
        exerciseIds: workout.exerciseIds,
        description: workout.description || null,
        difficultyRating: workout.difficultyRating || null,
        exerciseNotes: workout.exerciseNotes || null,
        userId: user.uid,
        createdAt: new Date(),
        copiedFrom: workout.id,
      });

      // Track copy in subcollection
      await addDoc(collection(db, "community_workouts", workout.id, "copies"), {
        userId: user.uid,
        copiedAt: new Date(),
      });

      // Update copy count in main document for better performance
      try {
        await updateDoc(doc(db, "community_workouts", workout.id), {
          copyCount: increment(1),
        });
      } catch (error) {
        // If copyCount field doesn't exist, that's okay
        console.log("Copy count field not found");
      }

      setAlreadyCopied(true);
      toast.success("Workout copied to your routines!");
      router.push("/workout-routines");
    } catch (error) {
      console.error("Error copying workout:", error);
      toast.error("Failed to copy workout");
    } finally {
      setCopying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading workout...</p>
      </div>
    );
  }

  if (!workout) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/community/workouts">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Workout Details</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="space-y-6">
          {/* Workout Header */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-2xl mb-2">{workout.name}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {workout.createdByName?.replace(/^@+/, "").charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span>by {workout.createdByName}</span>
                  </CardDescription>
                  {workout.description && (
                    <p className="text-sm text-muted-foreground mt-3">
                      {workout.description}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-sm">
                    <Dumbbell className="h-3 w-3 mr-1" />
                    {workout.exerciseIds.length} {workout.exerciseIds.length === 1 ? "exercise" : "exercises"}
                  </Badge>
                  {workout.difficultyRating && (
                    <Badge variant="outline" className="text-sm">
                      Difficulty: {workout.difficultyRating}
                    </Badge>
                  )}
                  {workout.likeCount !== undefined && workout.likeCount > 0 && (
                    <Badge variant="outline" className="text-sm gap-1">
                      <Heart className="h-3 w-3 fill-red-500 text-red-500" />
                      {workout.likeCount} {workout.likeCount === 1 ? "like" : "likes"}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant={workout.userLiked ? "default" : "outline"}
                    size="sm"
                    onClick={handleLikeWorkout}
                    disabled={liking || !user}
                    className="flex items-center gap-2"
                  >
                    <Heart className={`h-4 w-4 ${workout.userLiked ? "fill-red-500 text-red-500" : ""}`} />
                    {workout.userLiked ? "Liked" : "Like"}
                  </Button>
                  <Button
                    onClick={handleCopyWorkout}
                    disabled={copying || !user || alreadyCopied}
                    variant={alreadyCopied ? "secondary" : "default"}
                    className="flex items-center gap-2 flex-1"
                    size="sm"
                  >
                    <Copy className="h-4 w-4" />
                    {checkingCopy ? "Checking..." : alreadyCopied ? "Already in your library" : copying ? "Copying..." : "Copy to My Routines"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Exercises List */}
          <Card>
            <CardHeader>
              <CardTitle>Exercises</CardTitle>
            </CardHeader>
            <CardContent>
              {exercises.length > 0 ? (
                <ol className="list-decimal list-inside space-y-3">
                  {exercises.map((exercise, index) => (
                    <li key={exercise.id} className="text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{exercise.name}</span>
                        {exercise.category && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {exercise.category}
                          </Badge>
                        )}
                      </div>
                      {workout.exerciseNotes && workout.exerciseNotes[exercise.id] && (
                        <p className="text-xs text-muted-foreground mt-1 ml-6">
                          {workout.exerciseNotes[exercise.id]}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Exercise details are not available. Some exercises may have been removed.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Comments Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Comments ({comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Comment Input */}
              {user && (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Add a comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <Button
                    onClick={handlePostComment}
                    disabled={!commentText.trim() || postingComment}
                    size="sm"
                  >
                    {postingComment ? "Posting..." : "Post Comment"}
                  </Button>
                </div>
              )}

              {/* Comments List */}
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="space-y-2">
                    <div className="flex gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {comment.userHandle?.replace(/^@+/, "").charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">
                            {comment.userHandle?.startsWith("@") ? comment.userHandle : `@${comment.userHandle}`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {comment.createdAt?.toDate?.()?.toLocaleDateString() || ""}
                          </span>
                        </div>
                        <p className="text-sm">{comment.text}</p>
                        {user && (
                          <button
                            onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                            className="text-xs text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1"
                          >
                            <Reply className="h-3 w-3" />
                            Reply
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Reply Input */}
                    {replyingTo === comment.id && user && (
                      <div className="ml-10 space-y-2">
                        <Textarea
                          placeholder="Write a reply..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="min-h-[60px]"
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
                      <div className="ml-10 space-y-2 mt-2">
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="flex gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {reply.userHandle?.replace(/^@+/, "").charAt(0) || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-xs">
                                  {reply.userHandle?.startsWith("@") ? reply.userHandle : `@${reply.userHandle}`}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {reply.createdAt?.toDate?.()?.toLocaleDateString() || ""}
                                </span>
                              </div>
                              <p className="text-xs">{reply.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {comments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No comments yet. Be the first to comment!
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

