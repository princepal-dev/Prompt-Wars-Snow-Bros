
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDoc, query, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";

/*
  FIRESTORE SECURITY RULES (REQUIRED FOR PUBLIC LEADERBOARD):
  
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /leaderboard/{userId} {
        // Public read access for the leaderboard
        allow read: if true;
        
        // Write access only for authenticated users modifying their own document
        allow create, update: if request.auth != null && request.auth.uid == userId;
        
        // Optional: Add validation to ensure score doesn't decrease or data is valid
      }
    }
  }
*/

// Helper to get env vars compatible with your runtime polyfill AND Vite
const getEnv = (key: string) => {
  // 1. Check runtime injection (index.html or Docker)
  // @ts-ignore
  const runtimeVal = window.process?.env?.[key];
  if (runtimeVal && !runtimeVal.includes("placeholder")) {
    return runtimeVal;
  }
  
  // 2. Check standard Vite env (requires VITE_ prefix in .env files)
  const viteKey = `VITE_${key}`;
  // @ts-ignore
  return (import.meta as any).env?.[viteKey] || (import.meta as any).env?.[key] || "";
};

// Use provided credentials as default fallback
const firebaseConfig = {
  apiKey: getEnv("FIREBASE_API_KEY") || "AIzaSyB1YWwqcnpChBvWUOUmSyJdej1xgri_5aI",
  authDomain: getEnv("FIREBASE_AUTH_DOMAIN") || "snow-bros-2ce15.firebaseapp.com",
  projectId: getEnv("FIREBASE_PROJECT_ID") || "snow-bros-2ce15",
  storageBucket: getEnv("FIREBASE_STORAGE_BUCKET") || "snow-bros-2ce15.firebasestorage.app",
  messagingSenderId: getEnv("FIREBASE_MESSAGING_SENDER_ID") || "628558503749",
  appId: getEnv("FIREBASE_APP_ID") || "1:628558503749:web:e91fa95f93b3adab81282c"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

// --- Leaderboard Service ---

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  photoURL: string;
  highScore: number;
  highestWave: number;
  lastPlayed: any;
}

export const saveScore = async (user: any, score: number, wave: number) => {
  if (!user) return;
  
  // SECURITY: Do not attempt to write if user is guest (memory-only)
  if (user.isAnonymous) {
      console.log("Guest score not saved to DB:", score);
      return; 
  }

  // If config is missing project ID (very rare now), skip
  if (!firebaseConfig.projectId) return;

  const userRef = doc(db, "leaderboard", user.uid);
  
  try {
    // Optimistic check: only write if score is higher
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.highScore >= score) return; // Don't overwrite with lower score
    }

    await setDoc(userRef, {
      uid: user.uid,
      displayName: user.displayName || "Anonymous Snowman",
      photoURL: user.photoURL || "",
      highScore: score,
      highestWave: wave,
      lastPlayed: Timestamp.now()
    }, { merge: true });
    
  } catch (e) {
    console.error("Error saving score:", e);
  }
};

export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  if (!firebaseConfig.projectId) return [];

  try {
    const q = query(
      collection(db, "leaderboard"),
      orderBy("highScore", "desc"),
      limit(10)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as LeaderboardEntry);
  } catch (e) {
    console.error("Error fetching leaderboard:", e);
    return [];
  }
};
