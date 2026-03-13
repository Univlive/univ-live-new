import { auth } from "@/lib/firebase";

type MediaKitAuth = {
  token: string;
  expire: number;
  signature: string;
  publicKey: string;
};

export type MediaKitUploadResult = {
  url: string;
  fileId?: string;
  name?: string;
  thumbnailUrl?: string;
};

async function getIdToken() {
  const u = auth.currentUser;
  if (!u) throw new Error("Not authenticated");
  return await u.getIdToken();
}

export async function getMediaKitAuth(): Promise<MediaKitAuth> {
  const token = await getIdToken();
  const res = await fetch("/api/mediakit/auth", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || "Failed to get upload auth");
  }

  return data as MediaKitAuth;
}

export async function uploadToMediaKit(
  file: Blob,
  opts?: { fileName?: string; folder?: string }
): Promise<MediaKitUploadResult> {
  const a = await getMediaKitAuth();

  const fileName =
    opts?.fileName ||
    (file instanceof File && file.name) ||
    `upload_${Date.now()}.png`;

  const form = new FormData();
  form.append("file", file);
  form.append("fileName", fileName);
  if (opts?.folder) form.append("folder", opts.folder);
  form.append("token", a.token);
  form.append("expire", String(a.expire));
  form.append("signature", a.signature);
  form.append("publicKey", a.publicKey);
  form.append("useUniqueFileName", "true");

  const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || data?.error || "Upload failed");
  }

  return {
    url: data?.url,
    fileId: data?.fileId,
    name: data?.name,
    thumbnailUrl: data?.thumbnailUrl,
  };
}

