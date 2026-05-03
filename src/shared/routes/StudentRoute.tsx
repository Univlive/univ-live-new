import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@app/providers/AuthProvider";
import { useTenant } from "@app/providers/TenantProvider";
import { buildTenantUrl } from "@shared/lib/tenant";
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

  // Students must be on tenant domain.
  // If the student is already logged in, redirect them to their tenant URL
  // (e.g. localhost:8080/student?tenant=slug) to avoid a login redirect loop.
  if (!isTenantDomain) {
    if (firebaseUser && profile?.tenantSlug) {
      const full = buildTenantUrl(profile.tenantSlug, location.pathname);
      const url = new URL(full, window.location.href);
      if (url.origin !== window.location.origin) {
        window.location.replace(full);
        return null;
      }
      return <Navigate to={url.pathname + url.search} replace />;
    }
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
