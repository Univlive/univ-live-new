import React from "react";
import { useTenant } from "@/contexts/TenantProvider";

import Theme1Home from "@/themes/coaching/theme1/TenantHome";
import Theme2Home from "@/themes/coaching/theme2/TenantHome";
import Theme3Home from "@/themes/coaching/theme3/TenantHome";
import BuilderThemeHome from "@/themes/coaching/builder/TenantHome";

export default function TenantHome() {
  const { tenant, loading } = useTenant();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading...
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

  const homepageSource = tenant?.websiteConfig?.homepageSource;
  const hasPublishedBuilder = Boolean(tenant?.builderConfig?.sections?.length) && Boolean((tenant as any)?.builderConfig?.publishedAt);
  if (homepageSource === "builder" || hasPublishedBuilder) {
    return <BuilderThemeHome />;
  }

  const themeId = tenant?.websiteConfig?.themeId || "theme1";

  switch (themeId) {
    case "theme2":
      return <Theme2Home />;
    case "theme3":
      return <Theme3Home />;
    case "theme1":
    default:
      return <Theme1Home />;
  }
}

