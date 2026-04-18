export function logError(error: unknown, context: string): void {
  const url = import.meta.env.VITE_DISCORD_ERROR_WEBHOOK_URL;
  if (!url) return;

  const err = error instanceof Error ? error : new Error(String(error));
  const stack = (err.stack || err.message).slice(0, 1800);

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [{
        title: `[${context}] ${err.message}`.slice(0, 256),
        color: 0xe74c3c,
        fields: [
          { name: "Stack", value: `\`\`\`\n${stack}\n\`\`\`` },
          { name: "Time", value: new Date().toISOString(), inline: true },
          { name: "URL", value: window.location.href.slice(0, 1024), inline: true },
        ],
      }],
    }),
  }).catch(() => {});
}
