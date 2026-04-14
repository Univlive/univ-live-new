import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdmin } from "../_lib/firebaseAdmin.js";
import { requireUser } from "../_lib/requireUser.js";

function normSlug(x: string) {
  return String(x || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeDocId(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "string") {
    const value = raw.trim();
    if (!value) return "";
    if (!value.includes("/")) return value;
    const parts = value.split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : "";
  }
  // Handle Firestore DocumentReference if returned by admin SDK
  if (raw && typeof raw === "object" && "id" in raw) {
    return String(raw.id);
  }
  return String(raw || "").trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let stage = "start";
  try {
    stage = "method-check";
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    stage = "auth";
    const user = await requireUser(req, { roles: ["STUDENT"] });
    const uid = user.uid;

    stage = "payload";
    const tenantSlug = normSlug(req.body?.tenantSlug || "");
    if (!tenantSlug) return res.status(400).json({ error: "Missing tenantSlug" });

    console.log(`[register-student] Attempting registration for uid=${uid}, slug=${tenantSlug}`);

    stage = "firebase-admin";
    const admin = getAdmin();
    const db = admin.firestore();

    let educatorId = "";

    stage = "tenant-map-lookup";
    const tenantMap = await db.doc(`tenants/${tenantSlug}`).get();
    if (tenantMap.exists) {
      educatorId = normalizeDocId(tenantMap.data()?.educatorId);
    }

    if (!educatorId) {
      stage = "educator-fallback-query";
      const q = await db.collection("educators").where("tenantSlug", "==", tenantSlug).limit(1).get();
      if (!q.empty) educatorId = q.docs[0].id;
    }

    if (!educatorId) {
      console.warn(`[register-student] Coaching not found for slug=${tenantSlug}`);
      return res.status(404).json({ error: "Coaching not found for this tenantSlug" });
    }

    stage = "write-transaction";
    const userRef = db.doc(`users/${uid}`);
    const learnerRef = db.doc(`educators/${educatorId}/students/${uid}`);

    await db.runTransaction(async (tx) => {
      // FIX: ALL reads must happen before ANY writes in a Firestore transaction.
      // The old code did: read userSnap → write userRef → read learnerSnap → write learnerRef
      // which threw "reads must be executed before all writes".
      // Correct order: read userSnap + read learnerSnap → write userRef + write learnerRef

      const userSnap = await tx.get(userRef);
      const learnerSnap = await tx.get(learnerRef); // ← moved up before any writes

      const userData = userSnap.exists ? userSnap.data() || {} : {};

      const displayName =
        String(userData.displayName || user.decoded?.name || req.body?.displayName || "").trim() || "Student";
      const email = String(userData.email || user.email || user.decoded?.email || req.body?.email || "").trim();

      // --- WRITES (after all reads) ---

      const profilePayload: any = {
        role: "STUDENT",
        displayName,
        email,
        educatorId,
        tenantSlug,
        enrolledTenants: admin.firestore.FieldValue.arrayUnion(tenantSlug),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (!userSnap.exists) profilePayload.createdAt = admin.firestore.FieldValue.serverTimestamp();
      tx.set(userRef, profilePayload, { merge: true });

      const learnerPayload: any = {
        uid,
        name: displayName,
        email,
        status: "ACTIVE",
        tenantSlug,
        lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (!learnerSnap.exists || !learnerSnap.data()?.joinedAt) {
        learnerPayload.joinedAt = admin.firestore.FieldValue.serverTimestamp();
      }
      tx.set(learnerRef, learnerPayload, { merge: true });
    });

    return res.json({ ok: true, educatorId, tenantSlug });
  } catch (e: any) {
    console.error(e);
    const baseMsg = String(e?.message || "Server error");
    const msg = `[register-student:${stage}] ${baseMsg}`;
    if (baseMsg === "Forbidden" || msg.includes("Forbidden")) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (msg.includes("Missing Authorization token") || msg.includes("Token verification failed")) {
      return res.status(401).json({ error: msg });
    }
    return res.status(500).json({ error: msg });
  }
}
