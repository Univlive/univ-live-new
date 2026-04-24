import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { getAdmin } from "../_lib/firebaseAdmin.js";
import { readRawBody } from "../_lib/readRawBody.js";
import { notifyDiscord } from "../_lib/discordLogger.js";

function pickEducatorId(event: any): string {
  return (
    String(event?.payload?.subscription?.entity?.notes?.educatorId || "") ||
    String(event?.payload?.payment?.entity?.notes?.educatorId || "") ||
    String(event?.payload?.invoice?.entity?.notes?.educatorId || "")
  );
}
function pickSubscriptionId(event: any): string {
  const subEntity = event?.payload?.subscription?.entity;
  const invEntity = event?.payload?.invoice?.entity;
  const payEntity = event?.payload?.payment?.entity;
  return (
    String(subEntity?.id || "") ||
    String(invEntity?.subscription_id || "") ||
    String(payEntity?.subscription_id || "")
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).send("Method not allowed");

    const raw = await readRawBody(req);
    const signature = String(req.headers["x-razorpay-signature"] || "");

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(raw)
      .digest("hex");

    if (expected !== signature) return res.status(401).send("Invalid signature");

    const event = JSON.parse(raw.toString("utf8"));

    const admin = getAdmin();
    const db = admin.firestore();

    const subEntity = event?.payload?.subscription?.entity;
    const invEntity = event?.payload?.invoice?.entity;
    const payEntity = event?.payload?.payment?.entity;

    let educatorId = pickEducatorId(event);

    if (!educatorId) {
      const subId = pickSubscriptionId(event);
      if (subId) {
        const mapSnap = await db.doc(`razorpaySubscriptions/${subId}`).get();
        educatorId = String(mapSnap.data()?.educatorId || "");
      }
    }

    if (!educatorId) return res.status(200).send("OK (no educatorId)");

    if (subEntity?.id) {
      await db.doc(`razorpaySubscriptions/${subEntity.id}`).set(
        { educatorId, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );

      await db.doc(`educators/${educatorId}/billing/subscription`).set(
        {
          status: String(subEntity.status || ""),
          quantity: Number(subEntity.quantity || 0),
          razorpaySubscriptionId: String(subEntity.id),
          planKey: String(subEntity.notes?.planKey || ""),
          currentEndAt: subEntity.current_end
            ? admin.firestore.Timestamp.fromMillis(subEntity.current_end * 1000)
            : null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastWebhookEvent: String(event?.event || ""),
          lastWebhookAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    if (invEntity?.id) {
      await db.doc(`educators/${educatorId}/billingInvoices/inv_${invEntity.id}`).set(
        {
          entity: "invoice",
          status: String(invEntity.status || ""),
          amount: Number(invEntity.amount || 0),
          currency: String(invEntity.currency || "INR"),
          invoice_pdf: invEntity.invoice_pdf || "",
          short_url: invEntity.short_url || "",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          raw: invEntity,
        },
        { merge: true }
      );
    }

    if (payEntity?.id) {
      await db.doc(`educators/${educatorId}/billingInvoices/pay_${payEntity.id}`).set(
        {
          entity: "payment",
          status: String(payEntity.status || ""),
          amount: Number(payEntity.amount || 0),
          currency: String(payEntity.currency || "INR"),
          method: payEntity.method || "",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          raw: payEntity,
        },
        { merge: true }
      );
    }

    return res.status(200).send("OK");
  } catch (e) {
    console.error(e);
    await notifyDiscord(e, req, "razorpay-webhook");
    return res.status(500).send("Server error");
  }
}

