// pages/admin/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  GraduationCap,
  BookOpen,
  BarChart3,
  Plus,
  Receipt,
  Activity,
  IndianRupee,
  RefreshCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Button } from "@shared/ui/button";
import { toast } from "sonner";

import { useAuth } from "@app/providers/AuthProvider";
import { db } from "@shared/lib/firebase";
import {
  collection,
  getCountFromServer,
  query,
  where,
} from "firebase/firestore";

const API = import.meta.env.VITE_MONKEY_KING_API_URL;
const ADMIN_KEY = import.meta.env.VITE_MONKEY_KING_ADMIN_KEY;

const IN_PROGRESS_STATUSES = ["in-progress", "inprogress", "running", "started"];

type Stats = {
  totalEducators: number;
  totalStudents: number;
  totalAttempts: number;
  activeTrials: number;
  totalRevenue: number;
  revenueThisMonth: number;
};

function fmtRevenue(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function AdminDashboard() {
  const { firebaseUser, loading: authLoading, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalEducators: 0,
    totalStudents: 0,
    totalAttempts: 0,
    activeTrials: 0,
    totalRevenue: 0,
    revenueThisMonth: 0,
  });

  const canView = useMemo(() => {
    return !authLoading && !!firebaseUser?.uid && role === "ADMIN";
  }, [authLoading, firebaseUser?.uid, role]);

  async function loadStats() {
    setLoading(true);
    try {
      const educatorsQ = query(collection(db, "users"), where("role", "==", "EDUCATOR"));
      const studentsQ = query(collection(db, "users"), where("role", "==", "STUDENT"));
      const attemptsQ = query(collection(db, "attempts"));
      const activeTrialsQ = query(
        collection(db, "attempts"),
        where("status", "in", IN_PROGRESS_STATUSES)
      );

      const [educatorsCnt, studentsCnt, attemptsCnt, trialsCnt] = await Promise.all([
        getCountFromServer(educatorsQ),
        getCountFromServer(studentsQ),
        getCountFromServer(attemptsQ),
        getCountFromServer(activeTrialsQ),
      ]);

      let totalRevenue = 0;
      let revenueThisMonth = 0;
      try {
        const res = await fetch(`${API}/api/payment/admin/stats`, {
          headers: { Authorization: `Bearer ${ADMIN_KEY}` },
        });
        if (res.ok) {
          const data = await res.json();
          totalRevenue = data.total_revenue ?? 0;
          revenueThisMonth = data.revenue_this_month ?? 0;
        }
      } catch {
        // revenue is a nice-to-have — silently skip on error
      }

      setStats({
        totalEducators: educatorsCnt.data().count,
        totalStudents: studentsCnt.data().count,
        totalAttempts: attemptsCnt.data().count,
        activeTrials: trialsCnt.data().count,
        totalRevenue,
        revenueThisMonth,
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to load admin stats.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canView) return;
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  if (authLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading…</div>;
  }

  if (!firebaseUser?.uid) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground">You must be logged in.</p>
        <Button asChild>
          <Link to="/login?role=admin">Go to Admin Login</Link>
        </Button>
      </div>
    );
  }

  if (role !== "ADMIN") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground">You do not have access to this page.</p>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Revenue",
      value: loading ? "—" : fmtRevenue(stats.totalRevenue),
      subtitle: loading ? "" : `This month: ${fmtRevenue(stats.revenueThisMonth)}`,
      icon: IndianRupee,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Total Educators",
      value: loading ? "—" : stats.totalEducators.toLocaleString(),
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Total Students",
      value: loading ? "—" : stats.totalStudents.toLocaleString(),
      icon: GraduationCap,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Tests Taken",
      value: loading ? "—" : stats.totalAttempts.toLocaleString(),
      icon: BookOpen,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Active Trials",
      value: loading ? "—" : stats.activeTrials.toLocaleString(),
      subtitle: "In-progress right now",
      icon: Activity,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
  ];

  const quickActions = [
    { label: "Create Test", icon: Plus, path: "/admin/tests/new", variant: "default" as const },
    { label: "Manage Educators", icon: Users, path: "/admin/educators", variant: "outline" as const },
    { label: "Payment Logs", icon: Receipt, path: "/admin/payment-logs", variant: "outline" as const },
    { label: "View Analytics", icon: BarChart3, path: "/admin/analytics", variant: "outline" as const },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Platform overview</p>
        </div>
        <Button variant="outline" className="gap-2 self-start" onClick={loadStats}>
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="border-border/50">
            <CardContent className="p-6">
              <div className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center mb-4`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{stat.title}</p>
              {stat.subtitle && (
                <p className="text-xs text-muted-foreground/70 mt-1">{stat.subtitle}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/50">
        <CardHeader>
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
    </div>
  );
}
