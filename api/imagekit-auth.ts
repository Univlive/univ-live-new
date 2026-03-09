// api/imagekit-auth.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import ImageKit from "imagekit";
import { requireUser } from "./_lib/requireUser.js";

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || "",
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "",
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || "",
});

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = String(req.headers.origin || "");
  if (!origin) return;

  const allow = new Set(
    String(process.env.CORS_ALLOW_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  const isAllowed =
    allow.has(origin) ||
    origin.includes("localhost") ||
    origin.endsWith(".univ.live") ||
    origin.endsWith("univ.live");

  if (isAllowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (
    !process.env.IMAGEKIT_PUBLIC_KEY ||
    !process.env.IMAGEKIT_PRIVATE_KEY ||
    !process.env.IMAGEKIT_URL_ENDPOINT
  ) {
    return res.status(500).json({ error: "ImageKit env not configured" });
  }

  // ✅ Use scope to control who can request signature
  // scope=question-bank  -> ADMIN only (default)
  // scope=website        -> ADMIN + EDUCATOR
  // scope=generic        -> any logged-in user (optional)
  const scope = String((req.query?.scope as string) || "question-bank").toLowerCase();

  if (scope === "question-bank") {
    await requireUser(req, { roles: ["ADMIN"] });
  } else if (scope === "website") {
    await requireUser(req, { roles: ["ADMIN", "EDUCATOR"] });
  } else {
    await requireUser(req); // any authenticated user
  }

  const authParams = imagekit.getAuthenticationParameters();
  return res.status(200).json(authParams);
}
