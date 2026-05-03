import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@app/providers/AuthProvider";
import type { UserRole } from "@app/providers/AuthProvider";
import { Loader2 } from "lucide-react";

type Props = {
  allow: UserRole[];
  redirectTo?: string;
  children: React.ReactNode;
};

export default function RequireRole({ allow, redirectTo = "/login", children }: Props) {
  const { firebaseUser, profile, loading } = useAuth();
  const location = useLocation();

  // ✅ CRITICAL: don’t redirect while loading
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (!firebaseUser) {
    return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />;
  }

  const role = String(profile?.role || "STUDENT").toUpperCase() as UserRole;

  // ✅ case-insensitive allow check
  const allowed = allow.map((r) => String(r).toUpperCase());
  if (!allowed.includes(role)) {
    return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
