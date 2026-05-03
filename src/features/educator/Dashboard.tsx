import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Users,
  FileText,
  KeyRound,
  Target,
  Copy,
  Check,
  Plus,
  BarChart3,
  Radio,
} from "lucide-react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import MetricCard from "@features/educator/components/MetricCard";
import EmptyState from "@features/educator/components/EmptyState";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { db } from "@shared/lib/firebase";
import { useAuth } from "@app/providers/AuthProvider";
import { buildTenantUrl } from "@shared/lib/tenant";

type StudentDoc = { id: string; status?: string; isActive?: boolean };
type AccessCodeDoc = {
  id: string;
  maxUses?: number;
  usesUsed?: number;
  expiresAt?: any;
  windowMinutes?: number;
  createdAt?: any;
};
type AttemptDoc = { id: string; status?: string; score?: number; maxScore?: number };
type EducatorProfileDoc = {
  displayName?: string;
  fullName?: string;
  name?: string;
  coachingName?: string;
  seatLimit?: number;
  tenantSlug?: string;
};

const LIVE_STATUSES = ["in-progress", "inprogress", "running", "started"];

function accessCodeActive(code: AccessCodeDoc): boolean {
  const maxUses = Number(code.maxUses ?? 0);
  const used = Number(code.usesUsed ?? 0);
  if (maxUses > 0 && used >= maxUses) return false;
  const exp = code.expiresAt;
  if (exp) {
    const ms =
      typeof exp?.toMillis === "function"
        ? exp.toMillis()
        : typeof exp?.seconds === "number"
        ? exp.seconds * 1000
        : 0;
    if (ms && ms < Date.now()) return false;
  }
  return true;
}

function isCompleted(status?: string) {
  const s = String(status || "").toLowerCase();
  return s === "submitted" || s === "completed" || s === "finished";
}

export default function EducatorDashboard() {
  const navigate = useNavigate();
  const { firebaseUser, profile, loading: authLoading } = useAuth();
  const uid = firebaseUser?.uid || null;
  const educatorId = profile?.educatorId || uid;

  const [educatorDoc, setEducatorDoc] = useState<EducatorProfileDoc | null>(null);
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<AttemptDoc[]>([]);
  const [accessCodes, setAccessCodes] = useState<AccessCodeDoc[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    if (!educatorId) return;

    let doneCount = 0;
    const markDone = () => {
      doneCount++;
      if (doneCount >= 5) setLoaded(true);
    };

    const u1 = onSnapshot(
      doc(db, "educators", educatorId),
      (snap) => { setEducatorDoc(snap.exists() ? (snap.data() as EducatorProfileDoc) : null); markDone(); },
      () => { setEducatorDoc(null); markDone(); }
    );

    const u2 = onSnapshot(
      collection(db, "educators", educatorId, "students"),
      (snap) => { setStudents(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))); markDone(); },
      () => { setStudents([]); markDone(); }
    );

    const u3 = onSnapshot(
      collection(db, "educators", educatorId, "my_tests"),
      (snap) => { setTests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))); markDone(); },
      () => { setTests([]); markDone(); }
    );

    const u4 = onSnapshot(
      query(collection(db, "attempts"), where("educatorId", "==", educatorId)),
      (snap) => { setAttempts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))); markDone(); },
      () => { setAttempts([]); markDone(); }
    );

    const u5 = onSnapshot(
      collection(db, "educators", educatorId, "accessCodes"),
      (snap) => { setAccessCodes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))); markDone(); },
      () => { setAccessCodes([]); markDone(); }
    );

    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [educatorId]);

  const liveTests = useMemo(
    () => attempts.filter((a) => LIVE_STATUSES.includes(String(a.status || "").toLowerCase())).length,
    [attempts]
  );

  const avgScore = useMemo(() => {
    const completed = attempts.filter((a) => isCompleted(a.status));
    const scored = completed.filter((a) => Number(a.maxScore) > 0);
    if (!scored.length) return "—";
    const pct =
      scored.reduce((sum, a) => sum + (Number(a.score ?? 0) / Number(a.maxScore)) * 100, 0) /
      scored.length;
    return `${Math.round(pct)}%`;
  }, [attempts]);

  const activeAccessCodes = useMemo(
    () => accessCodes.filter(accessCodeActive).length,
    [accessCodes]
  );

  const coachingName = String(
    educatorDoc?.coachingName ||
    educatorDoc?.displayName ||
    educatorDoc?.name ||
    profile?.displayName ||
    "Your Coaching"
  ).trim() || "Your Coaching";

  const coachingSlug = String(educatorDoc?.tenantSlug || profile?.tenantSlug || "").trim();
  const coachingUrl = coachingSlug ? buildTenantUrl(coachingSlug, "/") : "";

  async function handleCopyUrl() {
    if (!coachingUrl) return;
    try {
      await navigator.clipboard.writeText(coachingUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 1800);
    } catch { /* clipboard may be blocked */ }
  }

  if (authLoading || (!loaded && !!educatorId)) {
    return <div className="py-12 text-center text-muted-foreground">Loading dashboard…</div>;
  }

  if (!educatorId) {
    return (
      <EmptyState
        icon={FileText}
        title="Please login as Educator"
        description="You must be logged in to view your dashboard."
        actionLabel="Go to Login"
        onAction={() => navigate("/login?role=educator")}
      />
    );
  }

  if (loaded && tests.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Create your first test series"
        description="Add a test or import from the test bank to unlock learner and performance analytics."
        actionLabel="Open Test Series"
        onAction={() => navigate("/educator/test-series")}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="gradient-bg rounded-2xl p-5 md:p-6 text-white">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl md:text-2xl font-bold">Welcome back, {coachingName}!</h2>
            <p className="text-sm text-white/80 mt-1">Here's your coaching at a glance.</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="w-full md:w-auto bg-white/15 hover:bg-white/25 text-white border border-white/30 shrink-0"
            onClick={handleCopyUrl}
            disabled={!coachingUrl}
          >
            {copiedUrl ? (
              <><Check className="h-4 w-4 mr-2" />Copied</>
            ) : (
              <><Copy className="h-4 w-4 mr-2" />Copy Coaching URL</>
            )}
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          title="My Students"
          value={students.length.toLocaleString()}
          icon={Users}
          iconColor="text-blue-400"
          delay={0}
        />
        <MetricCard
          title="Live Tests"
          value={liveTests.toLocaleString()}
          icon={Radio}
          iconColor="text-green-400"
          delay={0.05}
        />
        <MetricCard
          title="Avg Score"
          value={avgScore}
          icon={Target}
          iconColor="text-purple-400"
          delay={0.1}
        />
        <MetricCard
          title="Active Codes"
          value={activeAccessCodes.toLocaleString()}
          icon={KeyRound}
          iconColor="text-orange-400"
          delay={0.15}
        />
      </div>

      {/* Quick Actions */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="gap-2">
              <Link to="/educator/test-series">
                <Plus className="h-4 w-4" />
                Create Test
              </Link>
            </Button>
            <Button variant="outline" asChild className="gap-2">
              <Link to="/educator/divisions">
                <Users className="h-4 w-4" />
                View Learners
              </Link>
            </Button>
            <Button variant="outline" asChild className="gap-2">
              <Link to="/educator/analytics">
                <BarChart3 className="h-4 w-4" />
                View Analytics
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
