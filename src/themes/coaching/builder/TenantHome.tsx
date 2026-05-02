// src/themes/coaching/builder/TenantHome.tsx
//
// Renders the educator's public landing page using the sections they built
// in the Website Builder (InstituteBuilder.tsx). Reads builderConfig from
// the educators/{uid} Firestore document via TenantProvider.

import { useTenant } from "@/contexts/TenantProvider";
import { useFavicon } from "@/hooks/useFavicon";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";

// ── Re-export the component registry from InstituteBuilder ───────────────────
// The builder stores section data as { id, type, data }[]. We need the same
// component registry to render them on the public page.
//
// Because InstituteBuilder.tsx is a single large file with all components
// defined inline (not exported), we duplicate the minimal rendering logic here.
// The section components are pure presentational — they only need `data`,
// `theme`, `selected=false`, and `onClick=noop`.
//
// We import the full InstituteBuilder module and use a thin wrapper that
// strips the editor chrome and just renders the canvas sections.
// Since the components aren't exported, we inline a lightweight renderer
// that mirrors the same visual output.

import BuilderCanvas from "./BuilderCanvas";

export default function BuilderThemeHome() {
  const { tenant, loading } = useTenant();

  const websiteConfig = tenant?.websiteConfig || {};
  const logoUrl: string | undefined = websiteConfig.logoUrl;
  const coachingName = websiteConfig.coachingName || tenant?.coachingName || "Institute";

  useFavicon(logoUrl, coachingName);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-3" />
        <span className="font-medium">Loading...</span>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Coaching not found</h2>
          <p className="text-muted-foreground mt-2">
            This coaching website does not exist. Check the URL or contact support.
          </p>
        </div>
      </div>
    );
  }

  const builderConfig = tenant.builderConfig;

  if (!builderConfig || !builderConfig.sections || builderConfig.sections.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
        <div style={{ fontSize: 48 }}>🏗️</div>
        <h2 className="text-2xl font-bold">{coachingName}</h2>
        <p className="text-muted-foreground max-w-md">
          This website is being set up. Check back soon!
        </p>
        <Link
          to="/login"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-indigo-600 text-white px-6 py-2.5 text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          Student Login
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Minimal nav with login link */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(0,0,0,0.07)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          height: 52,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={coachingName}
              style={{ height: 32, width: 32, borderRadius: 8, objectFit: "contain" }}
            />
          ) : (
            <div
              style={{
                height: 32,
                width: 32,
                borderRadius: 8,
                background: "#4f46e5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              {coachingName[0]?.toUpperCase() || "I"}
            </div>
          )}
          <span style={{ fontWeight: 700, fontSize: 15, color: "#1a1a2e" }}>{coachingName}</span>
        </div>
        <Link
          to="/login"
          style={{
            background: "#4f46e5",
            color: "#fff",
            borderRadius: 8,
            padding: "6px 16px",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Student Login
        </Link>
      </nav>

      {/* Render the builder sections */}
      <BuilderCanvas
        sections={builderConfig.sections}
        themeKey={builderConfig.themeKey || "indigo"}
      />
    </div>
  );
}
