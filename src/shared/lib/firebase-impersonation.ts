import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "./firebase";

// Secondary isolated Firebase app used exclusively for impersonation sessions.
// Firebase stores auth state under a key scoped to the app name, so this app's
// auth state (sessionStorage, browserSessionPersistence) never touches the primary
// app's localStorage key — the admin tab stays logged in.
const impApp =
  getApps().find((a) => a.name === "impersonation") ??
  initializeApp(firebaseConfig, "impersonation");

export const impAuth = getAuth(impApp);
export const impDb = getFirestore(impApp);
