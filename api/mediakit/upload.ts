// api/mediakit/upload.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

type Body = {
  filename?: string;
  contentType?: string;
  dataUrl?: string;
};

function extractBase64(dataUrl: string) {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) return null;
  return { mime: m[1], b64: m[2] };
}

function pickUrl(obj: any): string | null {
  if (!obj || typeof obj !== "object") return null;
  const candidates = [
    obj.url,
    obj.fileUrl,
    obj.secure_url,
    obj.data?.url,
    obj.result?.url,
    obj.data?.fileUrl,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.startsWith("http")) return c;
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { MEDIAKIT_UPLOAD_URL, MEDIAKIT_API_KEY } = process.env;
  if (!MEDIAKIT_UPLOAD_URL || !MEDIAKIT_API_KEY) {
    return res.status(501).json({
      error: "MediaKit not configured",
      requiredEnv: ["MEDIAKIT_UPLOAD_URL", "MEDIAKIT_API_KEY"],
    });
  }

  const body = (req.body || {}) as Body;
  const filename = body.filename || `image_${Date.now()}.png`;
  const contentType = body.contentType || "image/png";
  const parsed = extractBase64(body.dataUrl || "");
  if (!parsed) return res.status(400).json({ error: "Invalid dataUrl" });

  try {
    const buf = Buffer.from(parsed.b64, "base64");

    // Node 18+ supports FormData/Blob in Vercel runtime
    // @ts-ignore
    const form = new FormData();
    // @ts-ignore
    const blob = new Blob([buf], { type: contentType });
    // @ts-ignore
    form.append("file", blob, filename);

    const uploadRes = await fetch(MEDIAKIT_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MEDIAKIT_API_KEY}`,
      },
      body: form as any,
    });

    const text = await uploadRes.text();
    let payload: any;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }

    if (!uploadRes.ok) {
      return res.status(502).json({ error: "MediaKit upload failed", status: uploadRes.status, payload });
    }

    const url = pickUrl(payload);
    if (!url) return res.status(502).json({ error: "No url returned", payload });

    return res.status(200).json({ url });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Upload error" });
  }
}

