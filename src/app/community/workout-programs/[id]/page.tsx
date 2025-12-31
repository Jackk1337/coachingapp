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
import { Copy, ChevronLeft, Dumbbell, Heart, FileText, MessageSquare, Reply } from "lucide-react";
import { toast } from "sonner";

interface CommunityWorkoutProgram {
  id: string;
  name: string;
  description?: string;
  difficultyRating?: string;
  routines?: Array<{
    name: string;
    exerciseIds: string[];
    description?: string;
    difficultyRating?: string;
    exerciseNotes?: Record<string, string>;
  }>;
  createdBy: string;
  createdByName?: string;
  createdAt: any;
  likeCount?: number;
  copyCount?: number;
  userLiked?: boolean;
}

interface Exercise {
  id: string;
  name: string;
  category: string;
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

export default function ViewCommunityWorkoutProgramPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const programId = params?.id as string;
  
  const [program, setProgram] = useState<CommunityWorkoutProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [alreadyCopied, setAlreadyCopied] = useState(false);
  const [checkingCopy, setCheckingCopy] = useState(true);
  const [selectedRoutineIndex, setSelectedRoutineIndex] = useState<number | null>(null);
  const [routineExercises, setRoutineExercises] = useState<Exercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    if (!user || !programId) return;

    const fetchProgram = async () => {
      try {
        // Fetch community workout program
        const programDoc = await getDoc(doc(db, "community_workout_programs", programId));
        if (!programDoc.exists()) {
          toast.error("Program not found");
          router.push("/community/workout-programs");
          return;
        }

        const programData = programDoc.data();
        let createdByName = "Unknown User";
        
        // Fetch creator name
        try {
          const userDoc = await getDoc(doc(db, "users", programData.createdBy));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            createdByName = userData.handle || userData.displayName || userData.email || "Unknown User";
          }
        } catch (error) {
          console.error("Error fetching user name:", error);
        }

        // Fetch like count and check if user liked
        let likeCount = programData.likeCount || 0;
        let userLiked = false;
        try {
          const likesSnapshot = await getDocs(collection(db, "community_workout_programs", programDoc.id, "likes"));
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

        // Fetch copy count
        let copyCount = programData.copyCount || 0;
        if (!copyCount) {
          try {
            const copiesSnapshot = await getDocs(collection(db, "community_workout_programs", programDoc.id, "copies"));
            copyCount = copiesSnapshot.size;
          } catch (error) {
            console.error("Error fetching copy count:", error);
          }
        }

        // Check if user already copied
        let alreadyCopiedCheck = false;
        if (user) {
          try {
            const copiesQuery = query(
              collection(db, "community_workout_programs", programDoc.id, "copies"),
              where("userId", "==", user.uid)
            );
            const userCopies = await getDocs(copiesQuery);
            alreadyCopiedCheck = !userCopies.empty;
          } catch (error) {
            console.error("Error checking if user copied:", error);
          }
        }

        setAlreadyCopied(alreadyCopiedCheck);
        setCheckingCopy(false);

        setProgram({
          id: programDoc.id,
          ...programData,
          createdByName,
          likeCount,
          copyCount,
          userLiked,
        } as CommunityWorkoutProgram);
      } catch (error) {
        console.error("Error fetching program:", error);
        toast.error("Failed to load program");
        router.push("/community/workout-programs");
      } finally {
        setLoading(false);
      }
    };

    fetchProgram();
  }, [user, programId, router]);

  // Fetch exercises when a routine is selected
  useEffect(() => {
    if (selectedRoutineIndex === null || !program?.routines) {
      setRoutineExercises([]);
      return;
    }

    const routine = program.routines[selectedRoutineIndex];
    if (!routine || !routine.exerciseIds || routine.exerciseIds.length === 0) {
      setRoutineExercises([]);
      return;
    }

    const fetchExercises = async () => {
      setLoadingExercises(true);
      try {
        const exercises: Exercise[] = [];
        
        // Fetch exercises in batches (Firestore 'in' limit is 10)
        // Note: Since exerciseIds might be from different users, we need to fetch them individually
        // or use a different approach. For now, try fetching by ID.
        for (const exerciseId of routine.exerciseIds) {
          try {
            const exerciseDoc = await getDoc(doc(db, "exercise_library", exerciseId));
            if (exerciseDoc.exists()) {
              exercises.push({ id: exerciseDoc.id, ...exerciseDoc.data() } as Exercise);
            }
          } catch (error) {
            console.error(`Error fetching exercise ${exerciseId}:`, error);
          }
        }

        // Sort exercises to match the order in exerciseIds
        const sortedExercises = routine.exerciseIds
          .map((id) => exercises.find(e => e.id === id))
          .filter((e): e is Exercise => e !== undefined);
        
        setRoutineExercises(sortedExercises);
      } catch (error) {
        console.error("Error fetching exercises:", error);
        toast.error("Failed to load exercises");
        setRoutineExercises([]);
      } finally {
        setLoadingExercises(false);
      }
    };

    fetchExercises();
  }, [selectedRoutineIndex, program]);

  // Fetch comments
  useEffect(() => {
    if (!programId) return;

    const commentsRef = collection(db, "community_workout_programs", programId, "comments");
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
  }, [programId]);

  const handleLikeProgram = async () => {
    if (!user || !program) {
      toast.error("Please log in to like programs");
      return;
    }

    setLiking(true);
    try {
      const likesRef = collection(db, "community_workout_programs", program.id, "likes");
      const userLikeQuery = query(likesRef, where("userId", "==", user.uid));
      const existingLike = await getDocs(userLikeQuery);

      if (!existingLike.empty) {
        // Unlike - delete the like document
        await deleteDoc(existingLike.docs[0].ref);
        // Update like count
        try {
          await updateDoc(doc(db, "community_workout_programs", program.id), {
            likeCount: increment(-1),
          });
        } catch (error) {
          // If likeCount field doesn't exist, that's okay
          console.log("Like count field not found");
        }
        setProgram({ ...program, userLiked: false, likeCount: (program.likeCount || 0) - 1 });
      } else {
        // Like - add the like
        await addDoc(likesRef, {
          userId: user.uid,
          createdAt: Timestamp.now(),
        });
        // Update like count
        try {
          await updateDoc(doc(db, "community_workout_programs", program.id), {
            likeCount: increment(1),
          });
        } catch (error) {
          // If likeCount field doesn't exist, create it
          await updateDoc(doc(db, "community_workout_programs", program.id), {
            likeCount: 1,
          });
        }
        setProgram({ ...program, userLiked: true, likeCount: (program.likeCount || 0) + 1 });
      }
    } catch (error) {
      console.error("Error liking program:", error);
      toast.error("Failed to update like");
    } finally {
      setLiking(false);
    }
  };

  const handlePostComment = async () => {
    if (!user || !program || !commentText.trim()) return;

    setPostingComment(true);
    try {
      await addDoc(collection(db, "community_workout_programs", program.id, "comments"), {
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
    if (!user || !program || !replyText.trim()) return;

    setPostingComment(true);
    try {
      await addDoc(collection(db, "community_workout_programs", program.id, "comments"), {
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

  const handleCopyProgram = async () => {
    if (!user || !program) return;
    
    setCopying(true);
    try {
      // Create new program for the user (independent copy)
      const newProgramRef = await addDoc(collection(db, "workout_programs"), {
        name: program.name,
        description: program.description || null,
        difficultyRating: program.difficultyRating || null,
        userId: user.uid,
        routineIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create routines from the program (independent copies)
      const routineIds: string[] = [];
      if (program.routines && program.routines.length > 0) {
        for (const routine of program.routines) {
          const routineRef = await addDoc(collection(db, "workout_routines"), {
            name: routine.name,
            exerciseIds: routine.exerciseIds || [],
            description: routine.description || null,
            difficultyRating: routine.difficultyRating || null,
            exerciseNotes: routine.exerciseNotes || null,
            userId: user.uid,
            programId: newProgramRef.id,
            createdAt: new Date(),
            copiedFrom: programId,
          });
          routineIds.push(routineRef.id);
        }
      }

      // Update program with routine IDs
      await updateDoc(doc(db, "workout_programs", newProgramRef.id), {
        routineIds: routineIds,
      });

      // Update copy count
      try {
        await updateDoc(doc(db, "community_workout_programs", programId), {
          copyCount: increment(1),
        });
      } catch (error) {
        // If copyCount field doesn't exist, create it
        await updateDoc(doc(db, "community_workout_programs", programId), {
          copyCount: 1,
        });
      }

      // Add to copies subcollection
      await addDoc(collection(db, "community_workout_programs", programId, "copies"), {
        userId: user.uid,
        copiedAt: new Date(),
        programId: newProgramRef.id,
      });

      setAlreadyCopied(true);
      setProgram({ ...program, copyCount: (program.copyCount || 0) + 1 });
      toast.success("Program copied successfully!");
      router.push(`/workout-programs/${newProgramRef.id}`);
    } catch (error) {
      console.error("Error copying program:", error);
      toast.error("Failed to copy program");
    } finally {
      setCopying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading program...</p>
      </div>
    );
  }

  if (!program) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/community/workout-programs">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Program Details</h1>
          <div className="w-10"></div>
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl">{program.name}</CardTitle>
            <CardDescription>By {program.createdByName}</CardDescription>
          </CardHeader>
          <CardContent>
            {program.description && (
              <p className="text-sm text-muted-foreground mb-4">{program.description}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {program.difficultyRating && (
                <Badge variant="secondary">{program.difficultyRating}</Badge>
              )}
              <Badge variant="secondary">
                {program.routines?.length || 0} {program.routines?.length === 1 ? "routine" : "routines"}
              </Badge>
              {program.likeCount !== undefined && program.likeCount > 0 && (
                <Badge variant="outline" className="gap-1">
                  <Heart className="h-3 w-3 fill-red-500 text-red-500" />
                  {program.likeCount} {program.likeCount === 1 ? "like" : "likes"}
                </Badge>
              )}
              {program.copyCount !== undefined && program.copyCount > 0 && (
                <Badge variant="outline" className="gap-1">
                  <Copy className="h-3 w-3" />
                  {program.copyCount} {program.copyCount === 1 ? "copy" : "copies"}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-4">
              <Button
                variant={program.userLiked ? "default" : "outline"}
                size="sm"
                onClick={handleLikeProgram}
                disabled={liking || !user}
                className="flex items-center gap-2"
              >
                <Heart className={`h-4 w-4 ${program.userLiked ? "fill-red-500 text-red-500" : ""}`} />
                {program.userLiked ? "Liked" : "Like"}
              </Button>
              <Button
                onClick={handleCopyProgram}
                disabled={copying || !user || alreadyCopied || checkingCopy}
                variant={alreadyCopied ? "secondary" : "default"}
                className="flex items-center gap-2 flex-1"
                size="sm"
              >
                <Copy className="h-4 w-4" />
                {checkingCopy ? "Checking..." : alreadyCopied ? "Already Copied" : copying ? "Copying..." : "Copy Program"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Routines List */}
        {program.routines && program.routines.length > 0 && (
          <div className="space-y-4 mb-6">
            <h2 className="text-lg font-semibold">Routines</h2>
            {program.routines.map((routine, index) => (
              <Card 
                key={index}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => setSelectedRoutineIndex(index)}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{routine.name}</CardTitle>
                  {routine.description && (
                    <CardDescription>{routine.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary">
                    {routine.exerciseIds?.length || 0} exercises
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

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

      {/* Routine Details Dialog */}
      <Dialog open={selectedRoutineIndex !== null} onOpenChange={(open) => {
        if (!open) {
          setSelectedRoutineIndex(null);
          setRoutineExercises([]);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedRoutineIndex !== null && program?.routines?.[selectedRoutineIndex]?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedRoutineIndex !== null && program?.routines?.[selectedRoutineIndex] && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4">
                {/* Routine Description */}
                {program.routines[selectedRoutineIndex].description && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {program.routines[selectedRoutineIndex].description}
                    </p>
                  </div>
                )}

                {/* Difficulty Rating */}
                {program.routines[selectedRoutineIndex].difficultyRating && (
                  <div>
                    <Badge variant="secondary">
                      {program.routines[selectedRoutineIndex].difficultyRating}
                    </Badge>
                  </div>
                )}

                {/* Exercises List */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Exercises</h3>
                  {loadingExercises ? (
                    <p className="text-sm text-muted-foreground">Loading exercises...</p>
                  ) : routineExercises.length > 0 ? (
                    <ol className="list-decimal list-inside space-y-3">
                      {routineExercises.map((exercise) => {
                        const routine = program.routines?.[selectedRoutineIndex];
                        const exerciseNote = routine?.exerciseNotes?.[exercise.id];
                        
                        return (
                          <li key={exercise.id} className="text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{exercise.name}</span>
                              {exercise.category && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {exercise.category}
                                </Badge>
                              )}
                            </div>
                            {exerciseNote && (
                              <div className="mt-2 ml-6 p-2 bg-muted rounded-md">
                                <div className="flex items-start gap-2">
                                  <FileText className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                                  <p className="text-xs text-muted-foreground">{exerciseNote}</p>
                                </div>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Exercise details are not available. Some exercises may have been removed.
                    </p>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
