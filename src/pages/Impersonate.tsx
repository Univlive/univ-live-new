import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { browserSessionPersistence, setPersistence, signInWithCustomToken } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@shared/lib/firebase";
import { Loader2 } from "lucide-react";

export default function Impersonate() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("k");
    if (!key) { setError("Invalid impersonation link."); return; }

    const raw = localStorage.getItem(key);
    localStorage.removeItem(key);
    if (!raw) { setError("Token not found or already used."); return; }

    let parsed: { token: string; name: string; expires: number };
    try { parsed = JSON.parse(raw); } catch { setError("Malformed token."); return; }

    if (Date.now() > parsed.expires) { setError("Token expired. Try again from the admin panel."); return; }

    setPersistence(auth, browserSessionPersistence)
      .then(() => signInWithCustomToken(auth, parsed.token))
      .then(async (cred) => {
        sessionStorage.setItem("imp_session", JSON.stringify({ name: parsed.name, uid: cred.user.uid }));
        const snap = await getDoc(doc(db, "users", cred.user.uid));
        const role = snap.exists() ? (snap.data().role as string || "") : "";
        if (role === "EDUCATOR") navigate("/educator", { replace: true });
        else if (role === "STUDENT") navigate("/student", { replace: true });
        else navigate("/", { replace: true });
      })
      .catch((e) => setError(e.message || "Sign-in failed."));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-destructive text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
