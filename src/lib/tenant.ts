const LOCAL_TENANT_KEY = "univ_local_tenant";

export function getPersistedLocalTenant(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(LOCAL_TENANT_KEY);
}

export function persistLocalTenant(slug: string | null) {
  if (typeof window === "undefined") return;
  if (slug) {
    sessionStorage.setItem(LOCAL_TENANT_KEY, slug);
  } else {
    sessionStorage.removeItem(LOCAL_TENANT_KEY);
  }
}

export function getTenantSlugFromHostname(hostnameArg?: string): string | null {
  const hostname =
    (hostnameArg || (typeof window !== "undefined" ? window.location.hostname : "")).toLowerCase();

  const appDomain = (import.meta.env.VITE_APP_DOMAIN || "univ.live").toLowerCase();

  // LOCAL DEV SUPPORT
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const tenantParam = params.get("tenant");
    if (tenantParam) {
       persistLocalTenant(tenantParam);
       return tenantParam;
    }
    return getPersistedLocalTenant();
  }

  // Support for wildcard localhost subdomains (e.g. coaching.localhost or coaching.lvh.me)
  if (hostname.endsWith(".localhost")) {
    return hostname.replace(".localhost", "");
  }
  if (hostname.endsWith(".lvh.me")) {
    return hostname.replace(".lvh.me", "");
  }

  const parts = hostname.split(".");
  const domainParts = appDomain.split(".");

  const hostSuffix = parts.slice(-domainParts.length).join(".");
  if (hostSuffix !== appDomain) return null;

  if (parts.length === domainParts.length) return null;

  const subdomain = parts[0];
  if (subdomain === "www") return null;

  return subdomain;
}

