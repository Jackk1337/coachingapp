import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { validateFirebaseEnv } from "./env-validation";

// Validate environment variables at startup (only on server-side or client-side runtime)
// Skip validation during build to allow builds without env vars
if (typeof window !== 'undefined' || process.env.NODE_ENV !== 'production') {
  try {
    validateFirebaseEnv();
  } catch (error) {
    // In development, log the error but don't crash
    if (process.env.NODE_ENV === 'development') {
      console.warn('Firebase environment validation warning:', error instanceof Error ? error.message : String(error));
    }
  }
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
// Always initialize to ensure types are correct, using dummy config during build if needed
let app: ReturnType<typeof initializeApp>;
let auth: ReturnType<typeof getAuth>;
let db: ReturnType<typeof getFirestore>;
let googleProvider: GoogleAuthProvider;

const initializeFirebase = () => {
  // Check if we have valid config (not undefined and not dummy)
  const hasValidConfig = firebaseConfig.apiKey && 
                         firebaseConfig.apiKey !== 'dummy-key-for-build' &&
                         firebaseConfig.projectId && 
                         firebaseConfig.projectId !== 'dummy-project' &&
                         firebaseConfig.appId &&
                         firebaseConfig.appId !== '1:123456789:web:dummy';
  
  if (hasValidConfig) {
    // Valid config - initialize normally
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
  } else {
    // Missing or dummy config
    const dummyConfig = {
      apiKey: 'dummy-key-for-build',
      authDomain: 'dummy.firebaseapp.com',
      projectId: 'dummy-project',
      storageBucket: 'dummy-project.appspot.com',
      messagingSenderId: '123456789',
      appId: '1:123456789:web:dummy',
    };
    
    // Only use dummy config during build/SSR (when window is undefined)
    // On client-side, we should have real env vars from Vercel
    if (typeof window === 'undefined') {
      // Build/SSR: use dummy config to allow build to complete
      if (!getApps().length) {
        app = initializeApp(dummyConfig);
      } else {
        app = getApp();
      }
      auth = getAuth(app);
      db = getFirestore(app);
      googleProvider = new GoogleAuthProvider();
    } else {
      // Client-side: try to initialize with whatever config we have
      // If env vars are missing, this will fail but we'll catch it
      try {
        if (!getApps().length) {
          app = initializeApp(firebaseConfig);
        } else {
          app = getApp();
        }
        auth = getAuth(app);
        db = getFirestore(app);
        googleProvider = new GoogleAuthProvider();
      } catch (error) {
        console.error('Firebase initialization failed on client. Please check your environment variables in Vercel:', error);
        // Re-throw the error so it's visible
        throw error;
      }
    }
  }
};

try {
  initializeFirebase();
} catch (error) {
  // Fallback: try with dummy config if initialization fails
  try {
    const dummyConfig = {
      apiKey: 'dummy-key-for-build',
      authDomain: 'dummy.firebaseapp.com',
      projectId: 'dummy-project',
      storageBucket: 'dummy-project.appspot.com',
      messagingSenderId: '123456789',
      appId: '1:123456789:web:dummy',
    };
    if (!getApps().length) {
      app = initializeApp(dummyConfig);
    } else {
      app = getApp();
    }
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
  } catch (dummyError) {
    console.error('Firebase initialization failed completely:', dummyError);
    throw dummyError;
  }
}

export { app, auth, db, googleProvider };

