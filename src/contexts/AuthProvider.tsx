import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type UserRole = "ADMIN" | "EDUCATOR" | "STUDENT";

export type AppUserProfile = {
  uid: string;
  role: UserRole;
  educatorId?: string;
  tenantSlug?: string;
  enrolledTenants?: string[];
  displayName?: string;
  email?: string;
  photoURL?: string;
  fullName?: string;
};

type AuthContextValue = {
  firebaseUser: User | null;
  profile: AppUserProfile | null;
  loading: boolean;
  uid: string | null;
  role: UserRole | null;
  enrolledTenants: string[];
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadProfile(uid: string): Promise<AppUserProfile | null> {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return null;

  const data: any = userSnap.data() || {};
  const rawRole = String(data.role || "STUDENT").toUpperCase();
  const role: UserRole = rawRole === "ADMIN" || rawRole === "EDUCATOR" ? rawRole : "STUDENT";

  let enrolledTenants: string[] = [];
  if (Array.isArray(data.enrolledTenants)) enrolledTenants = data.enrolledTenants;
  else if (typeof data.tenantSlug === "string") enrolledTenants = [data.tenantSlug];

  const profile: AppUserProfile = {
    uid,
    role,
    educatorId: typeof data.educatorId === "string" ? data.educatorId : undefined,
    tenantSlug: typeof data.tenantSlug === "string" ? data.tenantSlug : undefined,
    enrolledTenants,
    displayName: typeof data.displayName === "string" ? data.displayName : undefined,
    email: typeof data.email === "string" ? data.email : undefined,
  };

  if (role === "EDUCATOR") {
    const educatorRef = doc(db, "educators", uid);
    const educatorSnap = await getDoc(educatorRef);
    if (educatorSnap.exists()) {
      const educatorData = educatorSnap.data();
      profile.displayName = educatorData.displayName || profile.displayName;
      profile.fullName = educatorData.fullName;
      profile.photoURL = educatorData.photoURL;
    }
  }

  return profile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    // Use auth.currentUser directly — the React state (firebaseUser)
    // may still be null right after signIn if onAuthStateChanged hasn't
    // triggered a re-render yet.
    const user = firebaseUser || auth.currentUser;
    if (!user) return;
    setFirebaseUser(user);
    const p = await loadProfile(user.uid);
    setProfile(p);
    setLoading(false);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setLoading(true);
      setFirebaseUser(u);
      setProfile(null);

      if (!u) {
        setLoading(false);
        return;
      }

      try {
        const p = await loadProfile(u.uid);
        setProfile(p);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);


  const value = useMemo<AuthContextValue>(() => {
    return {
      firebaseUser,
      profile,
      loading,
      uid: firebaseUser?.uid ?? null,
      role: profile?.role ?? null,
      enrolledTenants: profile?.enrolledTenants || [],
      refreshProfile,
    };
  }, [firebaseUser, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

