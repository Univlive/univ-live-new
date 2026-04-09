import type { VercelRequest } from "@vercel/node";
import { getAdmin } from "./firebaseAdmin.js";

export type AppRole = "ADMIN" | "EDUCATOR" | "STUDENT";

export type RequiredUser = {
  uid: string;
  email?: string;
  role: AppRole;
  decoded: any;
  profile: any | null;
};

export async function requireUser(
  req: VercelRequest,
  opts?: { roles?: AppRole[] }
): Promise<RequiredUser> {
  try {
    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      throw new Error("Missing Authorization token");
    }
    
    const admin = getAdmin();
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch (tokenErr: any) {
      const tokenMsg = tokenErr?.message || String(tokenErr);
      console.error("[requireUser] ❌ Token verification failed:", tokenMsg);
      throw new Error(`Token verification failed: ${tokenMsg}`);
    }

    const db = admin.firestore();
    const userRef = db.doc(`users/${decoded.uid}`);
    let userSnap;
    try {
      userSnap = await userRef.get();
    } catch (dbErr: any) {
      const dbMsg = dbErr?.message || String(dbErr);
      console.error("[requireUser] ❌ Database error:", dbMsg);
      throw new Error(`Database error: ${dbMsg}`);
    }
    
    const profile = userSnap.exists ? userSnap.data() : null;

    const rawRole = String(profile?.role || "STUDENT").toUpperCase();
    const role: AppRole =
      rawRole === "ADMIN" || rawRole === "EDUCATOR" ? (rawRole as AppRole) : "STUDENT";

    if (opts?.roles?.length && !opts.roles.includes(role)) {
      console.error("[requireUser] ❌ Forbidden: user role", role, "not in allowed roles", opts.roles);
      throw new Error("Forbidden");
    }

    return {
      uid: decoded.uid,
      email: typeof decoded.email === "string" ? decoded.email : undefined,
      role,
      decoded,
      profile,
    };
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error("[requireUser] ❌ Error:", msg);
    throw e;
  }
}

