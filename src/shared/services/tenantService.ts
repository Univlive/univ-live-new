import { db } from "@shared/lib/firebase";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

export type TenantStatus = "NOT_CREATED" | "QUEUED" | "IN_PROGRESS" | "LIVE";

export type TenantDoc = {
  tenantSlug: string;
  educatorId: string;
  status?: TenantStatus;
  websiteConfig?: any;
  updatedAt?: any;
  createdAt?: any;
};

export async function getTenantBySlug(tenantSlug: string): Promise<TenantDoc | null> {
  const ref = doc(db, "tenants", tenantSlug);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as TenantDoc;
}

export async function getWebsiteConfig(tenantSlug: string) {
  const t = await getTenantBySlug(tenantSlug);
  return t?.websiteConfig || null;
}

export function subscribeWebsiteConfig(tenantSlug: string, cb: (cfg: any) => void) {
  const ref = doc(db, "tenants", tenantSlug);
  return onSnapshot(ref, (snap) => cb((snap.data() as any)?.websiteConfig || null));
}

export async function updateWebsiteConfig(tenantSlug: string, patch: any) {
  const ref = doc(db, "tenants", tenantSlug);
  await setDoc(
    ref,
    {
      websiteConfig: patch,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function setEducatorWebsiteStatus(educatorId: string, status: TenantStatus) {
  await updateDoc(doc(db, "educators", educatorId), {
    websiteStatus: status,
    updatedAt: serverTimestamp(),
  });
}

export async function setTenantStatus(tenantSlug: string, status: TenantStatus) {
  await setDoc(
    doc(db, "tenants", tenantSlug),
    {
      status,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

