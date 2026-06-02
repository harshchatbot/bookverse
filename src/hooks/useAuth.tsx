import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, googleProvider, ADMIN_EMAILS, db } from "@/integrations/firebase/client";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function checkAdmin() {
      if (!user) {
        setIsAdmin(false);
        return;
      }
      // 1) hardcoded backup email — always admin
      if (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
        if (!cancelled) setIsAdmin(true);
        return;
      }
      // 2) otherwise check the admins collection
      try {
        const snap = await getDoc(doc(db, "admins", user.uid));
        if (!cancelled) setIsAdmin(snap.exists());
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    }
    void checkAdmin();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signOut = async () => {
    await fbSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
