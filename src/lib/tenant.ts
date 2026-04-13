const LOCAL_TENANT_KEY = "univ_local_tenant";

function sanitizeDomain(rawDomain: string): string {
  const cleaned = String(rawDomain || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/^\.+|\.+$/g, "")
    .replace(/^www\./, "");

  return cleaned || "univ.live";
}

export function getConfiguredAppDomain(): string {
  const fromEnv =
    (import.meta.env.VITE_APP_DOMAIN as string | undefined) ||
    (import.meta.env.VITE_APP_BASE_DOMAIN as string | undefined) ||
    "univ.live";
  return sanitizeDomain(fromEnv);
}

function normalizeSlug(value: string | null | undefined): string | null {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;

  // Keep slug format strict to avoid accidental host/query abuse.
  if (!/^[a-z0-9-]+$/.test(raw)) return null;
  return raw;
}

function getTenantFromQuery(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return normalizeSlug(params.get("tenant"));
}

function isPreviewHost(hostname: string): boolean {
  return hostname.endsWith(".vercel.app");
}

function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".lvh.me")
  );
}

function isReservedSubdomain(subdomain: string): boolean {
  const defaults = ["www", "app", "admin", "api", "dev", "staging", "preview"];
  const extra = String(import.meta.env.VITE_RESERVED_SUBDOMAINS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

  const reserved = new Set([...defaults, ...extra]);
  return reserved.has(subdomain);
}

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
  const tenantFromQuery = getTenantFromQuery();

  const appDomain = getConfiguredAppDomain();

  // LOCAL DEV SUPPORT
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    if (tenantFromQuery) {
      persistLocalTenant(tenantFromQuery);
      return tenantFromQuery;
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
  if (hostSuffix !== appDomain) {
    // Vercel preview domains can't use wildcard tenant subdomains by default,
    // so allow explicit ?tenant=slug for dev/staging validation.
    if (isPreviewHost(hostname) && tenantFromQuery) {
      persistLocalTenant(tenantFromQuery);
      return tenantFromQuery;
    }
    return null;
  }

  if (parts.length === domainParts.length) {
    if (tenantFromQuery) {
      persistLocalTenant(tenantFromQuery);
      return tenantFromQuery;
    }
    return null;
  }

  const subdomain = parts[0];
  if (isReservedSubdomain(subdomain)) {
    if (tenantFromQuery) {
      persistLocalTenant(tenantFromQuery);
      return tenantFromQuery;
    }
    return null;
  }

  return normalizeSlug(subdomain);
}

export function buildTenantUrl(tenantSlug: string, path = "/"): string {
  const normalizedSlug = normalizeSlug(tenantSlug);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!normalizedSlug) return normalizedPath;

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname.toLowerCase();
    const protocol = window.location.protocol || "https:";
    const host = window.location.host || hostname;

    if (isLocalHost(hostname) || isPreviewHost(hostname)) {
      const url = new URL(normalizedPath, `${protocol}//${host}`);
      url.searchParams.set("tenant", normalizedSlug);
      return url.toString();
    }
  }

  return `https://${normalizedSlug}.${getConfiguredAppDomain()}${normalizedPath}`;
}

