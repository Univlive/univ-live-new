// pages/admin/Analytics.tsx
import { useEffect, useMemo, useState } from "react";
import { Users, GraduationCap, BarChart3, RefreshCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthProvider";
import { db } from "@/lib/firebase";
import {
  Timestamp,
  collection,
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

type AttemptDoc = {
  testTitle?: string;
  status?: string;
  score?: number | null;
  maxScore?: number | null;
  createdAt?: Timestamp | null;
  studentId?: string;
  educatorId?: string;
};

type ActivityItem = {
  id: string;
  message: string;
  timeMs: number;
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

function safeMillis(v: Timestamp | null | undefined) {
  if (!v) return Date.now();
  return v.seconds * 1000;
}

function timeAgo(ms: number) {
  const diff = Math.max(0, Date.now() - ms);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AdminAnalytics() {
  const { firebaseUser, loading: authLoading, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [attemptsToday, setAttemptsToday] = useState(0);
  const [activeStudentsToday, setActiveStudentsToday] = useState(0);
  const [activeEducatorsToday, setActiveEducatorsToday] = useState(0);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [attemptsChart, setAttemptsChart] = useState<Array<{ day: string; attempts: number }>>([]);

  const canView = useMemo(
    () => !authLoading && !!firebaseUser?.uid && role === "ADMIN",
    [authLoading, firebaseUser?.uid, role]
  );

  async function loadData() {
    setLoading(true);
    try {
      const today = startOfTodayTs();
      const since = daysAgoTs(6);

      const [todaySnap, chartSnap, recentSnap] = await Promise.all([
        getDocs(query(collection(db, "attempts"), where("createdAt", ">=", today))),
        getDocs(
          query(
            collection(db, "attempts"),
            where("createdAt", ">=", since),
            orderBy("createdAt", "asc")
          )
        ),
        getDocs(
          query(collection(db, "attempts"), orderBy("createdAt", "desc"), limit(8))
        ),
      ]);

      const studentIds = new Set<string>();
      const educatorIds = new Set<string>();
      todaySnap.docs.forEach((d) => {
        const a = d.data() as AttemptDoc;
        if (a.studentId) studentIds.add(a.studentId);
        if (a.educatorId) educatorIds.add(a.educatorId);
      });
      setAttemptsToday(todaySnap.size);
      setActiveStudentsToday(studentIds.size);
      setActiveEducatorsToday(educatorIds.size);

      // 7-day chart
      const map: Record<string, number> = {};
      const labels: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        map[key] = 0;
        labels.push(key);
      }
      chartSnap.docs.forEach((docSnap) => {
        const a = docSnap.data() as AttemptDoc;
        const ms = safeMillis(a?.createdAt);
        const key = new Date(ms).toISOString().slice(0, 10);
        if (map[key] != null) map[key] += 1;
      });
      setAttemptsChart(
        labels.map((key) => ({
          day: new Date(key).toLocaleDateString(undefined, { day: "2-digit", month: "short" }),
          attempts: map[key] || 0,
        }))
      );

      // Recent activity
      setRecentActivity(
        recentSnap.docs.map((d) => {
          const a = d.data() as AttemptDoc;
          const score =
            a?.score != null && a?.maxScore != null
              ? ` • ${Number(a.score)}/${Number(a.maxScore)}`
              : "";
          return {
            id: d.id,
            message: `${a?.testTitle || "Test"} (${a?.status || "submitted"})${score}`,
            timeMs: safeMillis(a?.createdAt),
          };
        })
      );
    } catch (e) {
      console.error(e);
      toast.error("Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canView) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  if (authLoading) return <div className="text-center py-12 text-muted-foreground">Loading…</div>;
  if (role !== "ADMIN") return <div className="py-12 text-center text-muted-foreground">Access denied.</div>;

  const todayCards = [
    { title: "Attempts Today", value: attemptsToday, icon: BarChart3, color: "text-orange-500", bg: "bg-orange-500/10" },
    { title: "Active Students Today", value: activeStudentsToday, icon: GraduationCap, color: "text-rose-500", bg: "bg-rose-500/10" },
    { title: "Active Educators Today", value: activeEducatorsToday, icon: Users, color: "text-cyan-500", bg: "bg-cyan-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground mt-1">Platform activity and engagement</p>
        </div>
        <Button variant="outline" className="gap-2 self-start" onClick={loadData}>
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {todayCards.map((s) => (
          <Card key={s.title} className="border-border/50">
            <CardContent className="p-6">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-4`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{loading ? "—" : s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Attempts — Last 7 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {attemptsChart.length === 0 ? (
                <div className="h-full rounded-xl border border-dashed border-border flex items-center justify-center text-muted-foreground">
                  No data yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attemptsChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="attempts" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-muted-foreground text-sm">
                No recent activity.
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <Badge variant="secondary" className="rounded-full shrink-0 mt-0.5">
                      attempt
                    </Badge>
                    <div>
                      <p className="text-sm text-foreground">{item.message}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(item.timeMs)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
