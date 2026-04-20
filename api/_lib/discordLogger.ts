import type { VercelRequest } from "@vercel/node";

const WEBHOOK_URL = process.env.DISCORD_ERROR_WEBHOOK_URL;

export async function notifyDiscord(
  error: unknown,
  req?: VercelRequest,
  context?: string
): Promise<void> {
  if (!WEBHOOK_URL) return;

  const err = error instanceof Error ? error : new Error(String(error));
  const stack = (err.stack || err.message).slice(0, 1800);
  const route = req ? `${req.method ?? "?"} ${req.url ?? "?"}` : "unknown";
  const title = `[${context ?? route}] ${err.message}`.slice(0, 256);

  const payload = {
    embeds: [
      {
        title,
        color: 0xe74c3c,
        fields: [
          { name: "Route", value: route, inline: true },
          { name: "Time", value: new Date().toISOString(), inline: true },
          { name: "Stack", value: `\`\`\`\n${stack}\n\`\`\`` },
        ],
      },
    ],
  };

  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // silent — never let logging break the response
  }
}
