import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { collection, query, where, getDocs, runTransaction, doc } from "firebase/firestore";
import { db } from "./firebase";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Calculate age from date of birth
 * @param dateOfBirth ISO date string (YYYY-MM-DD)
 * @returns Age in years
 */
export function calculateAge(dateOfBirth: string): number {
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Validate handle format (Twitter-like @username)
 * @param handle Handle string (with or without @)
 * @returns Object with isValid and error message
 */
export function validateHandleFormat(handle: string): { isValid: boolean; error?: string } {
  if (!handle || handle.trim() === "") {
    return { isValid: false, error: "Handle is required" };
  }

  // Remove @ if present for validation
  const cleanedHandle = handle.startsWith("@") ? handle.slice(1) : handle;

  // Check length (3-30 characters, typical Twitter limit)
  if (cleanedHandle.length < 3) {
    return { isValid: false, error: "Handle must be at least 3 characters" };
  }
  if (cleanedHandle.length > 30) {
    return { isValid: false, error: "Handle must be 30 characters or less" };
  }

  // Check format: alphanumeric and underscores only
  const handleRegex = /^[a-zA-Z0-9_]+$/;
  if (!handleRegex.test(cleanedHandle)) {
    return { isValid: false, error: "Handle can only contain letters, numbers, and underscores" };
  }

  // Cannot start with underscore or number
  if (cleanedHandle[0] === "_" || /^\d/.test(cleanedHandle)) {
    return { isValid: false, error: "Handle must start with a letter" };
  }

  return { isValid: true };
}

/**
 * Check if handle is unique in Firestore
 * @param handle Handle to check (with or without @)
 * @param currentUserId Current user's ID to exclude from uniqueness check
 * @returns Promise resolving to true if unique, false otherwise
 */
export async function isHandleUnique(handle: string, currentUserId?: string): Promise<boolean> {
  if (!db) return false;

  // Remove @ if present
  const cleanedHandle = handle.startsWith("@") ? handle.slice(1) : handle;
  const normalizedHandle = `@${cleanedHandle}`;

  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("handle", "==", normalizedHandle));
    const querySnapshot = await getDocs(q);

    // If no results, handle is unique
    if (querySnapshot.empty) {
      return true;
    }

    // If checking for current user, allow if it's their own handle
    if (currentUserId) {
      const isOwnHandle = querySnapshot.docs.some(doc => doc.id === currentUserId);
      return isOwnHandle;
    }

    return false;
  } catch (error) {
    console.error("Error checking handle uniqueness:", error);
    return false;
  }
}

/**
 * Normalize handle (ensure it starts with @)
 * @param handle Handle string
 * @returns Normalized handle with @ prefix
 */
export function normalizeHandle(handle: string): string {
  if (!handle) return "";
  return handle.startsWith("@") ? handle : `@${handle}`;
}

/**
 * Set handle for a user atomically using a transaction to ensure uniqueness
 * Uses a "handles" collection with handle as document ID to guarantee uniqueness
 * @param userId User ID
 * @param handle Handle to set (with or without @)
 * @param currentHandle Current handle (if updating, to allow keeping the same handle)
 * @returns Promise that resolves if successful, rejects if handle is taken
 */
export async function setHandleAtomically(
  userId: string, 
  handle: string, 
  currentHandle?: string
): Promise<void> {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  const normalizedHandle = normalizeHandle(handle);
  // Remove @ for use as document ID in handles collection
  const handleId = normalizedHandle.slice(1).toLowerCase(); // Normalize to lowercase for case-insensitive uniqueness

  // If updating and handle hasn't changed, allow it
  if (currentHandle && normalizedHandle.toLowerCase() === currentHandle.toLowerCase()) {
    return;
  }

  // Validate format first
  const validation = validateHandleFormat(handle);
  if (!validation.isValid) {
    throw new Error(validation.error || "Invalid handle format");
  }

  // Pre-check with query for better UX (fast feedback)
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("handle", "==", normalizedHandle));
  const querySnapshot = await getDocs(q);
  const handleTaken = querySnapshot.docs.some(doc => doc.id !== userId);
  
  if (handleTaken) {
    throw new Error("This handle is already taken");
  }

  // Use transaction to atomically set handle using handles collection
  // The handles collection uses handle as document ID, which guarantees uniqueness
  try {
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, "users", userId);
      const handleRef = doc(db, "handles", handleId); // Handle collection uses handle as doc ID
      const currentHandleRef = currentHandle 
        ? doc(db, "handles", currentHandle.slice(1).toLowerCase())
        : null;

      // Check if handle document already exists (another user has it)
      const handleDoc = await transaction.get(handleRef);
      if (handleDoc.exists() && handleDoc.data().userId !== userId) {
        throw new Error("This handle is already taken");
      }

      // Verify user document exists
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) {
        throw new Error("User document not found");
      }

      // Create/update handle document (atomically)
      transaction.set(handleRef, { userId: userId, handle: normalizedHandle }, { merge: true });
      
      // Update user document with handle
      transaction.update(userRef, { handle: normalizedHandle });

      // If updating, remove old handle document
      if (currentHandleRef && currentHandleRef.id !== handleId) {
        transaction.delete(currentHandleRef);
      }
    });
  } catch (error: any) {
    // Re-throw with meaningful message
    if (error.message === "This handle is already taken" || 
        error.message === "Invalid handle format" ||
        error.message === "User document not found") {
      throw error;
    }
    // For other errors (like transaction conflicts), provide a helpful message
    console.error("Error setting handle atomically:", error);
    throw new Error("Failed to set handle. Please try again.");
  }
}
