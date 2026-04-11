import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  UserCheck,
  FileText,
  KeyRound,
  Trophy,
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
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import MetricCard from "@/components/educator/MetricCard";
import ChartCard from "@/components/educator/ChartCard";
import ActivityFeed, { type EducatorActivity } from "@/components/educator/ActivityFeed";
import EmptyState from "@/components/educator/EmptyState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type TopPerformerFilter = "overall" | "subject" | "test";

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
  const educatorId = profile?.educatorId || uid;

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
  const [topPerformerFilter, setTopPerformerFilter] = useState<TopPerformerFilter>("overall");
  const [selectedTopSubject, setSelectedTopSubject] = useState("all");
  const [selectedTopTest, setSelectedTopTest] = useState("all");
  const [topPerformerLimit, setTopPerformerLimit] = useState("10");

  useEffect(() => {
    if (!educatorId) {
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
      doc(db, "educators", educatorId),
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
      collection(db, "educators", educatorId, "students"),
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
      collection(db, "educators", educatorId, "my_tests"),
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
      query(collection(db, "attempts"), where("educatorId", "==", educatorId)),
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
      collection(db, "educators", educatorId, "accessCodes"),
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
      collection(db, "educators", educatorId, "billingSeats"),
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
      collection(db, "educators", educatorId, "seatTransactions"),
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
      query(collection(db, "support_threads"), where("educatorId", "==", educatorId)),
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
  }, [educatorId]);

  const ready =
    profileLoaded &&
    studentsLoaded &&
    testsLoaded &&
    attemptsLoaded &&
    accessCodesLoaded &&
    seatsLoaded &&
    seatTxLoaded &&
    threadsLoaded;

  const studentNameMap = useMemo(() => {
    const out: Record<string, string> = {};
    students.forEach((student) => {
      out[student.id] = student.name || student.email || "Learner";
    });
    return out;
  }, [students]);

  const totalStudents = students.length;
  const activeStudents = students.filter(isStudentActive).length;
  const totalTests = tests.length;
  const completedAttempts = attempts.filter((attempt) => isAttemptCompleted(attempt.status));
  const activeAccessCodes = accessCodes.filter((code) => accessCodeStatus(code) === "active").length;

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

  const topPerformerSubjects = useMemo(() => {
    return Array.from(
      new Set(
        completedAttempts
          .map((attempt) => String(attempt.subject || "General").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [completedAttempts]);

  const topPerformerTests = useMemo(() => {
    const out = new Map<string, string>();
    completedAttempts.forEach((attempt) => {
      const title = String(attempt.testTitle || "Untitled Test").trim() || "Untitled Test";
      const key = attempt.testId ? `id:${attempt.testId}` : `title:${title}`;
      if (!out.has(key)) out.set(key, title);
    });

    return Array.from(out.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [completedAttempts]);

  useEffect(() => {
    if (topPerformerFilter === "subject" && selectedTopSubject !== "all" && !topPerformerSubjects.includes(selectedTopSubject)) {
      setSelectedTopSubject("all");
    }
  }, [topPerformerFilter, selectedTopSubject, topPerformerSubjects]);

  useEffect(() => {
    if (topPerformerFilter === "test" && selectedTopTest !== "all" && !topPerformerTests.some((test) => test.value === selectedTopTest)) {
      setSelectedTopTest("all");
    }
  }, [topPerformerFilter, selectedTopTest, topPerformerTests]);

  const filteredTopPerformerAttempts = useMemo(() => {
    if (topPerformerFilter === "subject" && selectedTopSubject !== "all") {
      return completedAttempts.filter(
        (attempt) => String(attempt.subject || "General").trim() === selectedTopSubject
      );
    }

    if (topPerformerFilter === "test" && selectedTopTest !== "all") {
      if (selectedTopTest.startsWith("id:")) {
        return completedAttempts.filter((attempt) => `id:${attempt.testId || ""}` === selectedTopTest);
      }

      const title = selectedTopTest.replace("title:", "");
      return completedAttempts.filter((attempt) => String(attempt.testTitle || "Untitled Test").trim() === title);
    }

    return completedAttempts;
  }, [topPerformerFilter, selectedTopSubject, selectedTopTest, completedAttempts]);

  const topPerformers = useMemo(() => {
    const byStudent: Record<
      string,
      {
        studentId: string;
        totalScore: number;
        totalMax: number;
        attempts: number;
        bestPercent: number;
        latestMs: number;
      }
    > = {};

    filteredTopPerformerAttempts.forEach((attempt) => {
      const studentId = attempt.studentId;
      if (!studentId) return;

      const score = safeNum(attempt.score, 0);
      const maxScore = safeNum(attempt.maxScore, 0);
      const percent = maxScore > 0 ? (score / maxScore) * 100 : safeNum(attempt.accuracy, 0);
      const attemptMs = toMillis(attempt.submittedAt || attempt.updatedAt || attempt.createdAt) || 0;

      if (!byStudent[studentId]) {
        byStudent[studentId] = {
          studentId,
          totalScore: 0,
          totalMax: 0,
          attempts: 0,
          bestPercent: 0,
          latestMs: 0,
        };
      }

      byStudent[studentId].attempts += 1;
      byStudent[studentId].totalScore += score;
      byStudent[studentId].totalMax += maxScore;
      byStudent[studentId].bestPercent = Math.max(byStudent[studentId].bestPercent, percent);
      byStudent[studentId].latestMs = Math.max(byStudent[studentId].latestMs, attemptMs);
    });

    const limit = Math.max(1, safeNum(topPerformerLimit, 10));

    return Object.values(byStudent)
      .map((row) => {
        const avgPercent =
          row.totalMax > 0
            ? (row.totalScore / row.totalMax) * 100
            : row.bestPercent;

        return {
          ...row,
          name: studentNameMap[row.studentId] || "Learner",
          avgPercent,
        };
      })
      .sort((a, b) => {
        if (b.avgPercent !== a.avgPercent) return b.avgPercent - a.avgPercent;
        if (b.attempts !== a.attempts) return b.attempts - a.attempts;
        if (b.bestPercent !== a.bestPercent) return b.bestPercent - a.bestPercent;
        return b.latestMs - a.latestMs;
      })
      .slice(0, limit);
  }, [filteredTopPerformerAttempts, studentNameMap, topPerformerLimit]);

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

  if (authLoading || (!ready && educatorId)) {
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

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8 gap-4">
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

      <div className="rounded-2xl border bg-card p-4 md:p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base md:text-lg font-semibold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Top Performers
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground">
              Ranked by weighted score percentage based on selected filters.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <Select
              value={topPerformerFilter}
              onValueChange={(value) => setTopPerformerFilter(value as TopPerformerFilter)}
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Select ranking type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overall">Overall Toppers</SelectItem>
                <SelectItem value="subject">Subject-wise Toppers</SelectItem>
                <SelectItem value="test">Particular Test Toppers</SelectItem>
              </SelectContent>
            </Select>

            <Select value={topPerformerLimit} onValueChange={setTopPerformerLimit}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Top count" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Top 3</SelectItem>
                <SelectItem value="5">Top 5</SelectItem>
                <SelectItem value="10">Top 10</SelectItem>
                <SelectItem value="20">Top 20</SelectItem>
              </SelectContent>
            </Select>

            {topPerformerFilter === "subject" && (
              <Select value={selectedTopSubject} onValueChange={setSelectedTopSubject}>
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subjects</SelectItem>
                  {topPerformerSubjects.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {topPerformerFilter === "test" && (
              <Select value={selectedTopTest} onValueChange={setSelectedTopTest}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Select test" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tests</SelectItem>
                  {topPerformerTests.map((test) => (
                    <SelectItem key={test.value} value={test.value}>
                      {test.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {topPerformers.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No completed attempts yet for this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 pr-3 font-medium">Rank</th>
                  <th className="text-left py-2 pr-3 font-medium">Learner</th>
                  <th className="text-right py-2 pr-3 font-medium">Attempts</th>
                  <th className="text-right py-2 pr-3 font-medium">Avg %</th>
                  <th className="text-right py-2 font-medium">Best %</th>
                </tr>
              </thead>
              <tbody>
                {topPerformers.map((performer, index) => {
                  const rank = index + 1;
                  const rankClass =
                    rank === 1
                      ? "text-amber-500"
                      : rank === 2
                        ? "text-slate-500"
                        : rank === 3
                          ? "text-orange-500"
                          : "text-foreground";

                  return (
                    <tr key={performer.studentId} className="border-b last:border-0">
                      <td className={`py-2 pr-3 font-semibold ${rankClass}`}>#{rank}</td>
                      <td className="py-2 pr-3 font-medium">{performer.name}</td>
                      <td className="py-2 pr-3 text-right">{performer.attempts}</td>
                      <td className="py-2 pr-3 text-right">{performer.avgPercent.toFixed(1)}%</td>
                      <td className="py-2 text-right">{performer.bestPercent.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div>
          <ChartCard title="Top Test Series by Attempts" delay={0.3}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topTestsData} layout="vertical" margin={{ top: 6, right: 8, left: -20, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={88}
                    tickMargin={6}
                    tickLine={false}
                    axisLine={false}
                    className="text-xs fill-muted-foreground"
                  />
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
        
        <div>
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

        <div className="h-full min-h-0">
          <ActivityFeed activities={recentActivities} delay={0.4} />
        </div>
      </div>

    </div>
  );
}
