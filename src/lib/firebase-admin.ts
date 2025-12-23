import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { validateFirebaseAdminEnv } from './env-validation';

// Validate environment variables at startup (only on server-side)
if (typeof window === 'undefined') {
  try {
    validateFirebaseAdminEnv();
  } catch (error) {
    // In development, log the error but don't crash
    if (process.env.NODE_ENV === 'development') {
      console.warn('Firebase Admin environment validation warning:', error instanceof Error ? error.message : String(error));
    }
  }
}

let app: App | undefined;
let adminAuth: Auth | undefined;
let adminDb: Firestore | undefined;

// Only initialize on server-side
if (typeof window === 'undefined') {
  if (!getApps().length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    if (!privateKey || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PROJECT_ID) {
      throw new Error('Missing Firebase Admin environment variables. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.');
    }

    app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
  } else {
    app = getApps()[0];
  }

  adminAuth = getAuth(app);
  adminDb = getFirestore(app);
}

/**
 * Get the Firestore admin instance (server-side only)
 * Throws an error if called on client-side or if not initialized
 */
export function getAdminDb(): Firestore {
  if (typeof window !== 'undefined') {
    throw new Error('Firebase Admin SDK can only be used server-side');
  }
  if (!adminDb) {
    throw new Error('Firebase Admin SDK not initialized. Check your environment variables.');
  }
  return adminDb;
}

export { adminAuth, adminDb };

