import admin from "firebase-admin";

let inited = false;

export function getAdmin() {
  if (!inited) {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!json) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");

    const serviceAccount = JSON.parse(json);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined,
    });

    inited = true;
  }
  return admin;
}
