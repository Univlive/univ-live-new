import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Target, Trophy, TrendingUp, Play, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { StudentMetricCard } from "@/components/student/StudentMetricCard";
import { AttemptTable } from "@/components/student/AttemptTable";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthProvider";
import { useTenant } from "@/contexts/TenantProvider";
import { db } from "@/lib/firebase";

import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

type AttemptStatus = "in-progress" | "completed" | "expired";

type AttemptRow = {
  id: string;
  testId: string;
  testTitle: string;
  subject: string;
  status: AttemptStatus;

  score: number;
  maxScore: number;
  accuracy: number; // percent 0..100
  timeSpent: number; // seconds

  // AttemptTable expects these too (we keep safe defaults)
  rank: number;
  totalParticipants: number;

  createdAt: string; // AttemptTable uses new Date(createdAt)
};

type UserDoc = {
  displayName?: string;
  name?: string;
  photoURL?: string;
  avatar?: string;
};

function toMillis(v: any): number {
  if (!v) return Date.now();
  if (typeof v === "number") return v;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v?.seconds === "number") return v.seconds * 1000;
  return Date.now();
}

function safeNum(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function accuracyFrom(score: number, maxScore: number) {
  if (!maxScore || maxScore <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((score / maxScore) * 100)));
}

function formatDateLabel(ms: number) {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function normalizeStatus(raw: any): AttemptStatus {
  const s = String(raw || "").toLowerCase();

  if (s === "in-progress" || s === "inprogress" || s === "running" || s === "started") return "in-progress";
  if (s === "expired" || s === "timeout") return "expired";

  // treat everything else as completed: submitted/completed/finished/done
  return "completed";
}

export default function StudentDashboard() {
  const { firebaseUser, profile, loading: authLoading } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();

  const educatorId = tenant?.educatorId || profile?.educatorId || null;

  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [rank, setRank] = useState<number | null>(null);
  const [totalParticipants, setTotalParticipants] = useState<number>(0);

  const canLoad = useMemo(() => {
    return !authLoading && !tenantLoading && !!firebaseUser?.uid && !!educatorId;
  }, [authLoading, tenantLoading, firebaseUser?.uid, educatorId]);

  // 1) Load user profile (users/{uid})
  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      if (!firebaseUser?.uid) return;
      try {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        const data = (snap.exists() ? (snap.data() as UserDoc) : null) as any;
        if (!mounted) return;
        setUserDoc(data);
      } catch (e) {
        console.error(e);
      }
    }

    loadUser();
    return () => {
      mounted = false;
    };
  }, [firebaseUser?.uid]);

  // 2) Live attempts for this student+educator
  useEffect(() => {
    if (!canLoad) {
      setLoading(authLoading || tenantLoading);
      return;
    }

    setLoading(true);

    const qAttempts = query(
      collection(db, "attempts"),
      where("studentId", "==", firebaseUser!.uid),
      where("educatorId", "==", educatorId!),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(
      qAttempts,
      (snap) => {
        const rows: AttemptRow[] = snap.docs.map((d) => {
          const a = d.data() as any;

          const score = safeNum(a?.score, 0);
          const maxScore = safeNum(a?.maxScore, 0);

          const accuracy =
            a?.accuracy != null
              ? (() => {
                  const n = Number(a.accuracy);
                  const pct =
                    Number.isFinite(n)
                      ? n <= 1.01
                        ? n * 100
                        : n
                      : accuracyFrom(score, maxScore);
                  return Math.max(0, Math.min(100, Math.round(pct)));
                })()
              : accuracyFrom(score, maxScore);

          const createdAtMs = toMillis(a?.createdAt);
          const startedAtMs = toMillis(a?.startedAt || a?.createdAt);
          const submittedAtMs = a?.submittedAt ? toMillis(a?.submittedAt) : undefined;

          // prefer stored timeSpent; else compute
          const computedSeconds =
            submittedAtMs != null ? Math.max(0, Math.round((submittedAtMs - startedAtMs) / 1000)) : 0;

          const timeSpent = safeNum(a?.timeSpent, computedSeconds);

          const status = normalizeStatus(a?.status);

          return {
            id: d.id,
            testId: String(a?.testId || a?.testSeriesId || ""),
            testTitle: String(a?.testTitle || "Test"),
            subject: String(a?.subject || "General Test"),
            status,

            score,
            maxScore,
            accuracy,
            timeSpent,

            // we’ll set these later after rank calculation (safe defaults)
            rank: 0,
            totalParticipants: 0,

            createdAt: new Date(createdAtMs).toISOString(),
          };
        });

        setAttempts(rows);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        toast.error("Failed to load dashboard data.");
        setAttempts([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [canLoad, authLoading, tenantLoading, firebaseUser, educatorId]);

  // 3) Compute rank (best-effort)
  useEffect(() => {
    if (!canLoad) return;

    const qTop = query(
      collection(db, "attempts"),
      where("educatorId", "==", educatorId!),
      where("status", "in", ["completed", "submitted", "finished", "done"]), // handle older values
      orderBy("score", "desc"),
      limit(300)
    );

    const unsub = onSnapshot(
      qTop,
      (snap) => {
        const best: Record<string, number> = {};

        snap.docs.forEach((d) => {
          const a = d.data() as any;
          const sid = String(a?.studentId || "");
          if (!sid) return;
          const sc = safeNum(a?.score, 0);
          best[sid] = Math.max(best[sid] || 0, sc);
        });

        const sorted = Object.entries(best)
          .sort((a, b) => b[1] - a[1])
          .map(([studentId]) => studentId);

        const idx = sorted.findIndex((id) => id === firebaseUser!.uid);
        setRank(idx >= 0 ? idx + 1 : null);
        setTotalParticipants(sorted.length);
      },
      (err) => {
        console.error(err);
        setRank(null);
        setTotalParticipants(0);
      }
    );

    return () => unsub();
  }, [canLoad, educatorId, firebaseUser]);

  // attach rank/participants to attempts (so AttemptTable can show safely)
  const attemptsWithRank = useMemo(() => {
    return attempts.map((a) => ({
      ...a,
      rank: a.status === "completed" && rank ? rank : 0,
      totalParticipants: a.status === "completed" ? totalParticipants : 0,
    }));
  }, [attempts, rank, totalParticipants]);

  const firstName = useMemo(() => {
    const name =
      userDoc?.displayName ||
      userDoc?.name ||
      profile?.displayName ||
      firebaseUser?.displayName ||
      "Student";
    return name.split(" ")[0] || "Student";
  }, [userDoc, profile, firebaseUser]);

  const completedAttempts = useMemo(
    () => attemptsWithRank.filter((a) => a.status === "completed"),
    [attemptsWithRank]
  );
  const inProgressAttempt = useMemo(
    () => attemptsWithRank.find((a) => a.status === "in-progress") || null,
    [attemptsWithRank]
  );

  // Metrics
  const avgScore = useMemo(() => {
    if (completedAttempts.length === 0) return 0;
    const sum = completedAttempts.reduce((acc, a) => acc + a.score, 0);
    return Math.round(sum / completedAttempts.length);
  }, [completedAttempts]);

  const avgMaxScore = useMemo(() => {
    if (completedAttempts.length === 0) return 0;
    const sum = completedAttempts.reduce((acc, a) => acc + a.maxScore, 0);
    return Math.round(sum / completedAttempts.length);
  }, [completedAttempts]);

  const subjectPerformance = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    for (const a of completedAttempts) {
      const key = a.subject || "General Test";
      map[key] = map[key] || { total: 0, count: 0 };
      map[key].total += a.score;
      map[key].count += 1;
    }

    const data = Object.entries(map).map(([subject, v]) => ({
      subject,
      score: Math.round(v.total / Math.max(1, v.count)),
    }));

    data.sort((x, y) => y.score - x.score);
    return data;
  }, [completedAttempts]);

  const bestSubject = useMemo(() => {
    if (subjectPerformance.length === 0) return { subject: "—", score: 0 };
    return subjectPerformance[0];
  }, [subjectPerformance]);

  const scoreTrend = useMemo(() => {
    const list = [...completedAttempts]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-8);

    return list.map((a) => ({
      date: formatDateLabel(new Date(a.createdAt).getTime()),
      score: a.score,
    }));
  }, [completedAttempts]);

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <Card className="card-soft border-0 bg-gradient-to-r from-pastel-mint to-pastel-lavender overflow-hidden">
        <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Welcome back, {firstName}!</h1>
            <p className="text-muted-foreground mt-1">Keep up the great work. You're making progress!</p>
          </div>
          <Button className="gradient-bg rounded-xl" asChild>
            <Link to="/student/tests">
              <Play className="h-4 w-4 mr-2" />
              Start a Test
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StudentMetricCard
          title="Tests Attempted"
          value={completedAttempts.length}
          icon={FileText}
          color="mint"
        />
        <StudentMetricCard
          title="Avg Score"
          value={`${avgScore}/${avgMaxScore}`}
          icon={Target}
          color="yellow"
        />
        <StudentMetricCard
          title="Best Subject"
          value={bestSubject.subject}
          subtitle={`${bestSubject.score} avg`}
          icon={Trophy}
          color="lavender"
        />
        <StudentMetricCard
          title="Current Rank"
          value={rank ? `#${rank}` : "—"}
          subtitle={totalParticipants ? `out of ${totalParticipants}` : "in your coaching"}
          icon={TrendingUp}
          color="peach"
        />
      </div>

      {/* Continue Test */}
      {inProgressAttempt && (
        <Card className="card-soft border-0 bg-pastel-yellow">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Continue where you left off</p>
              <p className="font-semibold">{inProgressAttempt.testTitle}</p>
            </div>
            <Button className="gradient-bg rounded-xl" asChild>
              <Link to={`/student/tests/${inProgressAttempt.testId}/attempt`}>Continue Test</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="card-soft border-0">
          <CardHeader>
            <CardTitle className="text-lg">Score Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={scoreTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip contentStyle={{ borderRadius: "12px" }} />
                <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="card-soft border-0">
          <CardHeader>
            <CardTitle className="text-lg">Subject Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={subjectPerformance}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="subject" className="text-xs" tick={{ fontSize: 10 }} />
                <YAxis className="text-xs" />
                <Tooltip contentStyle={{ borderRadius: "12px" }} />
                <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Attempts */}
      <Card className="card-soft border-0">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Attempts</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/student/attempts">
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <AttemptTable attempts={completedAttempts.slice(0, 5) as any} compact />
        </CardContent>
      </Card>
    </div>
  );
}