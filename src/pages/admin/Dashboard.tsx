// pages/admin/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  GraduationCap,
  BookOpen,
  BarChart3,
  Plus,
  Eye,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  RefreshCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthProvider";
import { db } from "@/lib/firebase";
import { resolveAttemptScore } from "@/lib/attemptScore";
import {
  Timestamp,
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Stats = {
  totalEducators: number;
  totalStudents: number;
  totalTests: number;
  totalAttempts: number;
  attemptsToday: number;
};

type ActivityItem = {
  id: string;
  message: string;
  timeMs: number;
  badge?: "attempt" | "test" | "user" | "support";
};

function startOfTodayTs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

function daysAgoTs(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

function safeMillis(v: any) {
  if (!v) return Date.now();
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v?.seconds === "number") return v.seconds * 1000;
  if (typeof v === "number") return v;
  return Date.now();
}

function timeAgo(ms: number) {
  const diff = Math.max(0, Date.now() - ms);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

export default function AdminDashboard() {
  const { firebaseUser, loading: authLoading, role } = useAuth();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalEducators: 0,
    totalStudents: 0,
    totalTests: 0,
    totalAttempts: 0,
    attemptsToday: 0,
  });

  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [attemptsChart, setAttemptsChart] = useState<Array<{ day: string; attempts: number }>>(
    []
  );

  const canView = useMemo(() => {
    return !authLoading && !!firebaseUser?.uid && role === "ADMIN";
  }, [authLoading, firebaseUser?.uid, role]);

  async function loadStats() {
    setLoading(true);
    try {
      // Users
      const educatorsQ = query(collection(db, "users"), where("role", "==", "EDUCATOR"));
      const studentsQ = query(collection(db, "users"), where("role", "==", "STUDENT"));

      // Global tests created by admin
      const testsQ = query(collection(db, "test_series"), where("authorId", "==", "admin"));

      // Attempts
      const attemptsQ = query(collection(db, "attempts"));
      const attemptsTodayQ = query(collection(db, "attempts"), where("createdAt", ">=", startOfTodayTs()));

      const [educatorsCnt, studentsCnt, testsCnt, attemptsCnt, attemptsTodayCnt] = await Promise.all([
        getCountFromServer(educatorsQ),
        getCountFromServer(studentsQ),
        getCountFromServer(testsQ),
        getCountFromServer(attemptsQ),
        getCountFromServer(attemptsTodayQ),
      ]);

      setStats({
        totalEducators: educatorsCnt.data().count,
        totalStudents: studentsCnt.data().count,
        totalTests: testsCnt.data().count,
        totalAttempts: attemptsCnt.data().count,
        attemptsToday: attemptsTodayCnt.data().count,
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to load admin stats.");
    } finally {
      setLoading(false);
    }
  }

  async function loadRecentActivity() {
    try {
      // Latest attempts
      const qAttempts = query(collection(db, "attempts"), orderBy("createdAt", "desc"), limit(6));
      const snap = await getDocs(qAttempts);

      const rows: ActivityItem[] = snap.docs.map((d) => {
        const a = d.data() as any;
        const testTitle = String(a?.testTitle || "Test");
        const status = String(a?.status || "submitted");
        const { score, maxScore } = resolveAttemptScore(a);
        const scoreText = maxScore > 0 ? ` • Score ${score}/${maxScore}` : score !== 0 ? ` • Score ${score}` : "";

        return {
          id: d.id,
          badge: "attempt",
          message: `New attempt: ${testTitle} (${status})${scoreText}`,
          timeMs: safeMillis(a?.createdAt),
        };
      });

      setRecentActivity(rows);
    } catch (e) {
      console.error(e);
      setRecentActivity([]);
    }
  }

  async function loadAttemptsChart() {
    try {
      // Last 7 days attempts
      const since = daysAgoTs(6); // today + 6 previous days = 7 bars
      const q7 = query(collection(db, "attempts"), where("createdAt", ">=", since), orderBy("createdAt", "asc"));
      const snap = await getDocs(q7);

      const map: Record<string, number> = {};
      const labels: string[] = [];

      // build labels for last 7 days
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        map[key] = 0;
        labels.push(key);
      }

      snap.docs.forEach((docSnap) => {
        const a = docSnap.data() as any;
        const ms = safeMillis(a?.createdAt);
        const key = new Date(ms).toISOString().slice(0, 10);
        if (map[key] != null) map[key] += 1;
      });

      const chart = labels.map((key) => {
        const d = new Date(key);
        const label = d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
        return { day: label, attempts: map[key] || 0 };
      });

      setAttemptsChart(chart);
    } catch (e) {
      console.error(e);
      setAttemptsChart([]);
    }
  }

  useEffect(() => {
    if (!canView) return;
    loadStats();
    loadRecentActivity();
    loadAttemptsChart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  if (authLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading…</div>;
  }

  if (!firebaseUser?.uid) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">You must be logged in.</p>
        </div>
        <Button className="gradient-bg text-white" asChild>
          <Link to="/login?role=admin">Go to Admin Login</Link>
        </Button>
      </div>
    );
  }

  if (role !== "ADMIN") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">You do not have access to this page.</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/">Go Home</Link>
        </Button>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Educators",
      value: stats.totalEducators,
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      hint: "users.role = EDUCATOR",
    },
    {
      title: "Total Students",
      value: stats.totalStudents.toLocaleString(),
      icon: GraduationCap,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      hint: "users.role = STUDENT",
    },
    {
      title: "Global Tests",
      value: stats.totalTests,
      icon: BookOpen,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      hint: "test_series.authorId = admin",
    },
    {
      title: "Total Attempts",
      value: stats.totalAttempts.toLocaleString(),
      icon: BarChart3,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      hint: "attempts (all)",
    },
  ];

  const quickActions = [
    { label: "Create Global Test", icon: Plus, path: "/admin/tests/new", variant: "default" as const },
    { label: "View Test Bank", icon: Eye, path: "/admin/tests", variant: "outline" as const },
    { label: "Support (Soon)", icon: MessageSquare, path: "/admin/support", variant: "outline" as const },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of the UNIV.LIVE platform</p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            Attempts Today: {stats.attemptsToday}
          </Badge>
          <Button variant="outline" className="gap-2" onClick={() => { loadStats(); loadRecentActivity(); loadAttemptsChart(); }}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="border-border/50">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>

                <div className="text-xs text-muted-foreground text-right">
                  {loading ? (
                    <span className="inline-flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      loading…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <TrendingDown className="h-3 w-3 opacity-50" />
                      live
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <p className="text-2xl font-bold text-foreground">{loading ? "—" : stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">{stat.hint}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {quickActions.map((action) => (
              <Button key={action.label} variant={action.variant} asChild className="gap-2">
                <Link to={action.path}>
                  <action.icon className="h-4 w-4" />
                  {action.label}
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attempts Chart */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Attempts (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {attemptsChart.length === 0 ? (
                <div className="h-full rounded-xl border border-dashed border-border flex items-center justify-center text-muted-foreground">
                  No chart data yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attemptsChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="attempts" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-muted-foreground">
                No recent activity yet.
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Badge variant="secondary" className="rounded-full">
                        {item.badge || "event"}
                      </Badge>
                      <div>
                        <p className="text-sm text-foreground">{item.message}</p>
                        <p className="text-xs text-muted-foreground">{timeAgo(item.timeMs)}</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(item.timeMs).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Firestore Collections Used</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <span className="font-medium text-foreground">users</span> → role: ADMIN / EDUCATOR / STUDENT
          </p>
          <p>
            <span className="font-medium text-foreground">test_series</span> → admin tests have authorId = "admin"
          </p>
          <p>
            <span className="font-medium text-foreground">attempts</span> → createdAt, status, testTitle, score, maxScore, educatorId, studentId
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

