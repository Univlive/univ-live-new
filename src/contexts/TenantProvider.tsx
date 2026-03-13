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

  // FIX: Run hostname detection ONCE on mount — hostname never changes.
  // The old single effect had [profile?.tenantSlug] as dependency, which meant
  // isTenantDomain was false during initial render (before profile loads),
  // causing StudentRoute / login redirect guards to misfire.
  useEffect(() => {
    const slugFromHostname = getTenantSlugFromHostname(window.location.hostname);
    if (slugFromHostname) {
      setTenantSlug(slugFromHostname);
      setIsTenantDomain(true);
    }
    // If not a tenant domain, the profile effect below will handle it.
    // If it IS a tenant domain, we never need profile to set the slug.
  }, []); // intentionally empty — hostname is static

  // FIX: Separately track profile-based slug (main domain educator context).
  // Only runs when not already identified as a tenant domain.
  useEffect(() => {
    if (isTenantDomain) return; // hostname already resolved it

    if (profile?.tenantSlug) {
      setTenantSlug(profile.tenantSlug);
    } else {
      setTenantSlug(null);
      // Not a tenant domain and no profile slug — nothing to load, stop loading.
      setLoading(false);
    }
  }, [profile?.tenantSlug, isTenantDomain]);

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

        setTenant({
          educatorId,
          tenantSlug,
          coachingName: data?.coachingName,
          tagline: data?.tagline,
          contact: data?.contact,
          socials: data?.socials,
          websiteConfig: data?.websiteConfig,
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
