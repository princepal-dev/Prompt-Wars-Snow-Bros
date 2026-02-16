import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

// Unified User Type
export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  isAnonymous: boolean; // True if Guest, False if Google
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  loginGoogle: () => Promise<void>;
  loginGuest: (name: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to Firebase Auth (Google)
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || 'Agent',
          photoURL: firebaseUser.photoURL || '',
          isAnonymous: false
        });
      } else {
        // Only set to null if we aren't already in a guest session
        // However, if firebase emits null (logout), we should clear everything
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loginGoogle = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      // State update handled by onAuthStateChanged
    } catch (error) {
      console.error("Google Auth Error", error);
      setLoading(false);
    }
  };

  const loginGuest = (name: string) => {
    // Create a memory-only session. We do NOT use firebase.auth().signInAnonymously() 
    // to avoid cluttering the user base and to strictly follow "memory only" rule.
    const guestId = `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const avatarUrl = `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${guestId}`;
    
    setUser({
      uid: guestId,
      displayName: name || 'Guest Operative',
      photoURL: avatarUrl,
      isAnonymous: true
    });
  };

  const logout = async () => {
    if (user?.isAnonymous) {
      setUser(null);
    } else {
      await firebaseSignOut(auth);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginGoogle, loginGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};