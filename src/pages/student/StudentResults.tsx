import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Trophy, Target, Clock, TrendingUp, Eye, Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AIReviewPanel } from "@/components/student/AIReviewPanel";

import { useAuth } from "@/contexts/AuthProvider";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, updateDoc, serverTimestamp } from "firebase/firestore";
import { useAIStream } from "@/hooks/useAIStream";
import { aiFeatureFlags, getAiFeatureDisabledMessage } from "@/lib/aiFeatureFlags";

type AttemptResponse = {
  answer: string | null;
  markedForReview: boolean;
  visited: boolean;
  answered: boolean;
};

type AttemptDoc = {
  studentId: string;
  educatorId: string;
  tenantSlug?: string | null;

  testId: string;
  testTitle?: string;
  subject?: string;

  status?: "in_progress" | "submitted";

  durationSec?: number;
  startedAtMs?: number;
  timeTakenSec?: number;

  score?: number;
  maxScore?: number;
  accuracy?: number; // may be 0..1 or 0..100

  responses?: Record<string, AttemptResponse>;

  // optional (if you add later)
  aiReviewStatus?: "queued" | "in-progress" | "completed" | "failed";
  aiReview?: any;

  // optional (if you add later)
  rank?: number;
  totalParticipants?: number;
};

type QuestionDoc = {
  sectionId?: string;
  type?: "mcq" | "integer";
  text?: string;
  options?: string[];
  correctOptionIndex?: number;
  correctAnswer?: string | number;
  explanation?: string;
  positiveMarks?: number;
  negativeMarks?: number;
  marks?: number;
  questionOrder?: number;
};

type TestDoc = {
  title?: string;
  subject?: string;
  durationMinutes?: number;
  sections?: { id: string; name: string }[];
};

type SectionScore = { sectionName: string; score: number; maxScore: number };

function safeNumber(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseMcqCorrectIndex(value: any, optionCount: number): number | null {
  if (value === null || value === undefined) return null;

  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) {
    if (asNumber >= 0 && asNumber < optionCount) return Math.trunc(asNumber);
    if (asNumber >= 1 && asNumber <= optionCount) return Math.trunc(asNumber - 1);
  }

  const raw = String(value).trim().toUpperCase();
  if (!raw) return null;

  const letterMatch = raw.match(/^(?:OPTION\s*)?([A-Z])$/);
  if (letterMatch) {
    const idx = letterMatch[1].charCodeAt(0) - 65;
    if (idx >= 0 && idx < optionCount) return idx;
  }

  return null;
}

function normalizeAccuracyPercent(val: any, fallback = 0) {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  const pct = n <= 1.01 ? n * 100 : n;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  return `${mins} min`;
}

function isAnswered(val: any) {
  return val !== null && val !== undefined && String(val).trim() !== "";
}

function computeFromQuestionsAndResponses(
  questions: { id: string; data: QuestionDoc }[],
  responses: Record<string, AttemptResponse>,
  sectionNameById: Record<string, string>
) {
  let score = 0;
  let maxScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;

  const perSection: Record<string, { score: number; maxScore: number }> = {};

  for (const q of questions) {
    const d = q.data;
    const sectionId = d.sectionId || "main";
    const pos = safeNumber((d as any).marks ?? d.positiveMarks, 5);
    const neg = Math.abs(safeNumber(d.negativeMarks, 1));


    maxScore += pos;
    perSection[sectionId] = perSection[sectionId] || { score: 0, maxScore: 0 };
    perSection[sectionId].maxScore += pos;

    const userAnswer = responses[q.id]?.answer ?? null;

    if (!isAnswered(userAnswer)) continue;

    const type = d.type === "integer" ? "integer" : "mcq";
    let isCorrect = false;

    if (type === "integer") {
      isCorrect = String(userAnswer).trim() === String(d.correctAnswer ?? "").trim();
    } else {
      const optionCount = Array.isArray(d.options) && d.options.length ? d.options.length : 4;
      const correctIndex = parseMcqCorrectIndex(
        (d as any).correctOption ?? d.correctOptionIndex ?? d.correctAnswer,
        optionCount
      );
      isCorrect = String(userAnswer) === String(correctIndex ?? 0);
    }

    if (isCorrect) {
      score += pos;
      perSection[sectionId].score += pos;
      correctCount += 1;
    } else {
      score -= neg;
      perSection[sectionId].score -= neg;
      incorrectCount += 1;
    }
  }

  const attempted = correctCount + incorrectCount;
  const accuracyPct = attempted > 0 ? Math.round((correctCount / attempted) * 100) : 0;

  const sectionScores: SectionScore[] = Object.keys(perSection).map((sid) => ({
    sectionName: sectionNameById[sid] || sid,
    score: perSection[sid].score,
    maxScore: perSection[sid].maxScore,
  }));

  return { score, maxScore, accuracyPct, sectionScores };
}

export default function StudentResults() {
  const { attemptId } = useParams();
  const { firebaseUser, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // AI Analysis with streaming
  const { progress: aiProgress, error: aiError, cancel: cancelAI } = useAIStream();
  const isAiPerformanceAnalysisEnabled = aiFeatureFlags.performanceAnalysis;

  const [attempt, setAttempt] = useState<AttemptDoc | null>(null);
  const [sectionScores, setSectionScores] = useState<SectionScore[]>([]);
  const [computedScore, setComputedScore] = useState<number | null>(null);
  const [computedMaxScore, setComputedMaxScore] = useState<number | null>(null);
  const [computedAccuracyPct, setComputedAccuracyPct] = useState<number | null>(null);
  
  // Store questions for AI analysis
  const [questionsData, setQuestionsData] = useState<{ id: string; data: QuestionDoc }[]>([]);

  const rank = attempt?.rank ?? 0;
  const totalParticipants = attempt?.totalParticipants ?? 0;

  const percentileText = useMemo(() => {
    if (!rank || !totalParticipants) return "—";
    const top = Math.round((rank / totalParticipants) * 100);
    return `Top ${top}%`;
  }, [rank, totalParticipants]);

  const { request: requestAIAnalysis } = useAIStream();

  async function triggerAIAnalysis(
    questions: { id: string; data: QuestionDoc }[],
    responses: Record<string, AttemptResponse>,
    testTitle: string,
    subject: string,
    score: number,
    maxScore: number,
    accuracy: number
  ) {
    if (!isAiPerformanceAnalysisEnabled) return;
    if (!attemptId) return;

    // Set status to in-progress
    setAttempt((prev) =>
      prev
        ? {
            ...prev,
            aiReviewStatus: "in-progress",
          }
        : null
    );

    try {
      // Prepare the data for the API
      const userResponses = questions.map((q) => {
        const resp = responses[q.id];
        const userAnswer = resp?.answer ?? null;
        const isCorrect = userAnswer !== null && userAnswer !== undefined;
        return {
          questionId: q.id,
          userAnswer: userAnswer ? String(userAnswer) : null,
          isCorrect,
          marks: safeNumber((q.data as any).marks ?? q.data.positiveMarks, 5),
        };
      });

      const analysisRequest = {
        questions: questions.map((q) => ({
          id: q.id,
          text: q.data.text || "",
          type: q.data.type || "mcq",
          options: q.data.options,
          correctOptionIndex: q.data.correctOptionIndex,
          correctAnswer: q.data.correctAnswer,
          explanation: q.data.explanation,
          section: q.data.sectionId || "General",
          marks: safeNumber((q.data as any).marks ?? q.data.positiveMarks, 5),
        })),
        responses: userResponses,
        testTitle,
        subject,
        totalScore: score,
        maxScore,
        accuracy,
      };

      const analysis = await requestAIAnalysis("/api/ai/analyze-performance", analysisRequest);

      // Update attempt with the analysis
      setAttempt((prev) =>
        prev
          ? {
              ...prev,
              aiReviewStatus: "completed",
              aiReview: analysis,
            }
          : null
      );
    } catch (err) {
      console.error("Error getting AI analysis:", err);
      setAttempt((prev) =>
        prev
          ? {
              ...prev,
              aiReviewStatus: "failed",
            }
          : null
      );
    }
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!attemptId) {
        setError("Missing attempt id");
        setLoading(false);
        return;
      }
      if (authLoading) return;
      if (!firebaseUser) {
        setError("Please login to view your results.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 1) Attempt
        const aSnap = await getDoc(doc(db, "attempts", attemptId));
        if (!aSnap.exists()) throw new Error("Attempt not found.");

        const a = aSnap.data() as AttemptDoc;

        // student can only view their own attempt
        if (a.studentId !== firebaseUser.uid) throw new Error("You don't have permission to view this attempt.");

        if (!a.educatorId || !a.testId) throw new Error("Attempt is missing test reference.");

        let testData: TestDoc | null = null;
        let qs: { id: string; data: QuestionDoc }[] = [];

        const educatorTestSnap = await getDoc(doc(db, "educators", a.educatorId, "my_tests", a.testId));

        if (educatorTestSnap.exists()) {
          const localTest = educatorTestSnap.data() as any;
          const linkedAdminTestId = String(localTest?.linkedAdminTestId || localTest?.originalTestId || "").trim();
          const isAdminLinked =
            localTest?.originSource === "admin" ||
            localTest?.source === "imported" ||
            localTest?.source === "linked_admin" ||
            localTest?.isQuestionSourceShared === true ||
            Boolean(linkedAdminTestId);

          if (isAdminLinked && linkedAdminTestId) {
            const adminTestSnap = await getDoc(doc(db, "test_series", linkedAdminTestId));
            if (adminTestSnap.exists()) {
              testData = adminTestSnap.data() as TestDoc;
            } else {
              testData = localTest as TestDoc;
            }

            const qSnap = await getDocs(collection(db, "test_series", linkedAdminTestId, "questions"));
            qs = qSnap.docs.map((d) => ({ id: d.id, data: d.data() as QuestionDoc }));
          } else {
            testData = localTest as TestDoc;
            const qSnap = await getDocs(collection(db, "educators", a.educatorId, "my_tests", a.testId, "questions"));
            qs = qSnap.docs.map((d) => ({ id: d.id, data: d.data() as QuestionDoc }));
          }
        }

        if (!testData || !qs.length) {
          const globalTestSnap = await getDoc(doc(db, "test_series", a.testId));
          if (globalTestSnap.exists()) {
            testData = globalTestSnap.data() as TestDoc;
            const qSnap = await getDocs(collection(db, "test_series", a.testId, "questions"));
            qs = qSnap.docs.map((d) => ({ id: d.id, data: d.data() as QuestionDoc }));
          }
        }

        qs = qs.sort((a, b) => {
          const aOrder = safeNumber(a.data.questionOrder, Number.MAX_SAFE_INTEGER);
          const bOrder = safeNumber(b.data.questionOrder, Number.MAX_SAFE_INTEGER);
          return aOrder - bOrder;
        });

        if (!testData) throw new Error("Test not found for this attempt.");
        if (!qs.length) throw new Error("Questions not found for this attempt.");

        // Build section name mapping
        const sectionNameById: Record<string, string> = {};
        if (Array.isArray(testData.sections) && testData.sections.length) {
          testData.sections.forEach((s) => (sectionNameById[s.id] = s.name));
        } else {
          // fallback
          sectionNameById["main"] = testData.subject || "General";
        }

        const resp = a.responses || {};
        const derived = computeFromQuestionsAndResponses(qs, resp, sectionNameById);

        if (!mounted) return;

        // Store questions data for AI analysis
        setQuestionsData(qs);

        // prefer stored values when present, otherwise computed
        setAttempt({
          ...a,
          testTitle: a.testTitle || testData.title || "Untitled Test",
          subject: a.subject || testData.subject || "General",
        });

        setSectionScores(derived.sectionScores);

        setComputedScore(derived.score);
        setComputedMaxScore(derived.maxScore);
        setComputedAccuracyPct(derived.accuracyPct);

        // If stored score differs from recomputed, write back so dashboard/leaderboard stay in sync
        if (a.score !== derived.score || a.maxScore !== derived.maxScore) {
          updateDoc(doc(db, "attempts", attemptId!), {
            score: derived.score,
            maxScore: derived.maxScore,
            accuracy: derived.accuracyPct / 100,
            marksRecalculatedAt: serverTimestamp(),
          }).catch(console.error);
        }

        // Trigger AI analysis if not already completed
        if (isAiPerformanceAnalysisEnabled && (!a.aiReviewStatus || a.aiReviewStatus === "queued") && !a.aiReview) {
          triggerAIAnalysis(qs, resp, a.testTitle || testData.title || "Untitled Test", a.subject || testData.subject || "General", derived.score, derived.maxScore, derived.accuracyPct);
        }
      } catch (e: any) {
        console.error(e);
        if (!mounted) return;
        setError(e?.message || "Failed to load results.");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [attemptId, firebaseUser, authLoading, isAiPerformanceAnalysisEnabled]);

  if (loading || authLoading) return <div className="text-center py-12">Loading...</div>;
  if (error) return <div className="text-center py-12">{error}</div>;
  if (!attempt) return <div className="text-center py-12">Attempt not found.</div>;

  const score = computedScore ?? 0;
  const maxScore = computedMaxScore ?? 0;
  const accuracyPct = computedAccuracyPct ?? 0;
  const timeSpentSec = safeNumber(attempt.timeTakenSec, 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Button variant="ghost" asChild>
        <Link to="/student/attempts">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Attempts
        </Link>
      </Button>

      {/* Score Header */}
      <Card className="card-soft border-0 bg-gradient-to-r from-pastel-mint to-pastel-lavender">
        <CardContent className="p-6 text-center">
          <h1 className="text-2xl font-bold mb-2">{attempt.testTitle || "Test"}</h1>
          <div className="text-5xl font-bold gradient-text mb-2">
            {score}/{maxScore}
          </div>
          <p className="text-muted-foreground">Your Score</p>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="card-soft border-0 bg-pastel-yellow">
          <CardContent className="p-4 text-center">
            <Target className="h-6 w-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{accuracyPct}%</p>
            <p className="text-xs text-muted-foreground">Accuracy</p>
          </CardContent>
        </Card>

        <Card className="card-soft border-0 bg-pastel-lavender">
          <CardContent className="p-4 text-center">
            <Trophy className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
            <p className="text-2xl font-bold">{rank ? `#${rank}` : "—"}</p>
            <p className="text-xs text-muted-foreground">Rank</p>
          </CardContent>
        </Card>

        <Card className="card-soft border-0 bg-pastel-peach">
          <CardContent className="p-4 text-center">
            <Clock className="h-6 w-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{formatTime(timeSpentSec)}</p>
            <p className="text-xs text-muted-foreground">Time Spent</p>
          </CardContent>
        </Card>

        <Card className="card-soft border-0 bg-pastel-mint">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-600" />
            <p className="text-2xl font-bold">{percentileText}</p>
            <p className="text-xs text-muted-foreground">Percentile</p>
          </CardContent>
        </Card>
      </div>

      {/* Section Breakdown */}
      <Card className="card-soft border-0">
        <CardHeader>
          <CardTitle>Section-wise Performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sectionScores.length === 0 ? (
            <div className="text-sm text-muted-foreground">No section breakdown available.</div>
          ) : (
            sectionScores.map((section, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{section.sectionName}</span>
                  <span className="font-medium">
                    {section.score}/{section.maxScore}
                  </span>
                </div>
                <Progress value={section.maxScore ? (section.score / section.maxScore) * 100 : 0} className="h-2" />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* AI Review */}
      {isAiPerformanceAnalysisEnabled ? (
        <AIReviewPanel 
          status={attempt.aiReviewStatus ?? "queued"} 
          review={attempt.aiReview}
          progress={aiProgress}
          error={aiError}
          onCancel={cancelAI}
        />
      ) : (
        <Card className="card-soft border-0 bg-muted/40">
          <CardHeader>
            <CardTitle>AI Review Unavailable</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {getAiFeatureDisabledMessage("performanceAnalysis")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <Button variant="outline" className="flex-1 rounded-xl" asChild>
          <Link to={`/student/attempts/${attemptId}`}>
            <Eye className="h-4 w-4 mr-2" />
            Review Answers
          </Link>
        </Button>

        <Button className="flex-1 rounded-xl gradient-bg" asChild>
          <Link to="/student/tests">Take Another Test</Link>
        </Button>
      </div>
    </div>
  );
}

