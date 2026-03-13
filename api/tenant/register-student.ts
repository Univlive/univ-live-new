import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdmin } from "../_lib/firebaseAdmin.js";
import { requireUser } from "../_lib/requireUser.js";


function normSlug(x: string) {
  return String(x || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const user = await requireUser(req, { roles: ["STUDENT"] });
    const uid = user.uid;

    const tenantSlug = normSlug(req.body?.tenantSlug || "");
    if (!tenantSlug) return res.status(400).json({ error: "Missing tenantSlug" });

    const admin = getAdmin();
    const db = admin.firestore();

    let educatorId = "";

    const tenantMap = await db.doc(`tenants/${tenantSlug}`).get();
    if (tenantMap.exists) educatorId = String(tenantMap.data()?.educatorId || "");

    if (!educatorId) {
      const q = await db.collection("educators").where("tenantSlug", "==", tenantSlug).limit(1).get();
      if (!q.empty) educatorId = q.docs[0].id;
    }

    if (!educatorId) return res.status(404).json({ error: "Coaching not found for this tenantSlug" });

    const userRef = db.doc(`users/${uid}`);
    const learnerRef = db.doc(`educators/${educatorId}/students/${uid}`);

    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const userData = userSnap.exists ? userSnap.data() || {} : {};

      const displayName =
        String(userData.displayName || user.decoded?.name || req.body?.displayName || "").trim() || "Student";
      const email = String(userData.email || user.email || user.decoded?.email || req.body?.email || "").trim();

      const profilePayload: any = {
        role: "STUDENT",
        displayName,
        email,
        educatorId,
        tenantSlug, // legacy
        enrolledTenants: admin.firestore.FieldValue.arrayUnion(tenantSlug),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (!userSnap.exists) profilePayload.createdAt = admin.firestore.FieldValue.serverTimestamp();
      tx.set(userRef, profilePayload, { merge: true });

      const learnerSnap = await tx.get(learnerRef);
      const learnerPayload: any = {
        uid,
        name: displayName,
        email,
        status: "ACTIVE",
        tenantSlug,
        lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (!learnerSnap.exists) learnerPayload.joinedAt = admin.firestore.FieldValue.serverTimestamp();
      tx.set(learnerRef, learnerPayload, { merge: true });
    });

    return res.json({ ok: true, educatorId, tenantSlug });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}

