import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Loader2, Home, Mail } from "lucide-react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useTenant } from "@/contexts/TenantProvider";
import { useAuth } from "@/contexts/AuthProvider";
import { registerStudentForTenant } from "@/lib/studentRegistration";
import logo from "../assets/univ-logo.png";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { generateSessionId, setLocalSessionId, syncSessionWithFirestore } from "@/lib/session";

type RoleUI = "student" | "educator";

export default function Login() {
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const { isTenantDomain, tenantSlug, loading: tenantLoading } = useTenant();
  const { firebaseUser, profile, loading: authLoading, refreshProfile } = useAuth();



  const roleParam = (searchParams.get("role") || "").toLowerCase();
  const initialRole: RoleUI = roleParam === "educator" ? "educator" : "student";

  const [role, setRole] = useState<RoleUI>(initialRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);


  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

  const effectiveRole: RoleUI = isTenantDomain ? "student" : role;

  // If user didn't provide a role via query param, default to educator on main domain.
  useEffect(() => {
    if (tenantLoading) return;
    if (!roleParam) {
      if (!isTenantDomain) setRole("educator");
      else setRole("student");
    }
  }, [isTenantDomain, tenantLoading, roleParam]);

  // Auto-redirect if the user is already authenticated
  useEffect(() => {
    if (authLoading || tenantLoading) return;
    if (!firebaseUser || !profile) return;

    const role = String(profile.role || "").toUpperCase();
    if (isTenantDomain && role === "STUDENT") {
      nav("/student", { replace: true });
    } else if (!isTenantDomain && (role === "EDUCATOR" || role === "ADMIN")) {
      nav("/educator", { replace: true });
    }
  }, [authLoading, tenantLoading, firebaseUser, profile, isTenantDomain, nav]);

  const title = useMemo(() => {
    if (tenantLoading) return "Loading…";
    if (isTenantDomain) return `Login to ${tenantSlug || "your coaching"}`;
    return effectiveRole === "educator" ? "Educator Login" : "Student Login";
  }, [tenantLoading, isTenantDomain, tenantSlug, effectiveRole]);

  async function handleForgotPassword() {
    const targetEmail = resetEmail.trim();

    if (!targetEmail) {
      toast.error("Please enter your email address.");
      return;
    }

    setSendingReset(true);

    try {
      await sendPasswordResetEmail(auth, targetEmail);
      toast.success("Password reset link sent to your email.");
      setForgotOpen(false);
    } catch (error: any) {
      console.error(error);

      let msg = "Failed to send reset email.";
      if (error?.code === "auth/invalid-email") msg = "Please enter a valid email address.";
      else if (error?.code === "auth/too-many-requests") msg = "Too many attempts. Please try again later.";

      toast.error(msg);
    } finally {
      setSendingReset(false);
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);

      // load profile doc
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      const data: any = snap.exists() ? snap.data() : {};

      const roleDb = String(data?.role || "STUDENT").toUpperCase();
      const enrolledTenants: string[] = Array.isArray(data?.enrolledTenants)
        ? data.enrolledTenants
        : typeof data?.tenantSlug === "string"
          ? [data.tenantSlug]
          : [];

      // ---- tenant domain: students only ----
      if (isTenantDomain) {
        if (!tenantSlug) {
          toast.error("Invalid coaching URL (tenant slug missing).");
          await auth.signOut();
          return;
        }

        if (roleDb === "EDUCATOR" || roleDb === "ADMIN") {
          toast.error("Educators must login from the main website, not the coaching URL.");
          await auth.signOut();
          return;
        }

        if (!enrolledTenants.includes(tenantSlug)) {
          toast.error("You are not enrolled in this coaching. Please signup on this coaching URL first.");
          await auth.signOut();
          return;
        }

        const token = await cred.user.getIdToken();
        try {
          await registerStudentForTenant(token, tenantSlug);
        } catch (apiErr: any) {
          console.error("[Login] Sync error:", apiErr);
          if (apiErr.message.includes("<!DOCTYPE html>")) {
            console.warn("API server not detected. Please ensure 'vercel dev' is running.");
          }
        }

        // --- Single Session Logic for Students ---
        const sid = generateSessionId();
        setLocalSessionId(sid);
        await syncSessionWithFirestore(cred.user.uid, sid);

        toast.success("Welcome back!");
        await refreshProfile();
        nav("/student", { replace: true });
        return;

      }

      // ---- main domain: educators only (students must use coaching URL) ----
      if (effectiveRole === "student") {
        toast.error("Students must login from their coaching URL (tenant website).");
        await auth.signOut();
        return;
      }

      if (!(roleDb === "EDUCATOR" || roleDb === "ADMIN")) {
        toast.error("This account is not an educator account.");
        await auth.signOut();
        return;
      }

      const tenantSlugDb = data?.tenantSlug;
      if (!tenantSlugDb) {
        toast.error("Educator account misconfigured (missing tenant slug).");
        await auth.signOut();
        return;
      }

      toast.success("Logged in!");
      await refreshProfile();
      nav("/educator", { replace: true });
      return;
    } catch (error: any) {
      console.error(error);
      let msg = "Failed to login";
      if (error.code === "auth/invalid-credential") msg = "Invalid email or password";
      else msg = error.message || msg;
      toast.error(msg);
      await auth.signOut().catch(() => { });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2 bg-background">
      {/* LEFT COLUMN - FORM */}
      <div className="flex flex-col min-h-screen p-6 lg:p-12 relative">
        {/* Header / Nav */}
        <div className="flex justify-between items-center mb-8">
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
          <div className="w-full max-w-md space-y-8">
            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
              <p className="text-muted-foreground">
                Welcome back! Please enter your details to sign in.
              </p>
            </div>

            {/* role is set via useEffect; avoid state changes during render */}

            {/* Dummy Google Login */}
            {/* <Button
              type="button"
              variant="outline"
              className="w-full h-11 bg-background"
              onClick={() => toast.info("Google login coming soon!")}
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
              Sign in with Google
            </Button> */}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Continue with email
                </span>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
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

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setForgotOpen(true);
                    }}
                    className="text-sm font-medium text-[#4F46E5] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              <Button
                disabled={loading || authLoading}
                className="w-full h-11 text-base bg-[#4F46E5] hover:bg-[#4338CA] text-white transition-colors"
              >
                {loading || authLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Continue"
                )}

              </Button>
            </form>

            <div className="text-center text-sm text-muted-foreground">
              Don’t have an account?{" "}
              <Link
                className="font-medium text-[#4F46E5] hover:underline"
                to={`/signup?role=${effectiveRole}`}
              >
                Sign up
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN - IMAGE (Hidden on Mobile) */}
      <div className="hidden lg:flex flex-col bg-[#FFF5EE] p-12 justify-center items-center relative overflow-hidden">
        {/* Soft blur background blobs for extra aesthetics */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-orange-200/50 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-pink-200/40 rounded-full blur-[100px] translate-x-1/3 translate-y-1/3" />

        <div className="relative w-full max-w-xl aspect-[4/5] rounded-[2rem] overflow-hidden shadow-2xl border-8 border-white/50">
          <img
            src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1000&auto=format&fit=crop"
            alt="Educator Workspace"
            className="w-full h-full object-cover"
          />
        </div>
      </div>



      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-[#4F46E5]" />
              Reset your password
            </DialogTitle>
            <DialogDescription>
              Enter your email address and we’ll send you a password reset link.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="you@email.com"
              className="h-11"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setForgotOpen(false)}
              disabled={sendingReset}
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleForgotPassword}
              disabled={sendingReset}
              className="bg-[#4F46E5] hover:bg-[#4338CA] text-white"
            >
              {sendingReset ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
