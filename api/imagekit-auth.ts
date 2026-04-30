// api/imagekit-auth.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

// We'll dynamically import these to avoid top-level load errors
async function getRequireUser() {
  const mod = await import("./_lib/requireUser.js");
  return mod.requireUser;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Always set JSON response type
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    // CORS (simplified)
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }

    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const scope = String(req.query?.scope || "question-bank").toLowerCase();

    // 1. Authenticate user
    try {
      const requireUser = await getRequireUser();
      if (scope === "website") {
        await requireUser(req, { roles: ["ADMIN", "EDUCATOR"] });
      } else {
        await requireUser(req, { roles: ["ADMIN"] });
      }
    } catch (authErr: any) {
      const authMsg = authErr?.message || "Authentication failed";
      console.error("[imagekit-auth] Auth error:", authMsg);
      return res.status(401).json({ error: authMsg });
    }

    // 2. Generate ImageKit auth parameters manually
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    if (!privateKey) {
      return res.status(500).json({ error: "Server configuration error: missing private key" });
    }

    const token = crypto.randomBytes(16).toString("hex");
    const expire = Math.floor(Date.now() / 1000) + 60 * 30; // 30 mins
    const signature = crypto
      .createHmac("sha1", privateKey)
      .update(token + expire)
      .digest("hex");

    return res.status(200).json({ token, expire, signature });

  } catch (e: any) {
    const msg = e?.message || "Internal server error";
    console.error("[imagekit-auth] UNHANDLED ERROR:", msg);
    if (!res.headersSent) {
      return res.status(500).json({ error: msg });
    }
    res.end();
  }
}
