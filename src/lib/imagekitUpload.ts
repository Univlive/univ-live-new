// src/lib/imagekitUpload.ts
import { auth } from "@/lib/firebase";

type ImageKitScope = "question-bank" | "website" | "generic";

async function getIdToken(): Promise<string> {
  const u = auth.currentUser;
  if (!u) throw new Error("Not logged in");
  return await u.getIdToken();
}

export async function uploadToImageKit(
  file: Blob,
  fileName: string,
  folder = "/question-bank",
  scope: ImageKitScope = "question-bank"
) {
  const publicKey = import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY as string;
  if (!publicKey) throw new Error("Missing VITE_IMAGEKIT_PUBLIC_KEY");

  // IMPORTANT: do NOT reuse token/signature. Fetch fresh auth params for every upload.
  const idToken = await getIdToken();

  const authRes = await fetch(`/api/imagekit-auth?scope=${encodeURIComponent(scope)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!authRes.ok) {
    const txt = await authRes.text().catch(() => "");
    throw new Error(`Failed to get ImageKit auth: ${authRes.status} ${txt}`);
  }

  const { token, expire, signature } = (await authRes.json()) as {
    token: string;
    expire: number;
    signature: string;
  };

  const form = new FormData();
  form.append("file", file);
  form.append("fileName", fileName);
  form.append("publicKey", publicKey);
  form.append("signature", signature);
  form.append("expire", String(expire));
  form.append("token", token);
  form.append("folder", folder);
  form.append("useUniqueFileName", "true");

  const uploadRes = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    body: form,
  });

  if (!uploadRes.ok) {
    const txt = await uploadRes.text().catch(() => "");
    throw new Error(`ImageKit upload failed: ${uploadRes.status} ${txt}`);
  }

  const json = await uploadRes.json();

  return {
    url: json.url as string,
    fileId: json.fileId as string,
    name: json.name as string,
  };
}
