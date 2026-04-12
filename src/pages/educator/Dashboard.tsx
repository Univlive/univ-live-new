import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  UserCheck,
  FileText,
  Target,
  TrendingUp,
  Clock3,
  KeyRound,
  ClipboardCheck,
  ArrowRight,
  Layers3,
  MessageSquare,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MetricCard from "@/components/educator/MetricCard";
import ChartCard from "@/components/educator/ChartCard";
import ActivityFeed, { type EducatorActivity } from "@/components/educator/ActivityFeed";
import EmptyState from "@/components/educator/EmptyState";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthProvider";

type StudentDoc = {
  id: string;
  name?: string;
  email?: string;
  status?: string;
  isActive?: boolean;
  createdAt?: any;
  joinedAt?: any;
};

type TestDoc = {
  id: string;
  title?: string;
  subject?: string;
  createdAt?: any;
  isPublished?: boolean;
  questionsCount?: number;
};

type AttemptDoc = {
  id: string;
  studentId?: string;
  testId?: string;
  testTitle?: string;
  subject?: string;
  status?: string;
  createdAt?: any;
  updatedAt?: any;
  submittedAt?: any;
  score?: number;
  maxScore?: number;
  accuracy?: number;
  timeTakenSec?: number;
  aiReviewStatus?: "queued" | "in-progress" | "completed" | "failed";
};

type AccessCodeDoc = {
  id: string;
  code?: string;
  testSeriesTitle?: string;
  testSeries?: string;
  maxUses?: number;
  usesUsed?: number;
  expiresAt?: any;
  createdAt?: any;
};

type SeatDoc = {
  id: string;
  status?: string;
  assignedAt?: any;
  updatedAt?: any;
};

type SeatTransactionDoc = {
  id: string;
  transactionId?: string;
  newSeatLimit?: number;
  previousSeatLimit?: number;
  updatedAt?: any;
};

type SupportThreadDoc = {
  id: string;
  studentId?: string;
  subject?: string;
  lastMessage?: string;
  lastMessageAt?: any;
  unreadCountEducator?: number;
};

type EducatorProfileDoc = {
  displayName?: string;
  fullName?: string;
  name?: string;
  coachingName?: string;
  seatLimit?: number;
  tenantSlug?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function safeNum(value: any, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toMillis(value: any): number | null {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return null;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * DAY_MS);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return date.toLocaleString(undefined, { month: "short" });
}

function weekdayLabel(date: Date) {
  return date.toLocaleString(undefined, { weekday: "short" });
}

function relativeTime(ms: number | null) {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  if (diff < 60 * 1000) return "Just now";
  if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.round(diff / (60 * 1000)))}m ago`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.max(1, Math.round(diff / (60 * 60 * 1000)))}h ago`;
  return `${Math.max(1, Math.round(diff / DAY_MS))}d ago`;
}

function isStudentActive(student: StudentDoc) {
  const status = String(student.status || "").toUpperCase();
  return student.isActive === true || status === "ACTIVE" || status === "ACTIVE_STUDENT";
}

function isAttemptCompleted(status?: string) {
  const normalized = String(status || "").toLowerCase();
  return normalized === "submitted" || normalized === "completed" || normalized === "finished";
}

function normalizeAccuracy(attempt: AttemptDoc) {
  const direct = Number(attempt.accuracy);
  if (Number.isFinite(direct)) {
    const pct = direct <= 1.01 ? direct * 100 : direct;
    return Math.max(0, Math.min(100, Math.round(pct)));
  }

  const score = safeNum(attempt.score, 0);
  const maxScore = safeNum(attempt.maxScore, 0);
  if (!maxScore) return 0;
  return Math.max(0, Math.min(100, Math.round((score / maxScore) * 100)));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentChange(current: number, previous: number) {
  if (current <= 0 && previous <= 0) return 0;
  if (previous <= 0) return 100;
  return Math.round(((current - previous) / previous) * 100);
}

function countInWindow<T>(items: T[], getMillis: (item: T) => number | null, startMs: number, endMs: number) {
  return items.filter((item) => {
    const value = getMillis(item);
    return value != null && value >= startMs && value < endMs;
  }).length;
}

function meanInWindow<T>(items: T[], getMillis: (item: T) => number | null, getValue: (item: T) => number | null, startMs: number, endMs: number) {
  const values = items
    .filter((item) => {
      const value = getMillis(item);
      return value != null && value >= startMs && value < endMs;
    })
    .map((item) => getValue(item))
    .filter((value): value is number => value != null && Number.isFinite(value));

  return average(values);
}

function completionRateInWindow(items: AttemptDoc[], startMs: number, endMs: number) {
  const relevant = items.filter((item) => {
    const createdAt = toMillis(item.createdAt || item.submittedAt || item.updatedAt);
    return createdAt != null && createdAt >= startMs && createdAt < endMs;
  });
  if (!relevant.length) return 0;
  const completed = relevant.filter((item) => isAttemptCompleted(item.status)).length;
  return Math.round((completed / relevant.length) * 100);
}

function formatMinutes(totalSeconds: number) {
  if (!totalSeconds) return "0 min";
  const mins = Math.round(totalSeconds / 60);
  return `${mins} min`;
}

function accessCodeStatus(code: AccessCodeDoc) {
  const maxUses = safeNum(code.maxUses, 0);
  const used = safeNum(code.usesUsed, 0);
  const expiresAt = toMillis(code.expiresAt);
  const isExpired = expiresAt != null && expiresAt < Date.now();
  if (maxUses > 0 && used >= maxUses) return "exhausted";
  if (isExpired) return "expired";
  return "active";
}

export default function EducatorDashboard() {
  const navigate = useNavigate();
  const { firebaseUser, profile, loading: authLoading } = useAuth();

  const uid = firebaseUser?.uid || null;

  const [educatorDoc, setEducatorDoc] = useState<EducatorProfileDoc | null>(null);
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [tests, setTests] = useState<TestDoc[]>([]);
  const [attempts, setAttempts] = useState<AttemptDoc[]>([]);
  const [accessCodes, setAccessCodes] = useState<AccessCodeDoc[]>([]);
  const [seats, setSeats] = useState<SeatDoc[]>([]);
  const [seatTransactions, setSeatTransactions] = useState<SeatTransactionDoc[]>([]);
  const [threads, setThreads] = useState<SupportThreadDoc[]>([]);

  const [profileLoaded, setProfileLoaded] = useState(false);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [testsLoaded, setTestsLoaded] = useState(false);
  const [attemptsLoaded, setAttemptsLoaded] = useState(false);
  const [accessCodesLoaded, setAccessCodesLoaded] = useState(false);
  const [seatsLoaded, setSeatsLoaded] = useState(false);
  const [seatTxLoaded, setSeatTxLoaded] = useState(false);
  const [threadsLoaded, setThreadsLoaded] = useState(false);

  useEffect(() => {
    if (!uid) {
      setEducatorDoc(null);
      setStudents([]);
      setTests([]);
      setAttempts([]);
      setAccessCodes([]);
      setSeats([]);
      setSeatTransactions([]);
      setThreads([]);
      setProfileLoaded(false);
      setStudentsLoaded(false);
      setTestsLoaded(false);
      setAttemptsLoaded(false);
      setAccessCodesLoaded(false);
      setSeatsLoaded(false);
      setSeatTxLoaded(false);
      setThreadsLoaded(false);
      return;
    }

    const unsubProfile = onSnapshot(
      doc(db, "educators", uid),
      (snap) => {
        setEducatorDoc(snap.exists() ? (snap.data() as EducatorProfileDoc) : null);
        setProfileLoaded(true);
      },
      () => {
        setEducatorDoc(null);
        setProfileLoaded(true);
      }
    );

    const unsubStudents = onSnapshot(
      collection(db, "educators", uid, "students"),
      (snap) => {
        setStudents(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        setStudentsLoaded(true);
      },
      () => {
        setStudents([]);
        setStudentsLoaded(true);
      }
    );

    const unsubTests = onSnapshot(
      collection(db, "educators", uid, "my_tests"),
      (snap) => {
        setTests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        setTestsLoaded(true);
      },
      () => {
        setTests([]);
        setTestsLoaded(true);
      }
    );

    const unsubAttempts = onSnapshot(
      query(collection(db, "attempts"), where("educatorId", "==", uid)),
      (snap) => {
        setAttempts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        setAttemptsLoaded(true);
      },
      () => {
        setAttempts([]);
        setAttemptsLoaded(true);
      }
    );

    const unsubAccessCodes = onSnapshot(
      collection(db, "educators", uid, "accessCodes"),
      (snap) => {
        setAccessCodes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        setAccessCodesLoaded(true);
      },
      () => {
        setAccessCodes([]);
        setAccessCodesLoaded(true);
      }
    );

    const unsubSeats = onSnapshot(
      collection(db, "educators", uid, "billingSeats"),
      (snap) => {
        setSeats(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        setSeatsLoaded(true);
      },
      () => {
        setSeats([]);
        setSeatsLoaded(true);
      }
    );

    const unsubSeatTx = onSnapshot(
      collection(db, "educators", uid, "seatTransactions"),
      (snap) => {
        setSeatTransactions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        setSeatTxLoaded(true);
      },
      () => {
        setSeatTransactions([]);
        setSeatTxLoaded(true);
      }
    );

    const unsubThreads = onSnapshot(
      query(collection(db, "support_threads"), where("educatorId", "==", uid)),
      (snap) => {
        setThreads(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        setThreadsLoaded(true);
      },
      () => {
        setThreads([]);
        setThreadsLoaded(true);
      }
    );

    return () => {
      unsubProfile();
      unsubStudents();
      unsubTests();
      unsubAttempts();
      unsubAccessCodes();
      unsubSeats();
      unsubSeatTx();
      unsubThreads();
    };
  }, [uid]);

  const ready =
    profileLoaded &&
    studentsLoaded &&
    testsLoaded &&
    attemptsLoaded &&
    accessCodesLoaded &&
    seatsLoaded &&
    seatTxLoaded &&
    threadsLoaded;

  const displayName = useMemo(() => {
    return (
      educatorDoc?.displayName ||
      educatorDoc?.fullName ||
      educatorDoc?.name ||
      profile?.displayName ||
      firebaseUser?.displayName ||
      "Educator"
    );
  }, [educatorDoc, profile, firebaseUser]);

  const studentNameMap = useMemo(() => {
    const out: Record<string, string> = {};
    students.forEach((student) => {
      out[student.id] = student.name || student.email || "Learner";
    });
    return out;
  }, [students]);

  const seatLimit = Math.max(0, safeNum(educatorDoc?.seatLimit, 0));
  const usedSeats = useMemo(
    () => seats.filter((seat) => String(seat.status || "").toLowerCase() === "active").length,
    [seats]
  );
  const seatUtilization = seatLimit > 0 ? Math.round((usedSeats / seatLimit) * 100) : 0;

  const totalStudents = students.length;
  const activeStudents = students.filter(isStudentActive).length;
  const totalTests = tests.length;
  const totalAttempts = attempts.length;
  const completedAttempts = attempts.filter((attempt) => isAttemptCompleted(attempt.status));
  const completionRate = totalAttempts > 0 ? Math.round((completedAttempts.length / totalAttempts) * 100) : 0;
  const avgScore = Math.round(average(completedAttempts.map((a) => safeNum(a.score, 0))));
  const avgTimeSec = Math.round(average(completedAttempts.map((attempt) => safeNum(attempt.timeTakenSec, 0)).filter(Boolean)));
  const pendingReviews = completedAttempts.filter((attempt) => {
    const status = String(attempt.aiReviewStatus || "queued").toLowerCase();
    return status === "queued" || status === "in-progress";
  }).length;
  const activeAccessCodes = accessCodes.filter((code) => accessCodeStatus(code) === "active").length;
  const unreadMessages = threads.reduce((sum, thread) => sum + safeNum(thread.unreadCountEducator, 0), 0);

  const currentPeriodStart = Date.now() - 30 * DAY_MS;
  const previousPeriodStart = Date.now() - 60 * DAY_MS;
  const currentPeriodEnd = Date.now();
  const previousPeriodEnd = currentPeriodStart;

  const deltaStudents = percentChange(
    countInWindow(students, (student) => toMillis(student.joinedAt || student.createdAt), currentPeriodStart, currentPeriodEnd),
    countInWindow(students, (student) => toMillis(student.joinedAt || student.createdAt), previousPeriodStart, previousPeriodEnd)
  );

  const deltaTests = percentChange(
    countInWindow(tests, (test) => toMillis(test.createdAt), currentPeriodStart, currentPeriodEnd),
    countInWindow(tests, (test) => toMillis(test.createdAt), previousPeriodStart, previousPeriodEnd)
  );

  const deltaAttempts = percentChange(
    countInWindow(attempts, (attempt) => toMillis(attempt.createdAt), currentPeriodStart, currentPeriodEnd),
    countInWindow(attempts, (attempt) => toMillis(attempt.createdAt), previousPeriodStart, previousPeriodEnd)
  );

  const deltaAvgScore = percentChange(
    meanInWindow(
      completedAttempts,
      (attempt) => toMillis(attempt.submittedAt || attempt.updatedAt || attempt.createdAt),
      (attempt) => safeNum(attempt.score, 0),
      currentPeriodStart,
      currentPeriodEnd
    ),
    meanInWindow(
      completedAttempts,
      (attempt) => toMillis(attempt.submittedAt || attempt.updatedAt || attempt.createdAt),
      (attempt) => safeNum(attempt.score, 0),
      previousPeriodStart,
      previousPeriodEnd
    )
  );

  const deltaCompletionRate = percentChange(
    completionRateInWindow(attempts, currentPeriodStart, currentPeriodEnd),
    completionRateInWindow(attempts, previousPeriodStart, previousPeriodEnd)
  );

  const last6Months = useMemo(() => {
    const rows: Date[] = [];
    const now = new Date();
    for (let offset = 5; offset >= 0; offset -= 1) {
      rows.push(new Date(now.getFullYear(), now.getMonth() - offset, 1));
    }
    return rows;
  }, []);

  const studentGrowthData = useMemo(() => {
    const bucket: Record<string, number> = {};
    students.forEach((student) => {
      const ms = toMillis(student.joinedAt || student.createdAt);
      if (ms == null) return;
      const key = monthKey(new Date(ms));
      bucket[key] = (bucket[key] || 0) + 1;
    });

    let cumulative = 0;
    return last6Months.map((date) => {
      cumulative += bucket[monthKey(date)] || 0;
      return {
        month: monthLabel(date),
        students: cumulative,
      };
    });
  }, [students, last6Months]);

  const last7Days = useMemo(() => {
    const rows: Date[] = [];
    for (let offset = 6; offset >= 0; offset -= 1) rows.push(startOfDay(daysAgo(offset)));
    return rows;
  }, []);

  const attemptsData = useMemo(() => {
    const bucket: Record<string, { attempts: number; scores: number[] }> = {};
    last7Days.forEach((date) => {
      bucket[date.toISOString()] = { attempts: 0, scores: [] };
    });

    attempts.forEach((attempt) => {
      const ms = toMillis(attempt.createdAt || attempt.submittedAt || attempt.updatedAt);
      if (ms == null) return;
      const key = startOfDay(new Date(ms)).toISOString();
      if (!bucket[key]) return;
      bucket[key].attempts += 1;
      if (isAttemptCompleted(attempt.status)) bucket[key].scores.push(safeNum(attempt.score, 0));
    });

    return last7Days.map((date) => {
      const key = date.toISOString();
      const row = bucket[key] || { attempts: 0, scores: [] };
      return {
        day: weekdayLabel(date),
        attempts: row.attempts,
        avgScore: Math.round(average(row.scores)),
      };
    });
  }, [attempts, last7Days]);

  const subjectPerformanceData = useMemo(() => {
    const bucket: Record<string, { weak: number; moderate: number; strong: number }> = {};

    completedAttempts.forEach((attempt) => {
      const subject = String(attempt.subject || "General");
      const sc = safeNum(attempt.score, 0);
      const mx = safeNum(attempt.maxScore, 0);
      const pct = mx > 0 ? Math.round((sc / mx) * 100) : 0;
      if (!bucket[subject]) bucket[subject] = { weak: 0, moderate: 0, strong: 0 };
      if (pct < 40) bucket[subject].weak += 1;
      else if (pct < 70) bucket[subject].moderate += 1;
      else bucket[subject].strong += 1;
    });

    const rows = Object.entries(bucket)
      .map(([subject, value]) => ({ subject, ...value, total: value.weak + value.moderate + value.strong }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map(({ total, ...rest }) => rest);

    return rows.length
      ? rows
      : [
          { subject: "Physics", weak: 0, moderate: 0, strong: 0 },
          { subject: "Chemistry", weak: 0, moderate: 0, strong: 0 },
          { subject: "Biology", weak: 0, moderate: 0, strong: 0 },
        ];
  }, [completedAttempts]);

  const topTestsData = useMemo(() => {
    const bucket: Record<string, { attempts: number; scores: number[] }> = {};
    completedAttempts.forEach((attempt) => {
      const label = String(attempt.testTitle || attempt.subject || "Untitled Test");
      if (!bucket[label]) bucket[label] = { attempts: 0, scores: [] };
      bucket[label].attempts += 1;
      bucket[label].scores.push(safeNum(attempt.score, 0));
    });

    return Object.entries(bucket)
      .map(([name, value]) => ({
        name,
        attempts: value.attempts,
        avgScore: Math.round(average(value.scores)),
      }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 5);
  }, [completedAttempts]);

  const subjectAverages = useMemo(() => {
    const bucket: Record<string, number[]> = {};
    completedAttempts.forEach((attempt) => {
      const subject = String(attempt.subject || "General");
      if (!bucket[subject]) bucket[subject] = [];
      bucket[subject].push(safeNum(attempt.score, 0));
    });
    return Object.entries(bucket)
      .map(([subject, values]) => ({ subject, avg: Math.round(average(values)), attempts: values.length }))
      .sort((a, b) => b.avg - a.avg);
  }, [completedAttempts]);

  const bestSubject = subjectAverages[0];
  const weakestSubject = subjectAverages[subjectAverages.length - 1];

  const mostActiveDay = useMemo(() => {
    const counts = attemptsData.map((row) => ({ day: row.day, attempts: row.attempts }));
    const sorted = [...counts].sort((a, b) => b.attempts - a.attempts);
    return sorted[0]?.attempts ? sorted[0] : null;
  }, [attemptsData]);

  const recentActivities = useMemo<EducatorActivity[]>(() => {
    const items: Array<EducatorActivity & { sortMs: number }> = [];

    students.forEach((student) => {
      const ms = toMillis(student.joinedAt || student.createdAt);
      if (ms == null) return;
      items.push({
        id: `student-${student.id}`,
        type: "student_joined",
        title: "New learner joined",
        description: `${student.name || student.email || "A learner"} joined your coaching.`,
        time: relativeTime(ms),
        sortMs: ms,
      });
    });

    attempts.forEach((attempt) => {
      const ms = toMillis(attempt.submittedAt || attempt.updatedAt || attempt.createdAt);
      if (ms == null) return;
      const learner = studentNameMap[attempt.studentId || ""] || "A learner";
      const completed = isAttemptCompleted(attempt.status);
      items.push({
        id: `attempt-${attempt.id}`,
        type: "test_attempted",
        title: completed ? "Test submitted" : "Attempt started",
        description: completed
          ? `${learner} ${attempt.testTitle ? `submitted ${attempt.testTitle}` : "submitted a test"} with score ${safeNum(attempt.score, 0)}.`
          : `${learner} started ${attempt.testTitle || "a test"}.`,
        time: relativeTime(ms),
        sortMs: ms,
      });
    });

    accessCodes.forEach((code) => {
      const ms = toMillis(code.createdAt);
      if (ms == null) return;
      items.push({
        id: `code-${code.id}`,
        type: "access_code",
        title: "Access code available",
        description: `${code.code || code.id} for ${code.testSeriesTitle || code.testSeries || "your test series"} is ${accessCodeStatus(code)}.`,
        time: relativeTime(ms),
        sortMs: ms,
      });
    });

    seatTransactions.forEach((tx) => {
      const ms = toMillis(tx.updatedAt);
      if (ms == null) return;
      items.push({
        id: `seat-${tx.id}`,
        type: "seat_update",
        title: "Seat plan updated",
        description: `Seat limit changed from ${safeNum(tx.previousSeatLimit, 0)} to ${safeNum(tx.newSeatLimit, 0)}.`,
        time: relativeTime(ms),
        sortMs: ms,
      });
    });

    threads.forEach((thread) => {
      const ms = toMillis(thread.lastMessageAt);
      if (ms == null) return;
      const learner = studentNameMap[thread.studentId || ""] || "Learner";
      items.push({
        id: `thread-${thread.id}`,
        type: "message",
        title: safeNum(thread.unreadCountEducator, 0) > 0 ? "Unread learner message" : "Learner conversation updated",
        description: `${learner}: ${thread.lastMessage || thread.subject || "New message received."}`,
        time: relativeTime(ms),
        sortMs: ms,
      });
    });

    return items.sort((a, b) => b.sortMs - a.sortMs).slice(0, 8).map(({ sortMs, ...rest }) => rest);
  }, [students, attempts, accessCodes, seatTransactions, threads, studentNameMap]);

  if (authLoading || (!ready && uid)) {
    return <div className="py-12 text-center text-muted-foreground">Loading dashboard…</div>;
  }

  if (!uid) {
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

  if (ready && totalTests === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Create your first test series"
        description="Add a manual test or import one from the test bank to unlock real learner, attempt, and performance analytics here."
        actionLabel="Open Test Series"
        onAction={() => navigate("/educator/test-series")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="gradient-bg rounded-2xl p-6 text-white relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnYyaDR2MmgtNHYtMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
        <div className="relative z-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold mb-2">Welcome back, {displayName}! 👋</h1>
              <p className="text-white/85 text-sm sm:text-base max-w-2xl">
                You currently have <span className="font-semibold text-white">{activeStudents}</span> active learners,
                <span className="font-semibold text-white"> {pendingReviews}</span> pending AI reviews, and a
                <span className="font-semibold text-white"> {completionRate}%</span> completion rate across your tests.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="sm" variant="secondary" className="border-0" onClick={() => navigate("/educator/messages")}>
                Learner Messages
                {unreadMessages > 0 ? <Badge className="ml-2 bg-primary text-primary-foreground">{unreadMessages}</Badge> : null}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
            <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
              <div className="text-xs uppercase tracking-wide text-white/70">New learners (30d)</div>
              <div className="text-xl font-bold">{countInWindow(students, (student) => toMillis(student.joinedAt || student.createdAt), currentPeriodStart, currentPeriodEnd)}</div>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
              <div className="text-xs uppercase tracking-wide text-white/70">Avg completion time</div>
              <div className="text-xl font-bold">{formatMinutes(avgTimeSec)}</div>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
              <div className="text-xs uppercase tracking-wide text-white/70">Seat usage</div>
              <div className="text-xl font-bold">{seatLimit > 0 ? `${usedSeats}/${seatLimit}` : "Not assigned"}</div>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
              <div className="text-xs uppercase tracking-wide text-white/70">Unread messages</div>
              <div className="text-xl font-bold">{unreadMessages}</div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7 gap-4">
        <MetricCard
          title="Total Students"
          value={totalStudents.toLocaleString()}
          change={{ value: Math.abs(deltaStudents), type: deltaStudents >= 0 ? "increase" : "decrease" }}
          icon={Users}
          iconColor="text-blue-500"
          delay={0}
        />
        <MetricCard
          title="Active Students"
          value={activeStudents.toLocaleString()}
          icon={UserCheck}
          iconColor="text-green-500"
          delay={0.05}
        />
        <MetricCard
          title="Test Series"
          value={totalTests.toLocaleString()}
          change={{ value: Math.abs(deltaTests), type: deltaTests >= 0 ? "increase" : "decrease" }}
          icon={FileText}
          iconColor="text-purple-500"
          delay={0.1}
        />
        <MetricCard
          title="Total Attempts"
          value={totalAttempts.toLocaleString()}
          change={{ value: Math.abs(deltaAttempts), type: deltaAttempts >= 0 ? "increase" : "decrease" }}
          icon={Target}
          iconColor="text-orange-500"
          delay={0.15}
        />
        <MetricCard
          title="Completion Rate"
          value={`${completionRate}%`}
          change={{ value: Math.abs(deltaCompletionRate), type: deltaCompletionRate >= 0 ? "increase" : "decrease" }}
          icon={ClipboardCheck}
          iconColor="text-emerald-500"
          delay={0.25}
        />
        <MetricCard
          title="Seat Utilization"
          value={seatLimit > 0 ? `${seatUtilization}%` : "—"}
          icon={Layers3}
          iconColor="text-fuchsia-500"
          delay={0.3}
        />
        <MetricCard
          title="Active Codes"
          value={activeAccessCodes.toLocaleString()}
          icon={KeyRound}
          iconColor="text-amber-500"
          delay={0.35}
        />
      </div>

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
                <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" />
                <YAxis tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                  }}
                />
                <Area type="monotone" dataKey="students" stroke="hsl(204, 91%, 56%)" strokeWidth={2} fill="url(#studentGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Attempts & Scores" showPeriodSelect delay={0.25}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attemptsData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" />
                <YAxis tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                  }}
                />
                <Bar dataKey="attempts" fill="hsl(184, 87%, 65%)" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="avgScore" stroke="hsl(211, 91%, 42%)" strokeWidth={2} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartCard title="Top Test Series by Attempts" delay={0.3}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topTestsData} layout="vertical" margin={{ left: 16, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" />
                  <YAxis dataKey="name" type="category" width={130} tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                    }}
                  />
                  <Bar dataKey="attempts" fill="hsl(262, 83%, 58%)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Performance Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Best subject</p>
                <p className="text-xs text-muted-foreground">Highest average score across completed attempts</p>
              </div>
              <Badge variant="secondary">{bestSubject ? `${bestSubject.subject} · ${bestSubject.avg}` : "No data"}</Badge>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Needs attention</p>
                <p className="text-xs text-muted-foreground">Lowest average scoring subject right now</p>
              </div>
              <Badge variant="outline">{weakestSubject ? `${weakestSubject.subject} · ${weakestSubject.avg}` : "No data"}</Badge>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Most active day</p>
                <p className="text-xs text-muted-foreground">Highest attempt volume in the last 7 days</p>
              </div>
              <Badge variant="secondary">{mostActiveDay ? `${mostActiveDay.day} · ${mostActiveDay.attempts}` : "No data"}</Badge>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Pending reviews</p>
                <p className="text-xs text-muted-foreground">Submitted attempts waiting for AI analysis</p>
              </div>
              <Badge variant={pendingReviews > 0 ? "destructive" : "secondary"}>{pendingReviews}</Badge>
            </div>
            <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 text-foreground font-medium mb-2">
                <Clock3 className="h-4 w-4" /> Quick read
              </div>
              <ul className="space-y-1.5 list-disc pl-5">
                <li>{activeAccessCodes} active access codes are currently usable by learners.</li>
                <li>{seatLimit > 0 ? `${usedSeats} of ${seatLimit}` : "No"} seats are allocated right now.</li>
                <li>{avgTimeSec ? `Average attempt completion time is ${formatMinutes(avgTimeSec)}.` : "Attempt timing will appear after more submissions."}</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartCard title="Subject Performance Heatmap" delay={0.35}>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectPerformanceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" className="text-xs fill-muted-foreground" />
                  <YAxis dataKey="subject" type="category" tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                    }}
                  />
                  <Bar dataKey="weak" stackId="subject" fill="hsl(0, 84%, 60%)" />
                  <Bar dataKey="moderate" stackId="subject" fill="hsl(38, 92%, 50%)" />
                  <Bar dataKey="strong" stackId="subject" fill="hsl(142, 76%, 36%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-red-500" /><span className="text-xs text-muted-foreground">Weak</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-amber-500" /><span className="text-xs text-muted-foreground">Moderate</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-600" /><span className="text-xs text-muted-foreground">Strong</span></div>
            </div>
          </ChartCard>
        </div>

        <ActivityFeed activities={recentActivities} delay={0.4} />
      </div>
    </div>
  );
}
