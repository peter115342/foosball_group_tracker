'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter, usePathname } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    signInWithGoogle: async () => {},
    logout: async () => {},
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const ratelimitRef = doc(db, 'ratelimits', currentUser.uid);
        try {
          const ratelimitDoc = await getDoc(ratelimitRef);
          if (!ratelimitDoc.exists()) {
            await setDoc(ratelimitRef, {
              groupCount: 0,
              lastGroupCreation: serverTimestamp()
            });
          }
          
          const matchRatelimitRef = doc(db, 'matchRatelimits', currentUser.uid);
          const matchRatelimitDoc = await getDoc(matchRatelimitRef);
          if (!matchRatelimitDoc.exists()) {
            await setDoc(matchRatelimitRef, {
              lastMatchCreation: serverTimestamp()
            });
          }
        } catch (error) {
          console.error("Error initializing rate limits:", error);
        }
      }
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;

    const isAuthPage = pathname === '/';
    const isProtectedPage = pathname.startsWith('/dashboard');

    if (user && isAuthPage) {
      router.push('/dashboard');
    } else if (!user && isProtectedPage) {
      router.push('/');
    }

  }, [user, loading, pathname, router]);

  const signInWithGoogle = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google:", error);
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    signInWithGoogle,
    logout,
  };

  return (
      <AuthContext.Provider value={value}>
          {!loading ? children : <GlobalLoadingSpinner />}
      </AuthContext.Provider>
  );
};

const GlobalLoadingSpinner = () => (
    <div className="flex items-center justify-center min-h-screen">
        <Skeleton className="h-12 w-12 rounded-full" />
    </div>
);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
