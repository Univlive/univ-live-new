import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Home, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { auth, db } from "@/lib/firebase";
import { registerStudentForTenant } from "@/lib/studentRegistration";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import {
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenant } from "@/contexts/TenantProvider";

type RoleUI = "student" | "educator";

function normSlug(raw: string) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function appDomain() {
  return (import.meta as any).env?.VITE_APP_DOMAIN || "univ.live";
}

function studentRedirectUrl(tenantSlug: string) {
  if (window.location.hostname === "localhost") {
    return `/student?tenant=${encodeURIComponent(tenantSlug)}`;
  }
  return `https://${tenantSlug}.${appDomain()}/student`;
}

export default function CompleteProfile() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const { isTenantDomain, tenantSlug, tenant, loading: tenantLoading } = useTenant();

  const roleParam = (searchParams.get("role") || "").toLowerCase();
  const tenantParam = normSlug(searchParams.get("tenant") || "");

  // If you're on tenant domain, role must be student
  const effectiveRole: RoleUI = isTenantDomain ? "student" : (roleParam === "student" ? "student" : "educator");

  const effectiveTenantSlug = isTenantDomain ? (tenantSlug || "") : tenantParam;

  const [authReady, setAuthReady] = useState(false);
  const [uid, setUid] = useState<string>("");
  const [email, setEmail] = useState("");
  const [photoURL, setPhotoURL] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [coachingName, setCoachingName] = useState("");
  const [phone, setPhone] = useState("");
  const [desiredSlug, setDesiredSlug] = useState("");

  const [saving, setSaving] = useState(false);

  const title = useMemo(() => {
    if (tenantLoading) return "Loading…";
    if (effectiveRole === "student") return "Complete Student Profile";
    return "Complete Educator Profile";
  }, [tenantLoading, effectiveRole]);

  async function checkSlugAvailable(slug: string, myUid: string) {
    const s = await getDoc(doc(db, "tenants", slug));
    if (!s.exists()) return true;
    // allow if it's already mine
    const existingEducatorId = String(s.data()?.educatorId || "");
    return existingEducatorId === myUid;
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setAuthReady(true);
        toast.error("Please login first.");
        nav("/login", { replace: true });
        return;
      }
      setAuthReady(true);
      setUid(u.uid);
      setEmail(u.email || "");
      setPhotoURL(u.photoURL || null);
      setName(u.displayName || "");

      // Load existing profile (if any)
      const snap = await getDoc(doc(db, "users", u.uid));
      const data: any = snap.exists() ? snap.data() : {};

      // If admin, just go to admin
      const roleDb = String(data?.role || "").toUpperCase();
      if (roleDb === "ADMIN") {
        window.location.assign("/admin");
        return;
      }

      if (String(data?.displayName || "")) setName(String(data.displayName));
      if (String(data?.tenantSlug || "")) setDesiredSlug(String(data.tenantSlug));
    });

    return () => unsub();
  }, [nav]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    setSaving(true);
    try {
      const u = auth.currentUser;

      // ---------------- STUDENT ----------------
      if (effectiveRole === "student") {
        const tSlug = effectiveTenantSlug;
        if (!tSlug) {
          toast.error("Missing tenant slug. Open the coaching URL and try again.");
          return;
        }

        // Resolve tenant educatorId
        const tenantSnap = isTenantDomain
          ? null
          : await getDoc(doc(db, "tenants", tSlug));

        const educatorIdResolved = isTenantDomain
          ? (tenant?.educatorId || "")
          : String(tenantSnap?.data()?.educatorId || "");

        if (!educatorIdResolved) {
          toast.error("Invalid coaching slug. Please check the coaching URL.");
          return;
        }

        const displayName = (name || u.displayName || "").trim();
        if (!displayName) {
          toast.error("Please enter your name.");
          return;
        }

        await updateProfile(u, { displayName }).catch(() => {});

        await setDoc(
          doc(db, "users", u.uid),
          {
            uid: u.uid,
            role: "STUDENT",
            displayName,
            email: u.email || email,
            photoURL: u.photoURL || photoURL || null,
            educatorId: educatorIdResolved,
            tenantSlug: tSlug, // legacy
            enrolledTenants: arrayUnion(tSlug),
            onboardingComplete: true,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );

        const token = await u.getIdToken();
        await registerStudentForTenant(token, tSlug);

        toast.success("Profile completed!");
        if (isTenantDomain) {
          window.location.assign("/student");
        } else {
          window.location.assign(studentRedirectUrl(tSlug));
        }
        return;
      }

      // ---------------- EDUCATOR ----------------
      const displayName = (name || u.displayName || "").trim();
      if (!displayName) {
        toast.error("Please enter your name.");
        return;
      }

      const slug = normSlug(desiredSlug);
      if (!slug) {
        toast.error("Please enter a valid tenant slug (subdomain).");
        return;
      }

      const ok = await checkSlugAvailable(slug, u.uid);
      if (!ok) {
        toast.error("This tenant slug is already taken. Try another.");
        return;
      }

      const coaching = (coachingName || displayName).trim();
      if (!coaching) {
        toast.error("Please enter coaching name.");
        return;
      }

      await updateProfile(u, { displayName }).catch(() => {});

      await setDoc(
        doc(db, "users", u.uid),
        {
          uid: u.uid,
          role: "EDUCATOR",
          displayName,
          email: u.email || email,
          photoURL: u.photoURL || photoURL || null,
          tenantSlug: slug,
          onboardingComplete: true,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "educators", u.uid),
        {
          tenantSlug: slug,
          coachingName: coaching,
          phone: phone || "",
          email: u.email || email,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "tenants", slug),
        {
          educatorId: u.uid,
          tenantSlug: slug,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      toast.success("Educator profile completed!");
      window.location.assign("/educator");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (!authReady || tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2 bg-background">
      <div className="flex flex-col min-h-screen p-6 lg:p-12 relative">
        <div className="flex justify-between items-center mb-8">
          <div className="font-bold text-2xl tracking-tighter">UNIV.LIVE</div>
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="w-4 h-4" />
            Return to Home
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
              <p className="text-muted-foreground">
                Just a few details to finish setting up your account.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input className="h-11" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>

              {effectiveRole === "educator" && (
                <>
                  <div className="space-y-2">
                    <Label>Coaching Name</Label>
                    <Input
                      className="h-11"
                      value={coachingName}
                      onChange={(e) => setCoachingName(e.target.value)}
                      placeholder="My Coaching"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Phone (optional)</Label>
                    <Input className="h-11" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" />
                  </div>

                  <div className="space-y-2">
                    <Label>Tenant Slug (subdomain)</Label>
                    <Input
                      className="h-11"
                      value={desiredSlug}
                      onChange={(e) => setDesiredSlug(e.target.value)}
                      placeholder="e.g. abc-coaching"
                    />
                    <p className="text-xs text-muted-foreground">
                      Your website will be: <span className="font-medium">{desiredSlug ? `${normSlug(desiredSlug)}.${appDomain()}` : `your-slug.${appDomain()}`}</span>
                    </p>
                  </div>
                </>
              )}

              {effectiveRole === "student" && (
                <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                  You are joining:{" "}
                  <span className="font-medium text-foreground">
                    {effectiveTenantSlug || "your coaching"}
                  </span>
                </div>
              )}

              <Button
                disabled={saving}
                className="w-full h-11 text-base bg-[#4F46E5] hover:bg-[#4338CA] text-white transition-colors mt-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save & Continue"}
              </Button>
            </form>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex flex-col bg-[#FFF5EE] p-12 justify-center items-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-orange-200/50 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-pink-200/40 rounded-full blur-[100px] translate-x-1/3 translate-y-1/3" />
        <div className="relative w-full max-w-xl aspect-[4/5] rounded-[2rem] overflow-hidden shadow-2xl border-8 border-white/50">
          <img
            src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1000&auto=format&fit=crop"
            alt="Workspace"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </div>
  );
}
