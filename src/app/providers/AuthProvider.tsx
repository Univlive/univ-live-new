import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@shared/lib/firebase";
import { impAuth } from "@shared/lib/firebase-impersonation";
import { getLocalSessionId, clearLocalSessionId } from "@shared/lib/session";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
  currentSessionId?: string;
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
  if (!uid) return null;
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
    currentSessionId: typeof data.currentSessionId === "string" ? data.currentSessionId : undefined,
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
  const queryClient = useQueryClient();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(() => !!sessionStorage.getItem("imp_session"));

  // Listen for impersonation session changes dispatched by Impersonate.tsx and ImpersonationBanner
  useEffect(() => {
    const handler = () => setIsImpersonating(!!sessionStorage.getItem("imp_session"));
    window.addEventListener("imp_session_changed", handler);
    return () => window.removeEventListener("imp_session_changed", handler);
  }, []);

  // Subscribe to the correct auth instance based on impersonation state
  useEffect(() => {
    const activeAuth = isImpersonating ? impAuth : auth;
    const unsubAuth = onAuthStateChanged(activeAuth, (u) => {
      setFirebaseUser(u);
      setAuthLoading(false);
      if (u) {
        queryClient.invalidateQueries({ queryKey: ["userProfile", u.uid] });
      } else {
        queryClient.removeQueries({ queryKey: ["userProfile"] });
      }
    });

    return () => unsubAuth();
  }, [queryClient, isImpersonating]);

  const { data: profile = null, isLoading: profileLoading, refetch } = useQuery({
    queryKey: ["userProfile", firebaseUser?.uid],
    queryFn: () => loadProfile(firebaseUser!.uid),
    enabled: !!firebaseUser?.uid,
    staleTime: 60 * 1000,
  });

  const refreshProfile = async () => {
    await refetch();
  };

  // Session enforcement for students — skip during impersonation
  useEffect(() => {
    if (!firebaseUser || !profile || profile.role !== "STUDENT" || isImpersonating) return;

    const userRef = doc(db, "users", firebaseUser.uid);
    const unsubSnap = onSnapshot(userRef, (doc) => {
      if (!doc.exists()) return;
      const data = doc.data();
      const firestoreSid = data.currentSessionId;
      const localSid = getLocalSessionId();

      if (firestoreSid && localSid && firestoreSid !== localSid) {
        toast.error("You have been logged out because you logged in from another device.");
        clearLocalSessionId();
        signOut(auth);
      }
    });

    return () => unsubSnap();
  }, [firebaseUser, profile, isImpersonating]);


  const value = useMemo<AuthContextValue>(() => {
    return {
      firebaseUser,
      profile,
      loading: authLoading || (!!firebaseUser && profileLoading),
      uid: firebaseUser?.uid ?? null,
      role: profile?.role ?? null,
      enrolledTenants: profile?.enrolledTenants || [],
      refreshProfile,
    };
  }, [firebaseUser, profile, authLoading, profileLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
