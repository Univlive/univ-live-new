import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Loader2, Home } from "lucide-react";
import { toast } from "sonner";
import { useTenant } from "@app/providers/TenantProvider";

import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { arrayUnion, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@shared/lib/firebase";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { registerStudentForTenant } from "@shared/lib/studentRegistration";
import logo from "../assets/univ-logo.png";
import { generateSessionId, setLocalSessionId, syncSessionWithFirestore } from "@shared/lib/session";

type RoleUI = "student" | "educator";

function normSlug(raw: string) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function Signup() {
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const { isTenantDomain, tenantSlug, tenant, loading: tenantLoading } = useTenant();

  const roleParam = (searchParams.get("role") || "").toLowerCase();
  const [role, setRole] = useState<RoleUI>(roleParam === "educator" ? "educator" : "student");
  const effectiveRole: RoleUI = isTenantDomain ? "student" : role;

  // If user didn't provide a role via query param, default to educator on main domain.
  useEffect(() => {
    if (tenantLoading) return;
    if (!roleParam) {
      if (!isTenantDomain) setRole("educator");
      else setRole("student");
    }
  }, [isTenantDomain, tenantLoading, roleParam]);

  const [name, setName] = useState("");
  const [coachingName, setCoachingName] = useState("");
  const [desiredSlug, setDesiredSlug] = useState("");
  const [phone, setPhone] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const title = useMemo(() => {
    if (tenantLoading) return "Loading…";
    if (isTenantDomain) return `Student Signup for ${tenantSlug || "your coaching"}`;
    return effectiveRole === "educator" ? "Educator Signup" : "Student Signup";
  }, [tenantLoading, isTenantDomain, tenantSlug, effectiveRole]);

  async function checkSlugAvailable(slug: string) {
    const s = await getDoc(doc(db, "tenants", slug));
    return !s.exists();
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (effectiveRole === "student") {
        if (!isTenantDomain || !tenantSlug || !tenant?.educatorId) {
          toast.error("Students must signup from a valid coaching URL.");
          setLoading(false);
          return;
        }

        try {
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          await updateProfile(cred.user, { displayName: name });

          await setDoc(
            doc(db, "users", cred.user.uid),
            {
              uid: cred.user.uid,
              role: "STUDENT",
              displayName: name,
              email,
              educatorId: tenant.educatorId,
              tenantSlug,
              enrolledTenants: arrayUnion(tenantSlug),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          const token = await cred.user.getIdToken();
          try {
            await registerStudentForTenant(token, tenantSlug);
          } catch (apiErr: any) {
            console.error("[Signup] Sync error:", apiErr);
          }

          const sid = generateSessionId();
          setLocalSessionId(sid);
          await syncSessionWithFirestore(cred.user.uid, sid);

          toast.success("Account created!");
          nav("/student");
          return;
        } catch (err: any) {
          if (err?.code === "auth/email-already-in-use") {
            try {
              const cred2 = await signInWithEmailAndPassword(auth, email, password);
              const snap = await getDoc(doc(db, "users", cred2.user.uid));
              const existingRole = String(snap.data()?.role || "").toUpperCase();

              if (existingRole && existingRole !== "STUDENT") {
                toast.error(`This email is already registered as ${existingRole}. Please use a different email.`);
                await auth.signOut();
                return;
              }

              await setDoc(
                doc(db, "users", cred2.user.uid),
                {
                  tenantSlug,
                  enrolledTenants: arrayUnion(tenantSlug),
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              );

              const token = await cred2.user.getIdToken();
              try {
                await registerStudentForTenant(token, tenantSlug);
              } catch (apiErr: any) {
                console.error("[Signup] Sync error (re-join):", apiErr);
              }

              const sid = generateSessionId();
              setLocalSessionId(sid);
              await syncSessionWithFirestore(cred2.user.uid, sid);

              toast.success("Signed in and enrolled!");
              nav("/student");
              return;
            } catch (innerErr: any) {
              if (innerErr?.code === "auth/invalid-credential") {
                toast.error("Wrong password. Please login instead.");
              } else if (!innerErr?.code) {
                throw innerErr;
              }
              return;
            }
          }
          throw err;
        }
      }

      // Educator signup (main domain only)
      if (isTenantDomain) {
        toast.error("Educators must signup from the main website, not the coaching URL.");
        return;
      }

      const slug = normSlug(desiredSlug);
      if (!slug) throw new Error("Please enter a valid tenant slug");
      if (!(await checkSlugAvailable(slug))) throw new Error("Tenant slug already taken");

      let cred;
      try {
        cred = await createUserWithEmailAndPassword(auth, email, password);
      } catch (err: any) {
        if (err?.code === "auth/email-already-in-use") {
          toast.error("This email already has an account. Please login instead.");
          return;
        }
        throw err;
      }
      await updateProfile(cred.user, { displayName: name });

      const uid = cred.user.uid;

      await setDoc(
        doc(db, "users", uid),
        {
          uid,
          role: "EDUCATOR",
          displayName: name,
          email,
          tenantSlug: slug,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "educators", uid),
        {
          tenantSlug: slug,
          coachingName: coachingName || name,
          phone: phone || "",
          email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "tenants", slug),
        {
          educatorId: uid,
          tenantSlug: slug,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      toast.success("Educator account created!");
      nav("/educator");
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2 bg-background">
      {/* LEFT COLUMN - FORM */}
      <div className="flex flex-col min-h-screen p-6 lg:p-12 relative">
        {/* Header / Nav */}
        <div className="flex justify-between items-center mb-6">
           {effectiveRole === "educator" ? (
            <img src={logo} className="w-25 h-10" alt="UNIV.LIVE Logo" />
          ) : (
            <div />
          )}
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="w-4 h-4" />
            Return to Home
          </Link>
        </div>

        {/* Form Wrapper */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
              <p className="text-muted-foreground">
                Create your account to organize and expand your online presence.
              </p>
            </div>

            {!isTenantDomain && (
              <div className="flex gap-2 p-1 bg-muted rounded-lg">
                <Button
                  type="button"
                  variant={effectiveRole === "student" ? "default" : "ghost"}
                  className="w-full"
                  onClick={() => setRole("student")}
                >
                  Student
                </Button>
                <Button
                  type="button"
                  variant={effectiveRole === "educator" ? "default" : "ghost"}
                  className="w-full"
                  onClick={() => setRole("educator")}
                >
                  Educator
                </Button>
              </div>
            )}

            {/* Dummy Google Signup */}
            {/* <Button
              type="button"
              variant="outline"
              className="w-full h-11 bg-background"
              onClick={() => toast.info("Google signup coming soon!")}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign up with Google
            </Button> */}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Register with email
                </span>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  className="h-11"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>

              {effectiveRole === "educator" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
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
                      <Input
                        className="h-11"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="9876543210"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Tenant Slug (subdomain)</Label>
                    <Input
                      className="h-11"
                      value={desiredSlug}
                      onChange={(e) => setDesiredSlug(e.target.value)}
                      placeholder="e.g. abc-coaching"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  className="h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                />
              </div>

              <div className="space-y-2">
                <Label>Password</Label>
                <div className="relative">
                  <Input
                    className="h-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={show ? "text" : "password"}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                disabled={loading}
                className="w-full h-11 text-base bg-[#4F46E5] hover:bg-[#4338CA] text-white transition-colors mt-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
              </Button>
            </form>

            <div className="text-center text-sm text-muted-foreground pt-2">
              Already have an account?{" "}
              <Link
                className="font-medium text-[#4F46E5] hover:underline"
                to={`/login?role=${effectiveRole}`}
              >
                Login
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN - IMAGE (Hidden on Mobile) */}
      <div className="hidden lg:flex flex-col bg-[#FFF5EE] p-12 justify-center items-center relative overflow-hidden">
        {/* Soft blur background blobs */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-200/50 rounded-full blur-[100px] translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-pink-200/40 rounded-full blur-[100px] -translate-x-1/3 translate-y-1/3" />
        
        <div className="relative w-full max-w-xl aspect-[4/5] rounded-[2rem] overflow-hidden shadow-2xl border-8 border-white/50">
          <img
            src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1000&auto=format&fit=crop"
            alt="Educator Workspace"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </div>
  );
}
