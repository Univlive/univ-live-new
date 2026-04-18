import { db } from "./firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

const SESSION_KEY = "univ_session_id";

export function generateSessionId(): string {
  return crypto.randomUUID();
}

export function getLocalSessionId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function setLocalSessionId(sessionId: string) {
  localStorage.setItem(SESSION_KEY, sessionId);
}

export function clearLocalSessionId() {
  localStorage.removeItem(SESSION_KEY);
}

export async function syncSessionWithFirestore(uid: string, sessionId: string) {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    currentSessionId: sessionId,
    lastLoginAt: serverTimestamp(),
  });
}
