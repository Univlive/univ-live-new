import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdmin } from "../_lib/firebaseAdmin.js";
import { requireUser } from "../_lib/requireUser.js";

function normSlug(raw: string) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const RESERVED = new Set([
  "www",
  "api",
  "app",
  "admin",
  "assets",
  "static",
  "cdn",
  "support",
  "help",
  "docs",
  "blog",
  "mail",
  "ftp",
  "educator",
  "student",
  "login",
  "signup",
  "terms",
  "privacy",
]);

function validateSlug(slug: string) {
  if (!slug) throw new Error("Please enter a valid subdomain slug.");
  if (slug.length < 3 || slug.length > 40) throw new Error("Subdomain slug must be 3–40 characters.");
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
    throw new Error("Slug can contain only lowercase letters, numbers and hyphens (no leading/trailing hyphen).");
  }
  if (RESERVED.has(slug)) throw new Error("This slug is reserved. Please choose a different one.");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const user = await requireUser(req, { roles: ["EDUCATOR", "ADMIN"] });
    const uid = user.uid;

    const newSlug = normSlug(req.body?.newSlug || req.body?.tenantSlug || "");
    validateSlug(newSlug);

    const admin = getAdmin();
    const db = admin.firestore();
    const FieldValue = admin.firestore.FieldValue;

    const userRef = db.doc(`users/${uid}`);
    const eduRef = db.doc(`educators/${uid}`);

    // Pre-read for friendly errors
    const [userSnap0, eduSnap0] = await Promise.all([userRef.get(), eduRef.get()]);
    const oldSlug0 =
      String(eduSnap0.data()?.tenantSlug || userSnap0.data()?.tenantSlug || user.profile?.tenantSlug || "").trim();

    if (!oldSlug0) return res.status(400).json({ error: "Your account is missing the current tenant slug." });
    if (oldSlug0 === newSlug) return res.json({ ok: true, oldSlug: oldSlug0, newSlug, studentsUpdated: 0 });

    // Authoritative ownership check via tenants registry
    const newTenantRef = db.doc(`tenants/${newSlug}`);
    const newTenantSnap0 = await newTenantRef.get();
    if (newTenantSnap0.exists) {
      const owner = String(newTenantSnap0.data()?.educatorId || "");
      if (owner && owner !== uid) return res.status(409).json({ error: "This subdomain slug is already taken." });
    }

    // Transaction: atomic update for educator + tenant registry
    await db.runTransaction(async (tx) => {
      const [userSnap, eduSnap] = await Promise.all([tx.get(userRef), tx.get(eduRef)]);
      const oldSlug =
        String(eduSnap.data()?.tenantSlug || userSnap.data()?.tenantSlug || user.profile?.tenantSlug || "").trim();

      if (!oldSlug) throw new Error("Your account is missing the current tenant slug.");
      if (oldSlug === newSlug) return;

      // Re-check inside tx (race safety)
      const newTenantSnap = await tx.get(newTenantRef);
      if (newTenantSnap.exists) {
        const owner = String(newTenantSnap.data()?.educatorId || "");
        if (owner && owner !== uid) throw new Error("This subdomain slug is already taken.");
      }

      // Firestore transaction rule: all reads must finish before any writes.
      const oldTenantRef = db.doc(`tenants/${oldSlug}`);
      const oldTenantSnap = await tx.get(oldTenantRef);

      // Ensure new slug mapping exists
      const newTenantPayload: any = {
        educatorId: uid,
        tenantSlug: newSlug,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (!newTenantSnap.exists) newTenantPayload.createdAt = FieldValue.serverTimestamp();
      tx.set(newTenantRef, newTenantPayload, { merge: true });

      // Keep old slug reserved (prevents hijacking; keeps old links working)
      const oldTenantPayload: any = {
        educatorId: uid,
        tenantSlug: oldSlug,
        aliasOf: newSlug,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (!oldTenantSnap.exists) oldTenantPayload.createdAt = FieldValue.serverTimestamp();
      tx.set(oldTenantRef, oldTenantPayload, { merge: true });

      // Update educator + user docs
      tx.set(eduRef, { tenantSlug: newSlug, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.set(userRef, { tenantSlug: newSlug, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });

    // Post-tx: add newSlug to all students so they can login on the NEW subdomain too
    let studentsUpdated = 0;
    const studentsSnap = await db.collection("users").where("educatorId", "==", uid).get();

    let batch = db.batch();
    let ops = 0;

    for (const d of studentsSnap.docs) {
      batch.set(
        d.ref,
        {
          enrolledTenants: FieldValue.arrayUnion(newSlug),
          tenantSlug: newSlug, // keep legacy aligned (optional)
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      studentsUpdated++;
      ops++;

      if (ops >= 450) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();

    return res.json({ ok: true, oldSlug: oldSlug0, newSlug, studentsUpdated });
  } catch (e: any) {
    console.error(e);
    const msg = String(e?.message || "Server error");
    if (msg.toLowerCase().includes("forbidden")) return res.status(403).json({ error: "Forbidden" });
    return res.status(500).json({ error: msg });
  }
}

