import { useEffect, useMemo, useState } from "react";
import {
  Users,
  UserCheck,
  FileText,
  Target,
  TrendingUp,
  IndianRupee,
  ArrowRight,
} from "lucide-react";
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
  Area,
  AreaChart,
} from "recharts";
import { Button } from "@/components/ui/button";
import MetricCard from "@/components/educator/MetricCard";
import ChartCard from "@/components/educator/ChartCard";
import ActivityFeed from "@/components/educator/ActivityFeed";
import EmptyState from "@/components/educator/EmptyState";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { onAuthStateChanged } from "firebase/auth";
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type StudentDoc = {
  createdAt?: Timestamp | null;
  status?: string; // "active" | "inactive"
  isActive?: boolean;
};

type AttemptDoc = {
  createdAt?: Timestamp | null;
  scorePercent?: number; // 0-100
  subject?: string; // "Physics"...
  aiReviewStatus?: "queued" | "in-progress" | "completed" | "failed";
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date) {
  return d.toLocaleString(undefined, { month: "short" });
}

function weekdayLabel(d: Date) {
  return d.toLocaleString(undefined, { weekday: "short" });
}

function safeNum(n: any, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

export default function EducatorDashboard() {
  const [uid, setUid] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string>("Educator");

  // Metrics
  const [totalStudents, setTotalStudents] = useState(0);
  const [activeStudents, setActiveStudents] = useState(0);
  const [testSeriesCount, setTestSeriesCount] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [avgScore, setAvgScore] = useState(0);
  const [revenue, setRevenue] = useState(0);

  const [newStudentsWeek, setNewStudentsWeek] = useState(0);
  const [pendingReviews, setPendingReviews] = useState(0);

  // Deltas for metric cards (simple real deltas)
  const [deltaStudents, setDeltaStudents] = useState(0);
  const [deltaAttempts, setDeltaAttempts] = useState(0);
  const [deltaAvgScore, setDeltaAvgScore] = useState(0);
  const [deltaTestSeries, setDeltaTestSeries] = useState(0);

  // Chart data
  const [studentGrowthData, setStudentGrowthData] = useState<{ month: string; students: number }[]>([]);
  const [attemptsData, setAttemptsData] = useState<{ day: string; attempts: number; avgScore: number }[]>([]);
  const [weakSubjectsData, setWeakSubjectsData] = useState<
    { subject: string; weak: number; moderate: number; strong: number }[]
  >([]);

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, []);

  // Load educator profile (optional)
  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "educators", uid));
        const data = snap.exists() ? (snap.data() as any) : null;

        const fromDoc =
          (data?.name as string) ||
          (data?.fullName as string) ||
          (data?.displayName as string) ||
          "";

        const fromAuth = auth.currentUser?.displayName || "";

        setProfileName(fromDoc || fromAuth || "Educator");
      } catch {
        setProfileName(auth.currentUser?.displayName || "Educator");
      }
    })();
  }, [uid]);

  // Helpers: default axes
  const last6Months = useMemo(() => {
    const arr: Date[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      arr.push(d);
    }
    return arr;
  }, []);

  const last7Days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 6; i >= 0; i--) arr.push(startOfDay(daysAgo(i)));
    return arr;
  }, []);

  // Realtime: Students (for totals + growth + newStudentsWeek)
  useEffect(() => {
    if (!uid) return;

    const studentsRef = collection(db, "educators", uid, "students");

    // Total + active (live)
    const unsubAll = onSnapshot(
      query(studentsRef, orderBy("createdAt", "desc")),
      (snap) => {
        const rows = snap.docs.map((d) => d.data() as StudentDoc);
        setTotalStudents(rows.length);

        const active = rows.filter((s) => s.isActive === true || s.status === "active").length;
        setActiveStudents(active);
      },
      () => toast.error("Failed to load students")
    );

    // Growth (last 6 months)
    const start6m = new Date(last6Months[0].getFullYear(), last6Months[0].getMonth(), 1);
    const unsubGrowth = onSnapshot(
      query(studentsRef, where("createdAt", ">=", Timestamp.fromDate(start6m)), orderBy("createdAt", "asc")),
      (snap) => {
        const bucket: Record<string, number> = {};
        snap.docs.forEach((d) => {
          const s = d.data() as StudentDoc;
          const ts = s.createdAt;
          if (!ts) return;
          const dt = ts.toDate();
          const key = monthKey(dt);
          bucket[key] = (bucket[key] || 0) + 1;
        });

        const data = last6Months.map((m) => {
          const key = monthKey(m);
          return { month: monthLabel(m), students: bucket[key] || 0 };
        });

        // Make it cumulative (growth look)
        let cum = 0;
        const cumulative = data.map((x) => {
          cum += x.students;
          return { ...x, students: cum };
        });

        setStudentGrowthData(cumulative);
      }
    );

    // New students this week + delta vs previous week
    const weekStart = startOfDay(daysAgo(7));
    const prevWeekStart = startOfDay(daysAgo(14));

    const unsubWeek = onSnapshot(
      query(studentsRef, where("createdAt", ">=", Timestamp.fromDate(prevWeekStart)), orderBy("createdAt", "asc")),
      (snap) => {
        let current = 0;
        let prev = 0;
        snap.docs.forEach((d) => {
          const s = d.data() as StudentDoc;
          const ts = s.createdAt;
          if (!ts) return;
          const t = ts.toDate().getTime();
          if (t >= weekStart.getTime()) current += 1;
          else prev += 1;
        });
        setNewStudentsWeek(current);
        setDeltaStudents(current - prev);
      }
    );

    return () => {
      unsubAll();
      unsubGrowth();
      unsubWeek();
    };
  }, [uid, last6Months]);

  // Realtime: Imported tests count + delta (week)
  useEffect(() => {
    if (!uid) return;

    const ref = collection(db, "educators", uid, "importedTests");
    const weekStart = startOfDay(daysAgo(7));
    const prevWeekStart = startOfDay(daysAgo(14));

    const unsub = onSnapshot(
      query(ref, where("createdAt", ">=", Timestamp.fromDate(prevWeekStart)), orderBy("createdAt", "desc")),
      async (snap) => {
        // Count of all imported tests (use separate query without date in real app;
        // but for now we set live count using snapshot + additional getDocs)
        try {
          const allSnap = await getDocs(query(ref, orderBy("createdAt", "desc"), limit(500)));
          setTestSeriesCount(allSnap.size);
        } catch {
          setTestSeriesCount(snap.size); // fallback
        }

        let current = 0;
        let prev = 0;
        snap.docs.forEach((d) => {
          const data = d.data() as any;
          const ts = data?.createdAt as Timestamp | undefined;
          if (!ts) return;
          const t = ts.toDate().getTime();
          if (t >= weekStart.getTime()) current += 1;
          else prev += 1;
        });
        setDeltaTestSeries(current - prev);
      }
    );

    return () => unsub();
  }, [uid]);

  // Realtime: Attempts (counts + charts + avg score + pending reviews)
  useEffect(() => {
    if (!uid) return;

    const attemptsRef = collection(db, "educators", uid, "attempts");

    const weekStart = startOfDay(daysAgo(7));
    const prevWeekStart = startOfDay(daysAgo(14));

    // We listen to last 14 days for deltas + charts
    const unsub = onSnapshot(
      query(
        attemptsRef,
        where("createdAt", ">=", Timestamp.fromDate(prevWeekStart)),
        orderBy("createdAt", "asc")
      ),
      async (snap) => {
        const attempts = snap.docs.map((d) => d.data() as AttemptDoc);

        // total attempts (approx live, try to fetch more)
        try {
          const allSnap = await getDocs(query(attemptsRef, orderBy("createdAt", "desc"), limit(1000)));
          setTotalAttempts(allSnap.size);
        } catch {
          setTotalAttempts(attempts.length);
        }

        // pending reviews
        const pending = attempts.filter((a) => a.aiReviewStatus === "queued" || a.aiReviewStatus === "in-progress").length;
        setPendingReviews(pending);

        // delta attempts week vs prev week
        let curA = 0;
        let prevA = 0;
        attempts.forEach((a) => {
          const ts = a.createdAt;
          if (!ts) return;
          const t = ts.toDate().getTime();
          if (t >= weekStart.getTime()) curA += 1;
          else prevA += 1;
        });
        setDeltaAttempts(curA - prevA);

        // avg score (use last 200 docs overall if possible)
        try {
          const recent = await getDocs(query(attemptsRef, orderBy("createdAt", "desc"), limit(200)));
          const scores = recent.docs
            .map((d) => (d.data() as AttemptDoc).scorePercent)
            .map((x) => safeNum(x, NaN))
            .filter((x) => Number.isFinite(x));
          const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
          setAvgScore(Math.round(avg));
        } catch {
          const scores = attempts
            .map((a) => safeNum(a.scorePercent, NaN))
            .filter((x) => Number.isFinite(x));
          const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
          setAvgScore(Math.round(avg));
        }

        // avg score delta (week vs prev week)
        const curScores: number[] = [];
        const prevScores: number[] = [];
        attempts.forEach((a) => {
          const ts = a.createdAt;
          if (!ts) return;
          const sc = safeNum(a.scorePercent, NaN);
          if (!Number.isFinite(sc)) return;
          const t = ts.toDate().getTime();
          if (t >= weekStart.getTime()) curScores.push(sc);
          else prevScores.push(sc);
        });
        const curAvg = curScores.length ? curScores.reduce((a, b) => a + b, 0) / curScores.length : 0;
        const prevAvg = prevScores.length ? prevScores.reduce((a, b) => a + b, 0) / prevScores.length : 0;
        setDeltaAvgScore(Math.round(curAvg - prevAvg));

        // Attempts & Scores chart (last 7 days)
        const byDay: Record<string, { attempts: number; scores: number[] }> = {};
        last7Days.forEach((d) => {
          byDay[d.toISOString()] = { attempts: 0, scores: [] };
        });

        attempts.forEach((a) => {
          const ts = a.createdAt;
          if (!ts) return;
          const dt = startOfDay(ts.toDate());
          const key = dt.toISOString();
          if (!byDay[key]) return;

          byDay[key].attempts += 1;
          const sc = safeNum(a.scorePercent, NaN);
          if (Number.isFinite(sc)) byDay[key].scores.push(sc);
        });

        const chart = last7Days.map((d) => {
          const key = d.toISOString();
          const bucket = byDay[key] || { attempts: 0, scores: [] };
          const avg = bucket.scores.length
            ? bucket.scores.reduce((a, b) => a + b, 0) / bucket.scores.length
            : 0;
          return {
            day: weekdayLabel(d),
            attempts: bucket.attempts,
            avgScore: Math.round(avg),
          };
        });
        setAttemptsData(chart);

        // Subject performance heatmap (top 4 subjects in last 14 days)
        const subjectBuckets: Record<
          string,
          { weak: number; moderate: number; strong: number }
        > = {};

        attempts.forEach((a) => {
          const subj = (a.subject || "General").toString();
          const sc = safeNum(a.scorePercent, NaN);
          if (!Number.isFinite(sc)) return;

          if (!subjectBuckets[subj]) subjectBuckets[subj] = { weak: 0, moderate: 0, strong: 0 };
          if (sc < 40) subjectBuckets[subj].weak += 1;
          else if (sc < 70) subjectBuckets[subj].moderate += 1;
          else subjectBuckets[subj].strong += 1;
        });

        const top = Object.entries(subjectBuckets)
          .sort((a, b) => {
            const ta = a[1].weak + a[1].moderate + a[1].strong;
            const tb = b[1].weak + b[1].moderate + b[1].strong;
            return tb - ta;
          })
          .slice(0, 4)
          .map(([subject, v]) => ({ subject, ...v }));

        // Fallback data to preserve chart look if no attempts yet
        setWeakSubjectsData(
          top.length
            ? top
            : [
                { subject: "Physics", weak: 0, moderate: 0, strong: 0 },
                { subject: "Chemistry", weak: 0, moderate: 0, strong: 0 },
                { subject: "Biology", weak: 0, moderate: 0, strong: 0 },
                { subject: "Maths", weak: 0, moderate: 0, strong: 0 },
              ]
        );
      },
      () => toast.error("Failed to load attempts")
    );

    return () => unsub();
  }, [uid, last7Days]);

  // Revenue: keep placeholder for now (hook payment later)
  useEffect(() => {
    setRevenue(0);
  }, []);

  const hasData = useMemo(() => {
    // Show empty state only when educator has no test series yet
    return testSeriesCount > 0;
  }, [testSeriesCount]);

  if (!uid) {
    return (
      <EmptyState
        icon={FileText}
        title="Please login as Educator"
        description="You must be logged in to view your dashboard."
        actionLabel="Go to Login"
        onAction={() => (window.location.href = "/login?role=educator")}
      />
    );
  }

  if (!hasData) {
    return (
      <EmptyState
        icon={FileText}
        title="Let's start by importing your first test series"
        description="Import test series from our extensive library or create your own to get started with your coaching journey."
        actionLabel="Import Test Series"
        onAction={() => (window.location.href = "/educator/test-series")}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="gradient-bg rounded-2xl p-6 text-white relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnYyaDR2MmgtNHYtMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-display font-bold mb-2">
            Welcome back, {profileName}! 👋
          </h1>
          <p className="text-white/80 text-sm sm:text-base max-w-xl">
            Your coaching is growing! You have{" "}
            <span className="font-semibold text-white">{newStudentsWeek}</span> new students this week and{" "}
            <span className="font-semibold text-white">{pendingReviews}</span> pending AI reviews.
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <Button
              size="sm"
              className="bg-white/20 hover:bg-white/30 text-white border-0"
              onClick={() => toast.info("Hook this to /educator/analytics or pending reviews view")}
            >
              View Pending Reviews
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard
          title="Total Students"
          value={totalStudents.toLocaleString()}
          change={{
            value: Math.abs(deltaStudents),
            type: deltaStudents >= 0 ? "increase" : "decrease",
          }}
          icon={Users}
          iconColor="text-blue-500"
          delay={0}
        />
        <MetricCard
          title="Active Students"
          value={activeStudents.toLocaleString()}
          change={{ value: 0, type: "increase" }}
          icon={UserCheck}
          iconColor="text-green-500"
          delay={0.1}
        />
        <MetricCard
          title="Test Series"
          value={testSeriesCount.toLocaleString()}
          change={{
            value: Math.abs(deltaTestSeries),
            type: deltaTestSeries >= 0 ? "increase" : "decrease",
          }}
          icon={FileText}
          iconColor="text-purple-500"
          delay={0.2}
        />
        <MetricCard
          title="Total Attempts"
          value={totalAttempts.toLocaleString()}
          change={{
            value: Math.abs(deltaAttempts),
            type: deltaAttempts >= 0 ? "increase" : "decrease",
          }}
          icon={Target}
          iconColor="text-orange-500"
          delay={0.3}
        />
        <MetricCard
          title="Avg Score"
          value={`${avgScore}%`}
          change={{
            value: Math.abs(deltaAvgScore),
            type: deltaAvgScore >= 0 ? "increase" : "decrease",
          }}
          icon={TrendingUp}
          iconColor="text-cyan-500"
          delay={0.4}
        />
        <MetricCard
          title="Revenue"
          value={revenue > 0 ? `₹${(revenue / 100000).toFixed(1)}L` : "—"}
          change={{ value: 0, type: "increase" }}
          icon={IndianRupee}
          iconColor="text-emerald-500"
          delay={0.5}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Student Growth" showPeriodSelect delay={0.2}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={studentGrowthData}>
                <defs>
                  <linearGradient id="studentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(204, 91%, 56%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(204, 91%, 56%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="month"
                  className="text-xs fill-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  className="text-xs fill-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="students"
                  stroke="hsl(204, 91%, 56%)"
                  strokeWidth={2}
                  fill="url(#studentGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Attempts & Scores" showPeriodSelect delay={0.3}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attemptsData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="day"
                  className="text-xs fill-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  className="text-xs fill-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                  }}
                />
                <Bar
                  dataKey="attempts"
                  fill="hsl(184, 87%, 65%)"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="avgScore"
                  stroke="hsl(211, 91%, 42%)"
                  strokeWidth={2}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartCard title="Subject Performance Heatmap" delay={0.4}>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weakSubjectsData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" className="text-xs fill-muted-foreground" />
                  <YAxis
                    dataKey="subject"
                    type="category"
                    className="text-xs fill-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                    }}
                  />
                  <Bar dataKey="weak" stackId="a" fill="hsl(0, 84%, 60%)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="moderate" stackId="a" fill="hsl(38, 92%, 50%)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="strong" stackId="a" fill="hsl(142, 76%, 36%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-red-500" />
                <span className="text-xs text-muted-foreground">Weak</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-amber-500" />
                <span className="text-xs text-muted-foreground">Moderate</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-600" />
                <span className="text-xs text-muted-foreground">Strong</span>
              </div>
            </div>
          </ChartCard>
        </div>

        <ActivityFeed delay={0.5} />
      </div>
    </div>
  );
}

