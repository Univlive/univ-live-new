import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Save, LayoutGrid } from "lucide-react";
import { toast } from "sonner";

import { TimerChip } from "@/components/student/TimerChip";
import { cn } from "@/lib/utils";
import { HtmlView } from "@/lib/safeHtml";

import { useAuth } from "@/contexts/AuthProvider";
import { useTenant } from "@/contexts/TenantProvider";
import { db } from "@/lib/firebase";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

type AttemptResponse = { answer: string | null; markedForReview: boolean; visited: boolean; answered: boolean };

type AttemptQuestion = {
  id: string;
  sectionId: string;
  type: "mcq" | "integer";
  stem: string;
  options?: { id: string; text: string }[];
  correctAnswer?: string;
  explanation?: string;
  marks: { correct: number; incorrect: number };
  passage?: { title: string; content: string } | null;
};

type TestMeta = {
  id: string;
  title: string;
  subject?: string;
  durationMinutes: number;
  sections: { id: string; name: string }[];
};

type AttemptDoc = {
  studentId: string;
  educatorId: string;
  tenantSlug: string | null;
  testId: string;
  testTitle?: string;
  subject?: string;
  status: "in_progress" | "submitted";
  durationSec: number;
  startedAtMs?: number;
  currentIndex?: number;
  responses?: Record<string, AttemptResponse>;
  createdAt?: any;
  startedAt?: any;
  updatedAt?: any;
};

const LS_ATTEMPT_ID_PREFIX = "cbt_attempt_id__";

const safeNumber = (v: any, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const buildInitResponses = (qs: AttemptQuestion[]) => {
  const init: Record<string, AttemptResponse> = {};
  qs.forEach((q) => (init[q.id] = { answer: null, markedForReview: false, visited: false, answered: false }));
  return init;
};

const mapQuestion = (id: string, data: any): AttemptQuestion => {
  const opts: string[] = Array.isArray(data.options) ? data.options : [];
  const correctIndex = safeNumber(data.correctOption, 0);
  // Always normalize to +5 marks and -1 negative marks
  const positive = 5;
  const negative = 1;

  return {
    id,
    sectionId: data.sectionId || "main",
    type: "mcq",
    stem: data.question || "",   // ✅ FIXED
    options: opts.map((t, i) => ({ id: String(i), text: String(t) })),
    correctAnswer: String(correctIndex),
    explanation: data.explanation || "",
    marks: { correct: positive, incorrect: negative },
    passage: null,
  };
};


const computeRemainingSeconds = (startedAtMs: number | null, totalSec: number) => {
  if (!totalSec) return 0;
  if (!startedAtMs) return totalSec;
  const elapsed = Math.floor((Date.now() - startedAtMs) / 1000);
  return Math.max(0, totalSec - elapsed);
};

async function requestFullscreenSafe() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    return true;
  } catch {
    return false;
  }
}

async function exitFullscreenSafe() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    // ignore
  }
}

export default function StudentCBTAttempt() {
  const { testId } = useParams();
  const navigate = useNavigate();

  const { firebaseUser, profile, loading: authLoading } = useAuth();
  const { tenant, tenantSlug, loading: tenantLoading } = useTenant();

  const educatorId = tenant?.educatorId || profile?.educatorId || null;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [testMeta, setTestMeta] = useState<TestMeta | null>(null);
  const [questions, setQuestions] = useState<AttemptQuestion[]>([]);
  const [responses, setResponses] = useState<Record<string, AttemptResponse>>({});

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSectionId, setCurrentSectionId] = useState("main");

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [attemptStartedAtMs, setAttemptStartedAtMs] = useState<number | null>(null);
  const [durationSec, setDurationSec] = useState(0);

  const [isStarted, setIsStarted] = useState(false);
  const [startDialogOpen, setStartDialogOpen] = useState(true);
  const [instructionsOpen, setInstructionsOpen] = useState(true);
  const [instructionsChecked, setInstructionsChecked] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [timerStartSeconds, setTimerStartSeconds] = useState(0);

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);

  // Proctoring state
  const [exitCount, setExitCount] = useState(0);
  const [violationModalOpen, setViolationModalOpen] = useState(false);

  const attemptIdStorageKey = useMemo(
    () => `${LS_ATTEMPT_ID_PREFIX}${tenantSlug || "main"}__${testId || ""}`,
    [tenantSlug, testId]
  );

  const attemptRef = useMemo(() => (attemptId ? doc(db, "attempts", attemptId) : null), [attemptId]);

  // Debounced Firestore updates (reduces write spam)
  const saveTimerRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef<Record<string, any>>({});

  const queueAttemptUpdate = useCallback(
    (patch: Record<string, any>) => {
      if (!attemptRef) return;

      pendingUpdateRef.current = { ...pendingUpdateRef.current, ...patch };

      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(async () => {
        const payload = pendingUpdateRef.current;
        pendingUpdateRef.current = {};
        setSaving(true);
        try {
          await updateDoc(attemptRef, { ...payload, updatedAt: serverTimestamp() });
          setLastSavedAt(Date.now());
        } catch (e) {
          console.error(e);
          toast.error("Failed to save progress");
        } finally {
          setSaving(false);
        }
      }, 650);
    },
    [attemptRef]
  );

  const answeredCount = useMemo(() => Object.values(responses).filter((r) => !!r?.answer).length, [responses]);
  const unansweredVisitedCount = useMemo(
    () => Object.values(responses).filter((r) => r?.visited && !r?.answer).length,
    [responses]
  );

  const currentQuestion = questions[currentIndex] || null;

  // Load test + questions + existing attempt
  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!testId) {
        setLoadError("Missing test id");
        setLoading(false);
        return;
      }
      if (authLoading || tenantLoading) return;
      if (!firebaseUser) {
        setLoadError("You must be logged in");
        setLoading(false);
        return;
      }
      if (!educatorId) {
        setLoadError("Tenant not found. Open this test from your coaching website.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError(null);

      try {
        const sources = [
          {
            testDoc: doc(db, "educators", educatorId, "my_tests", testId),
            qCol: collection(db, "educators", educatorId, "my_tests", testId, "questions"),
          },
          {
            testDoc: doc(db, "test_series", testId),
            qCol: collection(db, "test_series", testId, "questions"),
          },
        ];

        let meta: TestMeta | null = null;
        let qs: AttemptQuestion[] = [];

        for (const s of sources) {
          const tSnap = await getDoc(s.testDoc);
          if (!tSnap.exists()) continue;

          const d = tSnap.data() as any;
          const durationMinutes = safeNumber(d.durationMinutes, 60);
          const computedSections = [{ id: "main", name: d.subject || "General" }];

          meta = {
            id: tSnap.id,
            title: d.title || "Untitled Test",
            subject: d.subject,
            durationMinutes,
            sections: Array.isArray(d.sections) && d.sections.length ? d.sections : computedSections,
          };

          const qSnap = await getDocs(s.qCol);
          qs = qSnap.docs
            .filter((q) => q.data()?.isActive !== false)
            .map((q) => mapQuestion(q.id, q.data()));
          break;
        }

        if (!meta) throw new Error("Test not found");
        if (!qs.length) throw new Error("No questions found in this test");

        if (!mounted) return;

        setTestMeta(meta);
        setQuestions(qs);
        setDurationSec(meta.durationMinutes * 60);

        const init = buildInitResponses(qs);
        setResponses(init);
        setCurrentIndex(0);
        setCurrentSectionId(qs[0]?.sectionId || "main");

        // Attempt resume: localStorage -> doc -> query
        const loadAttemptById = async (id: string) => {
          const aSnap = await getDoc(doc(db, "attempts", id));
          if (!aSnap.exists()) return null;
          const a = aSnap.data() as AttemptDoc;
          if (a.studentId !== firebaseUser.uid) return null;
          if (a.testId !== testId) return null;
          if (a.status !== "in_progress") return null;
          if (a.educatorId !== educatorId) return null;
          return { id: aSnap.id, ...a } as any;
        };

        let foundAttempt: any = null;
        const cachedId = localStorage.getItem(attemptIdStorageKey);

        if (cachedId) {
          foundAttempt = await loadAttemptById(cachedId);
          if (!foundAttempt) localStorage.removeItem(attemptIdStorageKey);
        }

        if (!foundAttempt) {
          const qAttempt = query(
            collection(db, "attempts"),
            where("studentId", "==", firebaseUser.uid),
            where("testId", "==", testId),
            where("educatorId", "==", educatorId),
            where("status", "==", "in_progress"),
            orderBy("createdAt", "desc"),
            limit(1)
          );
          const aSnap = await getDocs(qAttempt);
          if (!aSnap.empty) {
            const d = aSnap.docs[0];
            foundAttempt = { id: d.id, ...(d.data() as AttemptDoc) };
            localStorage.setItem(attemptIdStorageKey, d.id);
          }
        }

        if (!mounted) return;

        if (foundAttempt) {
          setAttemptId(foundAttempt.id);

          const stored = (foundAttempt.responses || {}) as Record<string, AttemptResponse>;
          setResponses((prev) => {
            const next = { ...prev };
            Object.keys(next).forEach((qid) => {
              if (stored[qid]) next[qid] = stored[qid];
            });
            return next;
          });

          setCurrentIndex(safeNumber(foundAttempt.currentIndex, 0));

          const startedMs =
            foundAttempt.startedAtMs ||
            (foundAttempt.startedAt && typeof foundAttempt.startedAt.toMillis === "function"
              ? foundAttempt.startedAt.toMillis()
              : null);

          setAttemptStartedAtMs(startedMs ? safeNumber(startedMs, Date.now()) : null);
          setDurationSec(safeNumber(foundAttempt.durationSec, meta.durationMinutes * 60));

          setIsStarted(false);
          setStartDialogOpen(true);
        } else {
          setAttemptId(null);
          setAttemptStartedAtMs(null);
          setIsStarted(false);
          setStartDialogOpen(true);
        }
      } catch (e: any) {
        console.error(e);
        if (!mounted) return;
        setLoadError(e?.message || "Failed to load test");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [testId, authLoading, tenantLoading, firebaseUser, educatorId, attemptIdStorageKey]);

  
  // Always show instructions gate before starting / resuming
  useEffect(() => {
    if (loading || authLoading || tenantLoading) return;
    if (!isStarted) {
      setInstructionsOpen(true);
      setInstructionsChecked(false);
    }
  }, [loading, authLoading, tenantLoading, isStarted, testId]);

// Keep section in sync and load saved answer into local state
  useEffect(() => {
    const q = questions[currentIndex];
    if (q) {
      if (q.sectionId) setCurrentSectionId(q.sectionId);
      setSelectedAnswer(responses[q.id]?.answer || null);
    }
  }, [questions, currentIndex, responses]);

  // Mark visited (only after started)
  useEffect(() => {
    if (!isStarted || !currentQuestion || !attemptId) return;
    const qId = currentQuestion.id;

    setResponses((prev) => {
      const cur = prev[qId];
      if (!cur || cur.visited) return prev;

      const next = { ...prev, [qId]: { ...cur, visited: true } };
      queueAttemptUpdate({ [`responses.${qId}.visited`]: true, currentIndex });
      return next;
    });
  }, [isStarted, currentQuestion, attemptId, queueAttemptUpdate, currentIndex]);

  // Heartbeat (optional, keeps updatedAt fresh)
  useEffect(() => {
    if (!isStarted || !attemptId) return;
    const i = window.setInterval(() => queueAttemptUpdate({ currentIndex }), 20000);
    return () => window.clearInterval(i);
  }, [isStarted, attemptId, queueAttemptUpdate, currentIndex]);

  // Leave fullscreen on unmount
  useEffect(() => {
    return () => {
      exitFullscreenSafe();
    };
  }, []);

  // Hide any app sidebars/scroll while attempting (CBT should feel like a dedicated screen)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);


  const goToIndex = (idx: number) => {
    const next = Math.max(0, Math.min(idx, questions.length - 1));
    setCurrentIndex(next);
    if (attemptId) queueAttemptUpdate({ currentIndex: next });
  };

  const handleStart = async () => {
    if (!firebaseUser || !testId || !educatorId || !testMeta) return;

    const fullscreenOk = await requestFullscreenSafe();
    if (!fullscreenOk) toast.message("Fullscreen was blocked by browser. Continuing in normal mode.");

    let id = attemptId;
    let startedAtMs = attemptStartedAtMs;

    try {
      const totalSec = durationSec || testMeta.durationMinutes * 60;

      // Resume expired attempt -> submit immediately
      if (id && startedAtMs && computeRemainingSeconds(startedAtMs, totalSec) <= 0) {
        toast.error("Time is already over. Submitting your test...");
        await handleSubmit(true);
        return;
      }

      if (!id) {
        startedAtMs = Date.now();
        const initialResponses = buildInitResponses(questions);

        const payload: AttemptDoc = {
          studentId: firebaseUser.uid,
          educatorId,
          tenantSlug: tenantSlug || null,
          testId,
          testTitle: testMeta.title,
          subject: testMeta.subject,
          status: "in_progress",
          durationSec: totalSec,
          startedAtMs,
          currentIndex,
          responses: initialResponses,
          createdAt: serverTimestamp(),
          startedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        const ref = await addDoc(collection(db, "attempts"), payload);
        id = ref.id;

        setAttemptId(id);
        localStorage.setItem(attemptIdStorageKey, id);

        setResponses((prev) => ({ ...initialResponses, ...prev }));
      } else if (!startedAtMs) {
        startedAtMs = Date.now();
        setAttemptStartedAtMs(startedAtMs);
        await updateDoc(doc(db, "attempts", id), { startedAtMs, updatedAt: serverTimestamp() });
      }

      const remaining = computeRemainingSeconds(startedAtMs!, totalSec);
      setAttemptStartedAtMs(startedAtMs!);
      setDurationSec(totalSec);
      setTimerStartSeconds(remaining);

      setIsStarted(true);
      setStartDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to start test");
    }
  };

  const handleSelectOption = (answer: string) => {
    if (!currentQuestion || !isStarted) return;
    setSelectedAnswer(answer);
  };

  const handleSaveAndNext = () => {
    if (!currentQuestion || !attemptId || !isStarted) return;
    
    const answer = selectedAnswer;
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: { 
        ...prev[currentQuestion.id], 
        answer, 
        answered: String(answer).length > 0,
        markedForReview: false 
      },
    }));

    queueAttemptUpdate({
      [`responses.${currentQuestion.id}.answer`]: answer,
      [`responses.${currentQuestion.id}.answered`]: String(answer).length > 0,
      [`responses.${currentQuestion.id}.markedForReview`]: false,
      currentIndex,
    });
    
    goToIndex(currentIndex + 1);
  };

  const handleSaveAndMarkForReview = () => {
    if (!currentQuestion || !attemptId || !isStarted) return;
    
    const answer = selectedAnswer;
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: { 
        ...prev[currentQuestion.id], 
        answer, 
        answered: String(answer).length > 0,
        markedForReview: true 
      },
    }));

    queueAttemptUpdate({
      [`responses.${currentQuestion.id}.answer`]: answer,
      [`responses.${currentQuestion.id}.answered`]: String(answer).length > 0,
      [`responses.${currentQuestion.id}.markedForReview`]: true,
      currentIndex,
    });
    
    goToIndex(currentIndex + 1);
  };

  const handleMarkForReviewAndNext = () => {
    if (!currentQuestion || !attemptId || !isStarted) return;
    
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: { ...prev[currentQuestion.id], markedForReview: true },
    }));

    queueAttemptUpdate({ [`responses.${currentQuestion.id}.markedForReview`]: true, currentIndex });
    goToIndex(currentIndex + 1);
  };

  const handleMarkForReview = () => {
    if (!currentQuestion || !attemptId) return;
    const nextVal = !responses[currentQuestion.id]?.markedForReview;

    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: { ...prev[currentQuestion.id], markedForReview: nextVal },
    }));

    queueAttemptUpdate({ [`responses.${currentQuestion.id}.markedForReview`]: nextVal, currentIndex });
  };

  const handleClearResponse = () => {
    if (!currentQuestion || !attemptId) return;

    setSelectedAnswer(null);
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: { ...prev[currentQuestion.id], answer: null, answered: false, markedForReview: false },
    }));

    queueAttemptUpdate({
      [`responses.${currentQuestion.id}.answer`]: null,
      [`responses.${currentQuestion.id}.answered`]: false,
      [`responses.${currentQuestion.id}.markedForReview`]: false,
      currentIndex,
    });
  };

  const computeScore = () => {
    let score = 0;
    let maxScore = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;

    for (const q of questions) {
      maxScore += safeNumber(q.marks.correct, 0);

      const ans = responses[q.id]?.answer;
      if (ans === null || ans === undefined || String(ans).trim() === "") {
        unansweredCount += 1;
        continue;
      }

      if (q.type === "integer") {
        if (String(ans).trim() === String(q.correctAnswer ?? "").trim()) {
          score += safeNumber(q.marks.correct, 0);
          correctCount += 1;
        } else {
          score -= Math.abs(safeNumber(q.marks.incorrect, 0));
          incorrectCount += 1;
        }
      } else {
        if (String(ans) === String(q.correctAnswer ?? "")) {
          score += safeNumber(q.marks.correct, 0);
          correctCount += 1;
        } else {
          score -= Math.abs(safeNumber(q.marks.incorrect, 0));
          incorrectCount += 1;
        }
      }
    }

    const attempted = correctCount + incorrectCount;
    const accuracy = attempted > 0 ? correctCount / attempted : 0;

    return { score, maxScore, correctCount, incorrectCount, unansweredCount, accuracy };
  };

  const flushPendingSaves = async () => {
    if (!attemptRef) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    const pending = pendingUpdateRef.current;
    pendingUpdateRef.current = {};
    if (Object.keys(pending).length > 0) await updateDoc(attemptRef, { ...pending, updatedAt: serverTimestamp() });
  };

  const handleSubmit = async (isAutoSubmit = false) => {
    if (!attemptId || !firebaseUser || !testId || !educatorId || !testMeta) return;

    try {
      setSaving(true);
      await flushPendingSaves();

      const { score, maxScore, correctCount, incorrectCount, unansweredCount, accuracy } = computeScore();
      const totalSec = durationSec || testMeta.durationMinutes * 60;
      const startedAtMs = attemptStartedAtMs || Date.now();
      const remaining = computeRemainingSeconds(startedAtMs, totalSec);
      const timeTakenSec = Math.max(0, totalSec - remaining);

      await updateDoc(doc(db, "attempts", attemptId), {
        status: "submitted",
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        score,
        maxScore,
        correctCount,
        incorrectCount,
        unansweredCount,
        accuracy,
        timeTakenSec,
      });

      localStorage.removeItem(attemptIdStorageKey);
      await exitFullscreenSafe();

      navigate(`/student/results/${attemptId}?fromTest=true${isAutoSubmit ? "&auto=1" : ""}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to submit test");
    } finally {
      setSaving(false);
      setSubmitDialogOpen(false);
    }
  };

  const handleTimeUp = async () => {
    toast.error("Time's up! Submitting your test...");
    await handleSubmit(true);
  };

  // Proctoring: Prevent copy, cut, paste, context menu
  useEffect(() => {
    if (!isStarted) return;

    const preventDefault = (e: Event) => e.preventDefault();
    
    document.addEventListener("copy", preventDefault);
    document.addEventListener("cut", preventDefault);
    document.addEventListener("paste", preventDefault);
    document.addEventListener("contextmenu", preventDefault);

    return () => {
      document.removeEventListener("copy", preventDefault);
      document.removeEventListener("cut", preventDefault);
      document.removeEventListener("paste", preventDefault);
      document.removeEventListener("contextmenu", preventDefault);
    };
  }, [isStarted]);

  // Proctoring: Tab switch & Full-screen exit logic
  useEffect(() => {
    if (!isStarted) return;

    const handleViolation = () => {
      setViolationModalOpen(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleViolation();
      }
    };

    const handleFullscreenChange = () => {
      // If user exits fullscreen AND they are not currently in instructions or submitting or already warned
      if (!document.fullscreenElement && isStarted && !submitDialogOpen && !violationModalOpen && !instructionsOpen) {
        handleViolation();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [isStarted, submitDialogOpen, violationModalOpen, instructionsOpen, handleSubmit]);

  // Warn on reload/close while started
  useEffect(() => {
    if (!isStarted) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isStarted]);

  if (loading || authLoading || tenantLoading) return <div className="text-center py-12">Loading...</div>;
  if (loadError || !testMeta || !currentQuestion) return <div className="text-center py-12">{loadError || "Failed to load test"}</div>;

  const timerKey = isStarted ? `running_${attemptId || "new"}` : `paused_${attemptId || "new"}`;

  // Palette legend counts
  const notVisitedCount = Object.values(responses).filter((r) => !r?.visited).length;
  const notAnsweredCount = Object.values(responses).filter((r) => r?.visited && !r?.answered && !r?.markedForReview).length;
  const markedForReviewCount = Object.values(responses).filter((r) => r?.markedForReview && !r?.answered).length;
  const answeredAndMarkedCount = Object.values(responses).filter((r) => r?.markedForReview && r?.answered).length;

  const getQuestionBtnStyle = (idx: number): React.CSSProperties => {
    const q = questions[idx];
    if (!q) return {};
    const r = responses[q.id];
    const isCurrent = idx === currentIndex;

    if (isCurrent) {
      return { background: "#3b82f6", color: "#ffffff", border: "2px solid #1e40af" };
    }
    if (r?.answered && r?.markedForReview) {
      return { background: "linear-gradient(135deg, #7c3aed 60%, #22c55e 100%)", color: "#ffffff", border: "1px solid #7c3aed" };
    }
    if (r?.answered) {
      return { background: "#22c55e", color: "#ffffff", border: "1px solid #16a34a" };
    }
    if (r?.markedForReview) {
      return { background: "#7c3aed", color: "#ffffff", border: "1px solid #6d28d9" };
    }
    if (r?.visited) {
      return { background: "#ef4444", color: "#ffffff", border: "1px solid #dc2626" };
    }
    return { background: "#e5e7eb", color: "#374151", border: "1px solid #d1d5db" };
  };

  const PaletteContent = ({ onClose }: { onClose?: () => void }) => (
    <div style={{ fontFamily: "Arial, sans-serif" }}>
      {/* Legend */}
      <div style={{ padding: "8px 10px", borderBottom: "1px solid #d1d5db" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: 11 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#e5e7eb", border: "1px solid #d1d5db", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 10, color: "#374151" }}>{notVisitedCount}</span>
            <span style={{ color: "#374151" }}>Not Visited</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#ef4444", border: "1px solid #dc2626", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 10, color: "#fff" }}>{notAnsweredCount}</span>
            <span style={{ color: "#374151" }}>Not Answered</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#22c55e", border: "1px solid #16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 10, color: "#fff" }}>{answeredCount}</span>
            <span style={{ color: "#374151" }}>Answered</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#7c3aed", border: "1px solid #6d28d9", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 10, color: "#fff" }}>{markedForReviewCount}</span>
            <span style={{ color: "#374151" }}>Marked for Review</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, gridColumn: "span 2" }}>
            <span style={{ position: "relative", width: 22, height: 22, borderRadius: "50%", background: "#7c3aed", border: "1px solid #6d28d9", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 10, color: "#fff" }}>
              <span style={{ position: "absolute", bottom: -3, right: -3, width: 11, height: 11, borderRadius: "50%", background: "#22c55e", border: "1px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, color: "#fff" }}>✓</span>
              {answeredAndMarkedCount}
            </span>
            <span style={{ color: "#374151" }}>Answered &amp; Marked for Review <span style={{ fontSize: 9, color: "#6b7280" }}>(will be considered)</span></span>
          </div>
        </div>
      </div>

      {/* Section tabs if multiple */}
      {testMeta.sections.length > 1 && (
        <div style={{ display: "flex", overflowX: "auto", borderBottom: "1px solid #d1d5db", padding: "0 8px" }}>
          {testMeta.sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setCurrentSectionId(section.id)}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: currentSectionId === section.id ? 700 : 400,
                borderBottom: currentSectionId === section.id ? "3px solid #2563eb" : "3px solid transparent",
                color: currentSectionId === section.id ? "#2563eb" : "#374151",
                background: "none",
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {section.name}
            </button>
          ))}
        </div>
      )}

      {/* Question grid */}
      <div style={{ padding: "15px", overflowY: "auto", maxHeight: "calc(100% - 160px)" }}>
        <div className="question-grid">
          {questions.map((q, idx) => (
            <button
              key={q.id}
              onClick={() => { goToIndex(idx); onClose?.(); }}
              style={{
                ...getQuestionBtnStyle(idx),
                width: "100%",
                aspectRatio: "1",
                borderRadius: "50%",
                fontSize: "13px",
                fontWeight: "bold",
                cursor: "pointer",
                transition: "transform 0.1s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                padding: 0,
                lineHeight: "1",
                textAlign: "center",
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.92)")}
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              <span style={{ display: "block", width: "100%", textAlign: "center", color: "inherit" }}>{idx + 1}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        height: "100dvh",
        background: "#f3f4f6",
        fontFamily: "Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        userSelect: "none", // Prevent text selection
      }}
    >
      {/* ─── INSTRUCTIONS GATE ─── */}
      {!isStarted && instructionsOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ width: "100%", maxWidth: 680, borderRadius: 12, background: "#fff", boxShadow: "0 8px 40px rgba(0,0,0,0.25)", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #e5e7eb", background: "#1e3a8a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>Computer Based Test</div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{testMeta?.title || "Test"}</div>
              </div>
              <div style={{ fontSize: 12, background: "rgba(255,255,255,0.15)", padding: "4px 12px", borderRadius: 20 }}>
                Duration: {testMeta?.durationMinutes ?? 60} min
              </div>
            </div>

            <div style={{ padding: "20px 24px" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "#1e3a8a" }}>General Instructions</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "#374151" }}>
                {[
                  { icon: <span style={{ width: 22, height: 22, borderRadius: 3, background: "#e5e7eb", border: "1.5px solid #9ca3af", display: "inline-block", flexShrink: 0 }} />, text: "This is a computer-based test with a timer; it will auto-submit when time ends." },
                  { icon: <span style={{ width: 0, height: 0, borderTop: "10px solid transparent", borderBottom: "10px solid transparent", borderLeft: "16px solid #f97316", display: "inline-block", flexShrink: 0 }} />, text: `The time duration for the test is ${testMeta?.durationMinutes ?? 60} minutes.` },
                  { icon: <span style={{ width: 0, height: 0, borderTop: "10px solid transparent", borderBottom: "10px solid transparent", borderLeft: "16px solid #22c55e", display: "inline-block", flexShrink: 0 }} />, text: "Use Save & Next to move forward and Previous to go back." },
                  { icon: <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#7c3aed", display: "inline-block", flexShrink: 0 }} />, text: "You can change or clear your answer anytime before submission." },
                  { icon: <span style={{ position: "relative", width: 22, height: 22, borderRadius: "50%", background: "#7c3aed", display: "inline-block", flexShrink: 0 }}><span style={{ position: "absolute", bottom: -3, right: -3, width: 11, height: 11, borderRadius: "50%", background: "#22c55e", border: "1.5px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#fff" }}>✓</span></span>, text: "Use Mark for Review & Next to revisit questions later (answered & marked will be evaluated)." },
                  { icon: <span style={{ width: 22, height: 22, borderRadius: 3, background: "#f3f4f6", border: "1.5px solid #9ca3af", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>1</span>, text: "Check question status using the Question Palette on the right." },
                ].map((item, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ marginTop: 1 }}>{item.icon}</span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>

              <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#1f2937", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                    checked={instructionsChecked}
                    onChange={(e) => setInstructionsChecked(e.target.checked)}
                  />
                  I have read and understood all the instructions.
                </label>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                  <button
                    disabled={!instructionsChecked}
                    onClick={async () => {
                      try { await handleStart(); setInstructionsOpen(false); } catch {}
                    }}
                    style={{
                      padding: "9px 32px",
                      background: instructionsChecked ? "#1e3a8a" : "#9ca3af",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: instructionsChecked ? "pointer" : "not-allowed",
                      letterSpacing: 1,
                    }}
                  >
                    PROCEED
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

            {/* ─── TOP HEADER BAR ─── */}
            <div style={{ background: "#1e3a8a", color: "#fff", padding: "0 12px", height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: 0.5, truncate: true, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {testMeta.title}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 12, padding: "0", borderRadius: 20, whiteSpace: "nowrap" }}>
                  {isStarted ? (
                    <TimerChip 
                      key={timerKey} 
                      initialSeconds={timerStartSeconds} 
                      onTimeUp={handleTimeUp} 
                      className="bg-white/20 text-white border border-white/30 h-8 py-0 px-3 text-sm font-bold"
                    />
                  ) : (
                    <span style={{ background: "rgba(255,255,255,0.15)", padding: "3px 10px", borderRadius: 20 }}>{testMeta.durationMinutes} min</span>
                  )}
                </div>
                {/* Mobile palette button */}
                <button
                  onClick={(e) => { e.stopPropagation(); setMobilePaletteOpen(true); }}
                  style={{ display: "none", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 6, color: "#fff", padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", pointerEvents: "auto" }}
                  className="mobile-palette-btn"
                >
                  <LayoutGrid size={14} /> Palette
                </button>
              </div>
            </div>

      {/* ─── MAIN BODY ─── */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "row", overflow: "hidden" }}>

        {/* LEFT: Question Panel */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Section tabs */}
          {testMeta.sections.length > 1 && (
            <div style={{ background: "#e5e7eb", borderBottom: "1px solid #d1d5db", display: "flex", overflowX: "auto", flexShrink: 0 }}>
              {testMeta.sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setCurrentSectionId(section.id)}
                  style={{
                    padding: "7px 16px",
                    fontSize: 13,
                    fontWeight: currentSectionId === section.id ? 700 : 400,
                    borderBottom: currentSectionId === section.id ? "3px solid #1e3a8a" : "3px solid transparent",
                    color: currentSectionId === section.id ? "#1e3a8a" : "#374151",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {section.name}
                </button>
              ))}
            </div>
          )}

          {/* Question number + scroll area */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0" }}>
            {/* Question header bar */}
            <div style={{ background: "#dbeafe", borderBottom: "1px solid #bfdbfe", padding: "6px 14px", fontSize: 13, fontWeight: 700, color: "#1e3a8a", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <span>Question {currentIndex + 1}:</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 400, color: "#3b82f6" }}>
                  {saving ? "⬆ Saving…" : lastSavedAt ? "✓ Saved" : "Ready"}
                </span>
                {!isStarted && (
                  <button
                    onClick={handleStart}
                    style={{ background: "#1e3a8a", color: "#fff", border: "none", borderRadius: 5, padding: "4px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                  >
                    {attemptId ? "Resume" : "Start Test"}
                  </button>
                )}
              </div>
            </div>

            <div style={{ padding: "12px 16px" }}>
              {/* Passage */}
              {!!currentQuestion.passage && (
                <div style={{ padding: 12, background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{currentQuestion.passage.title}</div>
                  <div style={{ whiteSpace: "pre-line", color: "#374151" }}>{currentQuestion.passage.content}</div>
                </div>
              )}

              {/* Question stem */}
              <div style={{ fontSize: 13, color: "#1f2937", lineHeight: 1.7, marginBottom: 16 }}>
                <HtmlView html={currentQuestion.stem} className="flex-1" />
              </div>

              {/* Options – MCQ */}
              {currentQuestion.type === "mcq" && currentQuestion.options && (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Options :</div>
                  {currentQuestion.options.map((option, i) => {
                    const isSelected = selectedAnswer === option.id;
                    return (
                      <label
                        key={option.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          padding: "8px 10px",
                          borderRadius: 5,
                          cursor: isStarted ? "pointer" : "not-allowed",
                          background: isSelected ? "#dbeafe" : "transparent",
                          border: isSelected ? "1px solid #93c5fd" : "1px solid transparent",
                          marginBottom: 4,
                          transition: "background 0.15s",
                        }}
                      >
                        <input
                          type="radio"
                          name={`q_${currentQuestion.id}`}
                          value={option.id}
                          checked={isSelected}
                          disabled={!isStarted}
                          onChange={() => handleSelectOption(option.id)}
                          style={{ marginTop: 2, accentColor: "#1e3a8a", cursor: isStarted ? "pointer" : "not-allowed" }}
                        />
                        <span style={{ fontSize: 13, color: "#1f2937", lineHeight: 1.6 }}>
                          <span style={{ fontWeight: 700, marginRight: 4 }}>{String.fromCharCode(65 + i)}.</span>
                          <HtmlView html={option.text} className="inline" />
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Integer type */}
              {currentQuestion.type === "integer" && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 6, textTransform: "uppercase" }}>Your Answer :</div>
                  <input
                    type="number"
                    placeholder="Enter integer answer"
                    value={selectedAnswer || ""}
                    onChange={(e) => handleSelectOption(e.target.value)}
                    disabled={!isStarted}
                    style={{ padding: "8px 12px", border: "1.5px solid #d1d5db", borderRadius: 5, fontSize: 14, width: 200, outline: "none" }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ─── ACTION BUTTONS ROW ─── */}
          <div style={{ flexShrink: 0, borderTop: "1px solid #e5e7eb", background: "#f9fafb", padding: "8px 12px", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            {/* Save & Next */}
            <button
              onClick={handleSaveAndNext}
              disabled={!isStarted}
              style={{ background: isStarted ? "#22c55e" : "#9ca3af", color: "#fff", border: "none", borderRadius: 4, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: isStarted ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}
            >
              SAVE &amp; NEXT
            </button>

            {/* Clear */}
            <button
              onClick={handleClearResponse}
              disabled={!isStarted}
              style={{ background: "#fff", color: "#374151", border: "1.5px solid #d1d5db", borderRadius: 4, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: isStarted ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}
            >
              CLEAR
            </button>

            {/* Save & Mark for Review */}
            <button
              onClick={handleSaveAndMarkForReview}
              disabled={!isStarted}
              style={{ background: isStarted ? "#7c3aed" : "#9ca3af", color: "#fff", border: "none", borderRadius: 4, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: isStarted ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}
            >
              SAVE &amp; MARK FOR REVIEW
            </button>

            {/* Mark for Review & Next */}
            <button
              onClick={handleMarkForReviewAndNext}
              disabled={!isStarted}
              style={{ background: isStarted ? "#2563eb" : "#9ca3af", color: "#fff", border: "none", borderRadius: 4, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: isStarted ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}
            >
              MARK FOR REVIEW &amp; NEXT
            </button>
          </div>

          {/* ─── NAVIGATION ROW ─── */}
          <div style={{ flexShrink: 0, borderTop: "1px solid #e5e7eb", background: "#fff", padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => goToIndex(currentIndex - 1)}
                disabled={currentIndex === 0}
                style={{ background: currentIndex === 0 ? "#e5e7eb" : "#fff", color: currentIndex === 0 ? "#9ca3af" : "#374151", border: "1.5px solid #d1d5db", borderRadius: 4, padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: currentIndex === 0 ? "not-allowed" : "pointer" }}
              >
                &lt;&lt; BACK
              </button>
              <button
                onClick={() => goToIndex(currentIndex + 1)}
                disabled={currentIndex === questions.length - 1}
                style={{ background: currentIndex === questions.length - 1 ? "#e5e7eb" : "#fff", color: currentIndex === questions.length - 1 ? "#9ca3af" : "#374151", border: "1.5px solid #d1d5db", borderRadius: 4, padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: currentIndex === questions.length - 1 ? "not-allowed" : "pointer" }}
              >
                NEXT &gt;&gt;
              </button>
            </div>

            <button
              onClick={() => setSubmitDialogOpen(true)}
              disabled={!isStarted}
              style={{ background: isStarted ? "#22c55e" : "#9ca3af", color: "#fff", border: "none", borderRadius: 4, padding: "7px 22px", fontSize: 13, fontWeight: 700, cursor: isStarted ? "pointer" : "not-allowed" }}
            >
              SUBMIT
            </button>
          </div>
        </div>

        {/* ─── RIGHT: Question Palette (desktop) ─── */}
        <div
          className="desktop-palette"
          style={{
            width: 260,
            flexShrink: 0,
            background: "#fff",
            borderLeft: "1px solid #d1d5db",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb", fontWeight: 700, fontSize: 13, color: "#1e3a8a" }}>
            Question Palette
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <PaletteContent />
          </div>
        </div>
      </div>

      {/* ─── MOBILE PALETTE SHEET ─── */}
      <Sheet open={mobilePaletteOpen} onOpenChange={setMobilePaletteOpen}>
        <SheetContent side="bottom" className="lg:hidden h-[80dvh] rounded-t-2xl px-0 pb-0 z-[200] mobile-palette-sheet">
          <SheetHeader className="px-4 pt-6 pb-4 border-b text-left relative" style={{ background: "#1e3a8a" }}>
            <SheetTitle style={{ color: "#fff", fontSize: 14 }}>Question Palette</SheetTitle>
            <SheetDescription className="sr-only">
              Quickly navigate between questions and view your attempt status.
            </SheetDescription>
          </SheetHeader>
          <div style={{ overflowY: "auto", height: "calc(80dvh - 56px)" }}>
            <PaletteContent onClose={() => setMobilePaletteOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* ─── PROCTORING VIOLATION WARNING MODAL ─── */}
      {violationModalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(5px)" }}>
          <div style={{ width: "100%", maxWidth: 480, borderRadius: 16, background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,0.4)", overflow: "hidden", textAlign: "center", padding: "35px 25px" }}>
            <div style={{ color: "#f59e0b", marginBottom: 20 }}>
              <AlertTriangle size={64} style={{ margin: "0 auto" }} />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginBottom: 12 }}>Proctoring Warning!</h2>
            <p style={{ fontSize: 15, color: "#4b5563", marginBottom: 28, lineHeight: 1.6 }}>
              You have left the test environment (Tab Switch or Full-screen Exit). <br />
              This is a violation of the test rules. <br /><br />
              <strong>Do you want to submit and exit the test?</strong>
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => {
                  handleSubmit(true);
                  setViolationModalOpen(false);
                }}
                style={{ flex: 1, padding: "12px 20px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 10px rgba(239,68,68,0.2)" }}
              >
                Yes, Submit &amp; Exit
              </button>
              <button
                onClick={async () => {
                  await requestFullscreenSafe();
                  setViolationModalOpen(false);
                }}
                style={{ flex: 1, padding: "12px 20px", background: "#1e3a8a", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 10px rgba(30,58,138,0.2)" }}
              >
                No, Return to Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── SUBMIT DIALOG ─── */}
      {submitDialogOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ width: "100%", maxWidth: 420, borderRadius: 10, background: "#fff", boxShadow: "0 8px 40px rgba(0,0,0,0.25)", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "flex-start", gap: 12 }}>
              <AlertTriangle size={20} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1f2937" }}>Submit Test?</div>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>Are you sure? You won't be able to change your answers after submission.</div>
              </div>
            </div>

            <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ padding: 12, borderRadius: 8, background: "#dcfce7", textAlign: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 22, color: "#16a34a" }}>{answeredCount}</div>
                <div style={{ fontSize: 12, color: "#374151" }}>Answered</div>
              </div>
              <div style={{ padding: 12, borderRadius: 8, background: "#fee2e2", textAlign: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 22, color: "#dc2626" }}>{unansweredVisitedCount}</div>
                <div style={{ fontSize: 12, color: "#374151" }}>Not Answered</div>
              </div>
            </div>

            <div style={{ padding: "12px 18px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => setSubmitDialogOpen(false)}
                style={{ background: "#fff", color: "#374151", border: "1.5px solid #d1d5db", borderRadius: 6, padding: "7px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={!isStarted || saving}
                style={{ background: isStarted ? "#22c55e" : "#9ca3af", color: "#fff", border: "none", borderRadius: 6, padding: "7px 20px", fontSize: 13, fontWeight: 700, cursor: isStarted ? "pointer" : "not-allowed" }}
              >
                {saving ? "Submitting..." : "Submit Test"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── RESPONSIVE STYLES ─── */}
      <style>{`
        @media (max-width: 768px) {
          .desktop-palette { display: none !important; }
          .mobile-palette-btn { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mobile-palette-btn { display: none !important; }
          .desktop-palette { display: flex !important; }
        }
        .question-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 10px;
        }
        @media (max-width: 480px) {
          .question-grid {
            grid-template-columns: repeat(8, 1fr);
            gap: 8px;
          }
        }
        /* Fix for Sheet z-index - ensure portals appear on top of test container */
        [data-radix-portal] {
          z-index: 200 !important;
          position: relative;
        }
        /* Ensure mobile palette sheet close button is visible */
        .mobile-palette-sheet button.absolute {
          color: white !important;
          opacity: 1 !important;
          background: rgba(255,255,255,0.1) !important;
          border-radius: 50% !important;
          width: 32px !important;
          height: 32px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          top: 24px !important;
          right: 12px !important;
        }
        .mobile-palette-sheet button.absolute svg {
          width: 20px !important;
          height: 20px !important;
        }
      `}</style>
    </div>
  );
}