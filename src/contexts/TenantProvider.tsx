import React, { createContext, useContext, useEffect, useState } from "react";
import { getTenantSlugFromHostname } from "@/lib/tenant";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthProvider";

export type TenantProfile = {
  educatorId: string;
  tenantSlug: string;
  coachingName?: string;
  tagline?: string;
  contact?: { phone?: string; email?: string; address?: string };
  socials?: Record<string, string | null>;
  websiteConfig?: any;
  testDefaults?: {
    attemptsAllowed?: number;
  };
};

type TenantContextValue = {
  tenant: TenantProfile | null;
  tenantSlug: string | null;
  isTenantDomain: boolean;
  loading: boolean;
};

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [tenant, setTenant] = useState<TenantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTenantDomain, setIsTenantDomain] = useState(false);

  useEffect(() => {
    const slugFromHostname = getTenantSlugFromHostname(window.location.hostname);

    if (slugFromHostname) {
      setTenantSlug(slugFromHostname);
      setIsTenantDomain(true);
      return;
    }

    if (profile?.tenantSlug) {
      setTenantSlug(profile.tenantSlug);
      setIsTenantDomain(false);
      return;
    }

    setTenantSlug(null);
    setIsTenantDomain(false);
  }, [profile?.tenantSlug]);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!tenantSlug) {
        setTenant(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // tenants/{slug} -> educatorId
        const mapSnap = await getDoc(doc(db, "tenants", tenantSlug));
        if (!alive) return;

        if (!mapSnap.exists()) {
          setTenant(null);
          return;
        }

        const map = mapSnap.data() as any;
        const educatorId = String(map?.educatorId || "").trim();
        if (!educatorId) {
          setTenant(null);
          return;
        }

        // educators/{id} -> metadata + website config
        const eduSnap = await getDoc(doc(db, "educators", educatorId));
        if (!alive) return;

        const data: any = eduSnap.exists() ? eduSnap.data() : {};

        const websiteConfig = data?.websiteConfig || {};

        setTenant({
          educatorId,
          tenantSlug,
          coachingName: websiteConfig?.coachingName || data?.coachingName,
          tagline: websiteConfig?.tagline || data?.tagline,
          contact: {
            phone:
              websiteConfig?.contact?.phone ||
              websiteConfig?.socials?.phone ||
              data?.contact?.phone ||
              data?.phone ||
              "",
            email:
              websiteConfig?.contact?.email ||
              websiteConfig?.socials?.email ||
              data?.contact?.email ||
              data?.email ||
              "",
            address:
              websiteConfig?.contact?.address ||
              data?.contact?.address ||
              data?.address ||
              "",
          },
          socials: websiteConfig?.socials || data?.socials,
          websiteConfig,
          testDefaults: data?.testDefaults || {},
        });
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [tenantSlug]);

  return (
    <TenantContext.Provider value={{ tenant, tenantSlug, isTenantDomain, loading }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}

