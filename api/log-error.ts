import type { VercelRequest, VercelResponse } from "@vercel/node";
import { notifyDiscord } from "./_lib/discordLogger.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { message, stack, context } = req.body ?? {};
    if (!message) return res.status(400).json({ error: "missing message" });

    const syntheticError = Object.assign(new Error(String(message)), {
      stack: stack ? `Error: ${message}\n${stack}` : undefined,
    });

    await notifyDiscord(syntheticError, req, String(context ?? "frontend"));
    return res.json({ ok: true });
  } catch {
    return res.status(500).end();
  }
}
