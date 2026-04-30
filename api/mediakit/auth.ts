import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

import { requireUser } from "../_lib/requireUser";

// MediaKit (ImageKit-compatible) auth endpoint.
// Client uses this to obtain {token, expire, signature} for direct uploads.
//
// Required env vars (Vercel):
// - MEDIAKIT_PUBLIC_KEY  (or IMAGEKIT_PUBLIC_KEY)
// - MEDIAKIT_PRIVATE_KEY (or IMAGEKIT_PRIVATE_KEY)

function pickEnv(...keys: string[]) {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    // 🔐 Admin only
    await requireUser(req, res, ["ADMIN"]);
    if (res.writableEnded) return;

    const publicKey = pickEnv("MEDIAKIT_PUBLIC_KEY", "IMAGEKIT_PUBLIC_KEY");
    const privateKey = pickEnv("MEDIAKIT_PRIVATE_KEY", "IMAGEKIT_PRIVATE_KEY");

    if (!publicKey || !privateKey) {
      return res.status(500).json({
        error:
          "MediaKit keys are missing. Set MEDIAKIT_PUBLIC_KEY and MEDIAKIT_PRIVATE_KEY in Vercel env.",
      });
    }

    // ImageKit-style auth
    const token = crypto.randomBytes(16).toString("hex");
    const expire = Math.floor(Date.now() / 1000) + 60 * 30; // 30 minutes
    const signature = crypto
      .createHmac("sha1", privateKey)
      .update(token + expire)
      .digest("hex");

    return res.status(200).json({ token, expire, signature, publicKey });
  } catch (e: any) {
    console.error("/api/mediakit/auth error:", e);
    if (res.writableEnded) return;
    return res.status(500).json({ error: "Failed to create upload auth" });
  }
}

