import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdmin } from "../_lib/firebaseAdmin.js";
import { requireUser } from "../_lib/requireUser.js";
import { notifyDiscord } from "../_lib/discordLogger.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const user = await requireUser(req, { roles: ["EDUCATOR", "ADMIN"] });
    const educatorId = user.uid;

    const studentId = String(req.body?.studentId || "").trim();
    if (!studentId) return res.status(400).json({ error: "Missing studentId" });

    const admin = getAdmin();
    const db = admin.firestore();

    await db.doc(`educators/${educatorId}/billingSeats/${studentId}`).set(
      {
        status: "inactive",
        revokedAt: admin.firestore.FieldValue.serverTimestamp(),
        revokedBy: educatorId,
      },
      { merge: true }
    );

    return res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    await notifyDiscord(e, req, "revoke-seat");
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}

