import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

// Validate Firebase configuration
const getFirebaseConfig = () => {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  // Only validate in client-side or if all values are present
  if (typeof window !== 'undefined' || Object.values(config).every(val => val)) {
    return config;
  }

  // Return a dummy config during build if env vars are missing
  // This prevents build errors, but the app won't work until env vars are set
  return {
    apiKey: 'dummy-key',
    authDomain: 'dummy.firebaseapp.com',
    projectId: 'dummy-project',
    storageBucket: 'dummy-project.appspot.com',
    messagingSenderId: '123456789',
    appId: '1:123456789:web:dummy',
  };
};

// Initialize Firebase only if not already initialized
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let googleProvider: GoogleAuthProvider;

try {
  const firebaseConfig = getFirebaseConfig();
  
  // Only initialize if we have valid config or we're in the browser
  if (typeof window !== 'undefined' || firebaseConfig.apiKey !== 'dummy-key') {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
  } else {
    // During build with missing env vars, create dummy instances
    // These will be replaced when the app runs with proper env vars
    app = {} as FirebaseApp;
    auth = {} as Auth;
    db = {} as Firestore;
    googleProvider = new GoogleAuthProvider();
  }
} catch (error) {
  // If initialization fails during build, create dummy instances
  console.warn('Firebase initialization skipped during build:', error);
  app = {} as FirebaseApp;
  auth = {} as Auth;
  db = {} as Firestore;
  googleProvider = new GoogleAuthProvider();
}

export { app, auth, db, googleProvider };

