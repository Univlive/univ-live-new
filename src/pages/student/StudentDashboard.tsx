import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Target, Trophy, TrendingUp, Play, ArrowRight, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

import { useAuth } from "@/contexts/AuthProvider";
import { useTenant } from "@/contexts/TenantProvider";
import { db } from "@/lib/firebase";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useQuery } from "@tanstack/react-query";

type AttemptStatus = "in-progress" | "completed" | "expired";

type AttemptRow = {
  id: string;
  testId: string;
  testTitle: string;
  subject: string;
  status: AttemptStatus;
  score: number;
  maxScore: number;
  accuracy: number;
  timeSpent: number;
  rank: number;
  totalParticipants: number;
  createdAt: string;
};

type UserDoc = {
  displayName?: string;
  name?: string;
  photoURL?: string;
  avatar?: string;
};

type LiveTest = {
  id: string;
  title?: string;
  subject?: string;
  durationMinutes?: number;
  questionsCount?: number;
};

type LeaderboardEntry = {
  rank: number;
  name: string;
  score: number;
  studentId: string;
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
  return "completed";
}

function mapAttemptRow(id: string, a: any): AttemptRow {
  const score = safeNum(a?.score, 0);
  const maxScore = safeNum(a?.maxScore, 0);
  const accuracy =
    a?.accuracy != null
      ? (() => {
          const n = Number(a.accuracy);
          const pct = Number.isFinite(n) ? (n <= 1.01 ? n * 100 : n) : accuracyFrom(score, maxScore);
          return Math.max(0, Math.min(100, Math.round(pct)));
        })()
      : accuracyFrom(score, maxScore);
  const createdAtMs = toMillis(a?.createdAt);
  const startedAtMs = toMillis(a?.startedAt || a?.createdAt);
  const submittedAtMs = a?.submittedAt ? toMillis(a?.submittedAt) : undefined;
  const computedSeconds =
    submittedAtMs != null ? Math.max(0, Math.round((submittedAtMs - startedAtMs) / 1000)) : 0;
  const timeSpent = safeNum(a?.timeSpent, computedSeconds);

  return {
    id,
    testId: String(a?.testId || a?.testSeriesId || ""),
    testTitle: String(a?.testTitle || "Test"),
    subject: String(a?.subject || "General Test"),
    status: normalizeStatus(a?.status),
    score,
    maxScore,
    accuracy,
    timeSpent,
    rank: 0,
    totalParticipants: 0,
    createdAt: new Date(createdAtMs).toISOString(),
  };
}

export default function StudentDashboard() {
  const { firebaseUser, profile, loading: authLoading } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();

  const educatorId = tenant?.educatorId || profile?.educatorId || null;

  const canLoad = useMemo(
    () => !authLoading && !tenantLoading && !!firebaseUser?.uid && !!educatorId,
    [authLoading, tenantLoading, firebaseUser?.uid, educatorId]
  );

  // User profile
  const { data: userDoc = null } = useQuery({
    queryKey: ["studentUserDoc", firebaseUser?.uid],
    queryFn: async () => {
      const snap = await getDoc(doc(db, "users", firebaseUser!.uid));
      return snap.exists() ? (snap.data() as UserDoc) : null;
    },
    enabled: !!firebaseUser?.uid,
    staleTime: 2 * 60 * 1000,
  });

  // Attempts
  const { data: attempts = [], isLoading: attemptsLoading } = useQuery({
    queryKey: ["studentDashboardAttempts", firebaseUser?.uid, educatorId],
    queryFn: async () => {
      const qAttempts = query(
        collection(db, "attempts"),
        where("studentId", "==", firebaseUser!.uid),
        where("educatorId", "==", educatorId!),
        orderBy("createdAt", "desc"),
        limit(50)
      );
      const snap = await getDocs(qAttempts);
      return snap.docs.map((d) => mapAttemptRow(d.id, d.data()));
    },
    enabled: canLoad,
    staleTime: 60 * 1000,
  });

  // Rank
  const { data: rankData = { rank: null as number | null, totalParticipants: 0 } } = useQuery({
    queryKey: ["studentRank", firebaseUser?.uid, educatorId],
    queryFn: async () => {
      const qTop = query(
        collection(db, "attempts"),
        where("educatorId", "==", educatorId!),
        where("status", "in", ["completed", "submitted", "finished", "done"]),
        orderBy("score", "desc"),
        limit(300)
      );
      const snap = await getDocs(qTop);
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
      return { rank: idx >= 0 ? idx + 1 : null, totalParticipants: sorted.length };
    },
    enabled: canLoad,
    staleTime: 2 * 60 * 1000,
  });

  // Live (published) tests
  const { data: liveTests = [] } = useQuery<LiveTest[]>({
    queryKey: ["liveTests", educatorId],
    queryFn: async () => {
      const q = query(
        collection(db, "educators", educatorId!, "my_tests"),
        where("isPublished", "==", true),
        orderBy("createdAt", "desc"),
        limit(4)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    },
    enabled: !!educatorId,
    staleTime: 2 * 60 * 1000,
  });

  // Leaderboard top 5
  const { data: leaderboard = [] } = useQuery<LeaderboardEntry[]>({
    queryKey: ["leaderboardPreview", educatorId],
    queryFn: async () => {
      const qTop = query(
        collection(db, "attempts"),
        where("educatorId", "==", educatorId!),
        where("status", "in", ["completed", "submitted", "finished", "done"]),
        orderBy("score", "desc"),
        limit(200)
      );
      const snap = await getDocs(qTop);
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
        .slice(0, 5);

      return Promise.all(
        sorted.map(async ([studentId, score], idx) => {
          try {
            const userSnap = await getDoc(doc(db, "users", studentId));
            const name = userSnap.exists()
              ? String(userSnap.data()?.displayName || userSnap.data()?.name || "Student")
              : "Student";
            return { rank: idx + 1, name, score, studentId };
          } catch {
            return { rank: idx + 1, name: "Student", score, studentId };
          }
        })
      );
    },
    enabled: canLoad,
    staleTime: 3 * 60 * 1000,
  });

  const loading = attemptsLoading;
  const rank = rankData.rank;
  const totalParticipants = rankData.totalParticipants;

  const attemptsWithRank = useMemo(
    () =>
      attempts.map((a) => ({
        ...a,
        rank: a.status === "completed" && rank ? rank : 0,
        totalParticipants: a.status === "completed" ? totalParticipants : 0,
      })),
    [attempts, rank, totalParticipants]
  );

  const firstName = useMemo(() => {
    const name =
      userDoc?.displayName || userDoc?.name || profile?.displayName || firebaseUser?.displayName || "Student";
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

  const avgScore = useMemo(() => {
    if (completedAttempts.length === 0) return 0;
    return Math.round(completedAttempts.reduce((acc, a) => acc + a.score, 0) / completedAttempts.length);
  }, [completedAttempts]);

  const avgMaxScore = useMemo(() => {
    if (completedAttempts.length === 0) return 0;
    return Math.round(completedAttempts.reduce((acc, a) => acc + a.maxScore, 0) / completedAttempts.length);
  }, [completedAttempts]);

  const scoreTrend = useMemo(() => {
    return [...completedAttempts]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-8)
      .map((a) => ({ date: formatDateLabel(new Date(a.createdAt).getTime()), score: a.score }));
  }, [completedAttempts]);

  const subjectPerformance = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    for (const a of completedAttempts) {
      const key = a.subject || "General Test";
      map[key] = map[key] || { total: 0, count: 0 };
      map[key].total += a.score;
      map[key].count += 1;
    }
    return Object.entries(map)
      .map(([subject, v]) => ({ subject, score: Math.round(v.total / Math.max(1, v.count)) }))
      .sort((x, y) => y.score - x.score);
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
            <p className="text-muted-foreground mt-1">Ready to take on today's challenges?</p>
          </div>
          <Button className="gradient-bg rounded-xl" asChild>
            <Link to="/student/tests">
              <Play className="h-4 w-4 mr-2" />
              Browse Tests
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Resume In-Progress Test — prominent */}
      {inProgressAttempt && (
        <Card className="card-soft border-0 border-l-4 border-l-amber-400 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                In Progress
              </p>
              <p className="font-semibold text-foreground mt-0.5">{inProgressAttempt.testTitle}</p>
              <p className="text-sm text-muted-foreground">{inProgressAttempt.subject}</p>
            </div>
            <Button className="gradient-bg rounded-xl shrink-0" asChild>
              <Link to={`/student/tests/${inProgressAttempt.testId}/attempt`}>Continue Test</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Live Tests */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">Available Tests</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/student/tests">
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
        {liveTests.length === 0 ? (
          <Card className="card-soft border-0">
            <CardContent className="p-6 text-center text-muted-foreground text-sm">
              No tests available right now. Check back soon!
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {liveTests.map((test) => (
              <Card key={test.id} className="card-soft border-0 flex flex-col">
                <CardContent className="p-4 flex flex-col gap-3 flex-1">
                  <p className="font-semibold text-sm line-clamp-2 text-foreground">
                    {test.title || "Untitled Test"}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {test.subject && <span>{test.subject}</span>}
                    {test.durationMinutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {test.durationMinutes} min
                      </span>
                    )}
                    {test.questionsCount && <span>{test.questionsCount} Qs</span>}
                  </div>
                  <Button size="sm" className="gradient-bg mt-auto w-full rounded-lg" asChild>
                    <Link to={`/student/tests/${test.id}`}>Start Test</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <StudentMetricCard
          title="Current Rank"
          value={rank ? `#${rank}` : "—"}
          subtitle={totalParticipants ? `out of ${totalParticipants}` : "in your coaching"}
          icon={TrendingUp}
          color="peach"
        />
        <StudentMetricCard
          title="Avg Score"
          value={`${avgScore}/${avgMaxScore}`}
          icon={Target}
          color="yellow"
        />
      </div>

      {/* Leaderboard Preview + Score Trend */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Leaderboard */}
        <Card className="card-soft border-0">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Top Performers
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/student/rankings">
                Full Rankings <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No rankings yet. Be the first!
              </p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry) => {
                  const isMe = entry.studentId === firebaseUser?.uid;
                  const rankColors: Record<number, string> = {
                    1: "text-amber-500",
                    2: "text-slate-500",
                    3: "text-orange-500",
                  };
                  return (
                    <div
                      key={entry.rank}
                      className={`flex items-center gap-3 py-2 px-3 rounded-lg ${isMe ? "bg-primary/10 font-semibold" : ""}`}
                    >
                      <span className={`w-6 text-sm font-bold ${rankColors[entry.rank] || "text-muted-foreground"}`}>
                        #{entry.rank}
                      </span>
                      <span className="flex-1 text-sm truncate">
                        {isMe ? "You" : entry.name.split(" ")[0]}
                      </span>
                      <Badge variant="secondary" className="rounded-full text-xs">
                        {entry.score}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Score Trend */}
        <Card className="card-soft border-0">
          <CardHeader>
            <CardTitle className="text-lg">Score Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
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
      </div>

      {/* Subject Performance */}
      {subjectPerformance.length > 0 && (
        <Card className="card-soft border-0">
          <CardHeader>
            <CardTitle className="text-lg">Subject Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
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
      )}

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
