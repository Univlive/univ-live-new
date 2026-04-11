import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthProvider";
import { useTenant } from "@/contexts/TenantProvider";
import { Loader2 } from "lucide-react";

export default function StudentRoute() {
  const { firebaseUser, profile, loading: authLoading } = useAuth();
  const { isTenantDomain, tenantSlug, loading: tenantLoading } = useTenant();
  const location = useLocation();

  // wait for both contexts
  if (authLoading || tenantLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  // Students must be on tenant domain
  if (!isTenantDomain) {
    return <Navigate to="/login?role=student" replace state={{ from: location.pathname }} />;
  }

  if (!firebaseUser) {
    return <Navigate to="/login?role=student" replace state={{ from: location.pathname }} />;
  }

  const role = String(profile?.role || "STUDENT").toUpperCase();
  if (role !== "STUDENT") {
    return <Navigate to="/login?role=student" replace state={{ from: location.pathname }} />;
  }

  // Must be enrolled in this tenant
  const enrolledTenants = Array.isArray(profile?.enrolledTenants)
    ? profile!.enrolledTenants!
    : typeof profile?.tenantSlug === "string"
    ? [profile.tenantSlug]
    : [];

  if (!tenantSlug || !enrolledTenants.includes(tenantSlug)) {
    return <Navigate to="/signup?role=student" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
