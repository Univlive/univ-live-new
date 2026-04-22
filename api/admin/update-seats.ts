import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdmin } from "../_lib/firebaseAdmin.js";
import { requireUser } from "../_lib/requireUser.js";
import { notifyDiscord } from "../_lib/discordLogger.js";

/**
 * Admin-only: Set/override an educator's total seat limit.
 * - Updates educators/{educatorId}.seatLimit + lastSeatTransaction*
 * - Appends educators/{educatorId}/seatTransactions/{autoId}
 *
 * Body:
 *  - educatorId?: string
 *  - tenantSlug?: string
 *  - newSeatLimit: number
 *  - transactionId: string
 *  - note?: string
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const adminUser = await requireUser(req, { roles: ["ADMIN"] });

    const educatorIdRaw = String(req.body?.educatorId || "").trim();
    const tenantSlugRaw = String(req.body?.tenantSlug || "").trim().toLowerCase();

    const newSeatLimitNum = Number(req.body?.newSeatLimit);
    const transactionId = String(req.body?.transactionId || "").trim();
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";

    if (!transactionId) return res.status(400).json({ error: "Missing transactionId" });
    if (!Number.isFinite(newSeatLimitNum) || newSeatLimitNum < 0) {
      return res.status(400).json({ error: "newSeatLimit must be a number >= 0" });
    }

    const admin = getAdmin();
    const db = admin.firestore();

    let educatorId = educatorIdRaw;

    // Resolve via tenant slug if educatorId not provided
    if (!educatorId && tenantSlugRaw) {
      const tenantSnap = await db.doc(`tenants/${tenantSlugRaw}`).get();
      if (!tenantSnap.exists) return res.status(404).json({ error: "Tenant not found" });
      educatorId = String(tenantSnap.data()?.educatorId || "").trim();
    }

    if (!educatorId) return res.status(400).json({ error: "Provide educatorId or tenantSlug" });

    const educatorRef = db.doc(`educators/${educatorId}`);
    const educatorSnap = await educatorRef.get();
    if (!educatorSnap.exists) return res.status(404).json({ error: "Educator not found" });

    const prevSeatLimit = Math.max(0, Number(educatorSnap.data()?.seatLimit || 0));
    const newSeatLimit = Math.floor(newSeatLimitNum);
    const delta = newSeatLimit - prevSeatLimit;

    // Don't allow admin to reduce below currently used active seats
    let used = 0;
    try {
      const agg = await db
        .collection(`educators/${educatorId}/billingSeats`)
        .where("status", "==", "active")
        .count()
        .get();
      used = agg.data().count || 0;
    } catch {
      const snap = await db
        .collection(`educators/${educatorId}/billingSeats`)
        .where("status", "==", "active")
        .get();
      used = snap.size;
    }

    if (newSeatLimit < used) {
      return res.status(400).json({
        error: `Cannot set seats to ${newSeatLimit}. Used active seats are ${used}. Revoke seats first.`,
      });
    }

    const txRef = db.collection(`educators/${educatorId}/seatTransactions`).doc();

    const batch = db.batch();

    batch.set(
      educatorRef,
      {
        seatLimit: newSeatLimit,
        seatUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        seatUpdatedBy: adminUser.uid,

        lastSeatTransactionId: transactionId,
        lastSeatTransactionDocId: txRef.id,
        lastSeatTransactionAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSeatTransactionDelta: delta,
        lastSeatTransactionNote: note || null,

        // Handy for UI/debug
        lastSeatTransactionUsedSeats: used,
      },
      { merge: true }
    );

    batch.set(txRef, {
      transactionId,
      previousSeatLimit: prevSeatLimit,
      newSeatLimit,
      delta,
      note: note || null,
      usedSeatsAtUpdate: used,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: adminUser.uid,
      updatedByEmail: adminUser.email || null,
    });

    await batch.commit();

    return res.json({
      ok: true,
      educatorId,
      previousSeatLimit: prevSeatLimit,
      newSeatLimit,
      usedSeats: used,
      delta,
      transactionId,
      txDocId: txRef.id,
    });
  } catch (e: any) {
    console.error(e);
    await notifyDiscord(e, req, "update-seats");
    const msg = String(e?.message || "Server error");
    if (msg === "Forbidden") return res.status(403).json({ error: "Forbidden" });
    return res.status(500).json({ error: msg });
  }
}
