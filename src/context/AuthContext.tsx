"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";
import { auth, googleProvider, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  firstName?: string;
  lastName?: string;
  handle?: string; // Twitter-like @username
  dateOfBirth?: string; // ISO date string
  country?: string;
  timezone?: string;
  gender?: "Male" | "Female";
  onboardingCompleted?: boolean;
  welcomeModalDismissed?: boolean;
  height?: number; // cm
  weight?: number; // kg
  bodyFatPercentage?: number; // optional, for TDEE
  activityLevel?: "Sedentary" | "Lightly Active" | "Moderately Active" | "Very Active" | "Extremely Active";
  coachId?: string;
  experienceLevel?: "Novice" | "Beginner" | "Intermediate" | "Advanced";
  coachIntensity?: "Low" | "Medium" | "High" | "Extreme";
  trialEnds?: any; // Firestore Timestamp
  goals?: {
    goalType: "Lose Weight" | "Gain Strength" | "Gain Weight";
    calorieLimit: number;
    proteinGoal?: number;
    carbGoal?: number;
    fatGoal?: number;
    workoutSessionsPerWeek: number;
    cardioSessionsPerWeek: number;
    startingWeight: number;
    waterGoal?: number; // Daily water goal in liters
  };
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signUpWithGoogle: () => Promise<void>;
  signInWithEmailPassword: (email: string, password: string) => Promise<void>;
  signUpWithEmailPassword: (email: string, password: string, firstName: string, lastName: string, dateOfBirth: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signInWithGoogle: async () => {},
  signUpWithGoogle: async () => {},
  signInWithEmailPassword: async () => {},
  signUpWithEmailPassword: async () => {},
  signOut: async () => {},
  updateProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only run on client-side
    if (typeof window === 'undefined') {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => setLoading(false), 0);
      return;
    }

    // Check if auth is properly initialized (has the onAuthStateChanged method)
    // During build, auth might be initialized with dummy config, but onAuthStateChanged should still exist
    if (!auth || typeof (auth as any).onAuthStateChanged !== 'function') {
      console.error('Firebase auth not properly initialized. Check your environment variables.');
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Fetch user profile from Firestore
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          setProfile(userSnap.data() as UserProfile);
        } else {
          // Create new user profile if it doesn't exist
          const newProfile: UserProfile = {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
          };
          await setDoc(userRef, newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (!auth || !googleProvider) {
      console.error("Firebase not initialized");
      throw new Error("Firebase authentication is not properly initialized. Please check your configuration.");
    }
    if (!db) {
      console.error("Firestore not initialized");
      throw new Error("Firestore is not properly initialized. Please check your configuration.");
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // Check if user exists in Firestore
      const userRef = doc(db, "users", result.user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        // User doesn't exist, sign them out and throw error
        await firebaseSignOut(auth);
        throw new Error("Account not found. Please sign up first.");
      }
    } catch (error: any) {
      console.error("Error signing in with Google", error);
      // Provide more helpful error messages
      if (error?.code === 'auth/internal-error') {
        throw new Error("Authentication service error. Please check your Firebase configuration and try again.");
      }
      throw error; // Re-throw to allow error handling in UI
    }
  };

  const signUpWithGoogle = async () => {
    if (!auth || !googleProvider) {
      console.error("Firebase not initialized");
      throw new Error("Firebase authentication is not properly initialized. Please check your configuration.");
    }
    if (!db) {
      console.error("Firestore not initialized");
      throw new Error("Firestore is not properly initialized. Please check your configuration.");
    }
    
    let authResult: any = null;
    try {
      // Step 1: Authenticate with Google
      console.log("[Google Sign-Up] Starting authentication popup...");
      authResult = await signInWithPopup(auth, googleProvider);
      console.log("[Google Sign-Up] Authentication successful, user ID:", authResult.user.uid);
      const user = authResult.user;
      
      // Step 2: Check if user already exists in Firestore
      try {
        console.log("[Google Sign-Up] Checking Firestore for existing user...");
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          console.log("[Google Sign-Up] User already exists, signing out...");
          // User already exists, sign them out and throw error
          await firebaseSignOut(auth);
          throw new Error("Account already exists. Please sign in instead.");
        }
        
        // Step 3: Extract name from displayName
        const displayName = user.displayName || "";
        const nameParts = displayName.split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        
        // Step 4: Create user profile (onboardingCompleted will be false, user needs to complete onboarding)
        const newProfile: UserProfile = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          firstName: firstName,
          lastName: lastName,
          onboardingCompleted: false,
        };
        
        // Step 5: Save to Firestore
        console.log("[Google Sign-Up] Saving user profile to Firestore...", { uid: newProfile.uid, email: newProfile.email });
        await setDoc(userRef, newProfile);
        console.log("[Google Sign-Up] User profile saved successfully");
        setProfile(newProfile);
      } catch (firestoreError: any) {
        // If Firestore operation fails, sign out the user to clean up
        console.error("[Google Sign-Up] Firestore error:", firestoreError);
        console.error("[Google Sign-Up] Firestore error code:", firestoreError?.code);
        console.error("[Google Sign-Up] Firestore error message:", firestoreError?.message);
        
        if (authResult?.user) {
          try {
            console.log("[Google Sign-Up] Signing out user due to Firestore failure...");
            await firebaseSignOut(auth);
          } catch (signOutError) {
            console.error("[Google Sign-Up] Error signing out after Firestore failure:", signOutError);
          }
        }
        
        // Re-throw Firestore errors with context
        if (firestoreError?.code === 'permission-denied') {
          throw new Error("Permission denied. Please check your Firestore security rules allow users to create their own profile.");
        } else if (firestoreError?.code) {
          throw new Error(`Database error (${firestoreError.code}): ${firestoreError.message || 'Please check your Firestore configuration.'}`);
        }
        throw firestoreError;
      }
    } catch (error: any) {
      console.error("[Google Sign-Up] Error caught:", error);
      console.error("[Google Sign-Up] Error type:", typeof error);
      console.error("[Google Sign-Up] Error code:", error?.code);
      console.error("[Google Sign-Up] Error message:", error?.message);
      console.error("[Google Sign-Up] Error name:", error?.name);
      console.error("[Google Sign-Up] Error stack:", error?.stack);
      
      // Try to stringify the error for more details
      try {
        console.error("[Google Sign-Up] Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      } catch (stringifyError) {
        console.error("[Google Sign-Up] Could not stringify error:", stringifyError);
      }
      
      // Check if it's a Firebase Auth error
      if (error?.code?.startsWith('auth/')) {
        if (error.code === 'auth/internal-error' || error.code === 'auth/network-request-failed') {
          throw new Error("Authentication service error. Please check your Firebase configuration, network connection, and Google OAuth settings.");
        } else if (error.code === 'auth/popup-closed-by-user') {
          throw new Error("Sign-up was cancelled. Please try again.");
        } else if (error.code === 'auth/popup-blocked') {
          throw new Error("Popup was blocked. Please allow popups for this site and try again.");
        } else if (error.code === 'auth/unauthorized-domain') {
          throw new Error("This domain is not authorized for Google sign-in. Please check your Firebase console settings.");
        }
      }
      
      // Check if it's a Firestore error
      if (error?.code === 'permission-denied' || error?.message?.includes('permission-denied')) {
        throw new Error("Permission denied. Please check your Firestore security rules allow users to create their own profile.");
      }
      
      // Re-throw known error messages as-is
      if (error?.message?.includes("Account already exists") || 
          error?.message?.includes("Permission denied") ||
          error?.message?.includes("Database error")) {
        throw error;
      }
      
      // For unknown errors (including those with undefined code), provide generic message with details
      const errorCode = error?.code ? ` (${error.code})` : '';
      const errorMsg = error?.message || 'Unknown error occurred';
      throw new Error(`${errorMsg}${errorCode}. Please check your Firebase configuration, Firestore rules, and try again.`);
    }
  };

  const signInWithEmailPassword = async (email: string, password: string) => {
    if (!auth) {
      console.error("Firebase not initialized");
      throw new Error("Firebase authentication is not properly initialized. Please check your configuration.");
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error("Error signing in with email/password", error);
      // Provide more helpful error messages
      if (error?.code === 'auth/internal-error') {
        throw new Error("Authentication service error. Please check your Firebase configuration and try again.");
      }
      throw error; // Re-throw to allow error handling in UI
    }
  };

  const signUpWithEmailPassword = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    dateOfBirth: string
  ) => {
    if (!auth) {
      console.error("Firebase not initialized");
      throw new Error("Firebase authentication is not properly initialized. Please check your configuration.");
    }
    if (!db) {
      console.error("Firestore not initialized");
      throw new Error("Firestore is not properly initialized. Please check your configuration.");
    }
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const user = result.user;
      
      // Create user profile in Firestore
      const userRef = doc(db, "users", user.uid);
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email,
        displayName: null,
        photoURL: null,
        firstName: firstName,
        lastName: lastName,
        dateOfBirth: dateOfBirth,
        onboardingCompleted: false,
      };
      
      await setDoc(userRef, newProfile);
      setProfile(newProfile);
    } catch (error: any) {
      console.error("Error signing up with email/password", error);
      // Provide more helpful error messages
      if (error?.code === 'auth/internal-error') {
        throw new Error("Authentication service error. Please check your Firebase configuration and try again.");
      }
      throw error; // Re-throw to allow error handling in UI
    }
  };

  const signOut = async () => {
    if (!auth) {
      console.error("Firebase not initialized");
      return;
    }
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user || !db) return;
    const userRef = doc(db, "users", user.uid);
    
    // If updating goals, merge with existing goals to preserve other goal fields
    if (data.goals) {
      const userSnap = await getDoc(userRef);
      const existingData = userSnap.exists() ? userSnap.data() : {};
      const existingGoals = (existingData as UserProfile).goals || {};
      
      // Merge existing goals with new goals (new goals take precedence)
      const mergedGoals = { ...existingGoals, ...data.goals };
      
      // Prepare update data with merged goals
      const updateData = { ...data, goals: mergedGoals };
      
      // Use setDoc with merge to update the document
      await setDoc(userRef, updateData, { merge: true });
      
      // Refetch the profile from Firestore to ensure we have the latest data
      const updatedSnap = await getDoc(userRef);
      if (updatedSnap.exists()) {
        setProfile(updatedSnap.data() as UserProfile);
      }
    } else {
      // For non-nested updates, use setDoc with merge
      await setDoc(userRef, data, { merge: true });
      
      // Refetch the profile from Firestore to ensure we have the latest data
      const updatedSnap = await getDoc(userRef);
      if (updatedSnap.exists()) {
        setProfile(updatedSnap.data() as UserProfile);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      signInWithGoogle, 
      signUpWithGoogle,
      signInWithEmailPassword,
      signUpWithEmailPassword,
      signOut, 
      updateProfile 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

