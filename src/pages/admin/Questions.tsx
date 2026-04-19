// pages/admin/Questions.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Plus,
  Search,
  Trash2,
  Edit,
  Copy,
  CheckCircle2,
  XCircle,
  BarChart3,
  Loader2,
  Download,
  Upload,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import ImageTextarea from "@/components/educator/ImageTextarea";

type Difficulty = "easy" | "medium" | "hard";

type TestSeries = {
  id: string;
  title: string;
  subject?: string;
  level?: string;
  durationMinutes?: number;
  positiveMarks?: number;
  negativeMarks?: number;
  questionsCount?: number;
};

type QuestionDoc = {
  id: string;
  question: string;
  options: string[];
  correctOption: number; // index
  explanation?: string;
  difficulty: Difficulty;
  subject?: string;
  topic?: string;

  marks?: number;
  negativeMarks?: number;

  isActive?: boolean;
  usageCount?: number;

  // ✅ new: supports mixing global question bank + manual questions
  source?: "manual" | "question_bank" | string;
  bankQuestionId?: string;
  contentFormat?: "text" | "html";

  createdAtTs?: Timestamp | null;
  updatedAtTs?: Timestamp | null;
};

type QBQuestion = {
  id: string;
  subject?: string;
  topic?: string;
  difficulty?: Difficulty;
  question: string; // HTML
  options: string[]; // HTML
  correctOption: number;
  explanation?: string;
  marks?: number;
  negativeMarks?: number;
  updatedAtTs?: Timestamp | null;
};

function stripHtml(html: string) {
  if (!html) return "";
  try {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
  } catch {
    return String(html);
  }
}

function fmtDate(ts?: Timestamp | null) {
  if (!ts) return "—";
  try {
    return ts.toDate().toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function difficultyBadge(d: Difficulty) {
  if (d === "easy") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (d === "hard") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
}

function safeStr(v: any, fb = "") {
  return typeof v === "string" ? v : fb;
}
function safeNum(v: any, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}
function normalizeDifficulty(v: any): Difficulty {
  const s = String(v || "").toLowerCase().trim();
  if (s === "easy" || s === "medium" || s === "hard") return s;
  return "medium";
}

const DIFFICULTY_OPTIONS: Difficulty[] = ["easy", "medium", "hard"];

export default function Questions() {
  const navigate = useNavigate();
  const { testId } = useParams<{ testId: string }>();

  const [uid, setUid] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [tests, setTests] = useState<TestSeries[]>([]);
  const [testsLoading, setTestsLoading] = useState(true);

  const [selectedTestId, setSelectedTestId] = useState<string>(testId || "");
  const selectedTest = useMemo(
    () => tests.find((t) => t.id === selectedTestId) || null,
    [tests, selectedTestId]
  );

  const [questions, setQuestions] = useState<QuestionDoc[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);

  // filters
  const [search, setSearch] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<"all" | Difficulty>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // editor dialog
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formQuestion, setFormQuestion] = useState("");
  const [formOptions, setFormOptions] = useState<string[]>(["", "", "", ""]);
  const [formCorrect, setFormCorrect] = useState<number>(0);
  const [formExplanation, setFormExplanation] = useState("");
  const [formDifficulty, setFormDifficulty] = useState<Difficulty>("medium");
  const [formSubject, setFormSubject] = useState("");
  const [formTopic, setFormTopic] = useState("");
  const [formMarks, setFormMarks] = useState<string>("");
  const [formNegMarks, setFormNegMarks] = useState<string>("");
  const [formActive, setFormActive] = useState(true);

  // bulk import dialog
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  // import from GLOBAL question bank
  const [qbOpen, setQbOpen] = useState(false);
  const [qbLoading, setQbLoading] = useState(false);
  const [qbRows, setQbRows] = useState<QBQuestion[]>([]);
  const [qbSearch, setQbSearch] = useState("");
  const [qbSubject, setQbSubject] = useState<string>("all");
  const [qbTopic, setQbTopic] = useState<string>("all");
  const [qbDifficulty, setQbDifficulty] = useState<"all" | Difficulty>("all");
  const [qbSelected, setQbSelected] = useState<Record<string, boolean>>({});

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Load tests
  useEffect(() => {
    if (!uid) {
      setTests([]);
      setTestsLoading(false);
      return;
    }

    setTestsLoading(true);

    const qTests = query(collection(db, "test_series"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      qTests,
      (snap) => {
        const rows: TestSeries[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            title: safeStr(data?.title, "Untitled Test"),
            subject: safeStr(data?.subject, ""),
            level: safeStr(data?.level, ""),
            durationMinutes: safeNum(data?.durationMinutes ?? data?.duration, 60),
            positiveMarks: safeNum(data?.positiveMarks, undefined as any),
            negativeMarks: safeNum(data?.negativeMarks, undefined as any),
            questionsCount: safeNum(data?.questionsCount, 0),
          };
        });
        setTests(rows);

        // keep URL param testId as priority
        const desired = testId || selectedTestId;
        if (desired && rows.some((t) => t.id === desired)) {
          setSelectedTestId(desired);
        } else if (!desired && rows.length) {
          setSelectedTestId(rows[0].id);
        }

        setTestsLoading(false);
      },
      () => {
        setTests([]);
        setTestsLoading(false);
        toast({
          title: "Failed to load tests",
          description: "Please try again.",
          variant: "destructive",
        });
      }
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // Sync selectedTestId with route param (if route changes)
  useEffect(() => {
    if (testId && testId !== selectedTestId) setSelectedTestId(testId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  // Load questions
  useEffect(() => {
    if (!uid || !selectedTestId) {
      setQuestions([]);
      setQuestionsLoading(false);
      return;
    }

    setQuestionsLoading(true);

    const qQs = query(
      collection(db, "test_series", selectedTestId, "questions"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      qQs,
      (snap) => {
        const rows: QuestionDoc[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            question: safeStr(data?.question, ""),
            options: Array.isArray(data?.options) ? data.options.map(String) : [],
            correctOption: safeNum(data?.correctOption, 0),
            explanation: safeStr(data?.explanation, ""),
            difficulty: normalizeDifficulty(data?.difficulty),
            subject: safeStr(data?.subject, ""),
            topic: safeStr(data?.topic, ""),
            marks: data?.marks != null ? safeNum(data?.marks, 0) : undefined,
            negativeMarks: data?.negativeMarks != null ? safeNum(data?.negativeMarks, 0) : undefined,
            isActive: data?.isActive !== false,
            usageCount: safeNum(data?.usageCount, 0),
            source: safeStr(data?.source, undefined as any) as any,
            bankQuestionId: safeStr(data?.bankQuestionId, "") || undefined,
            contentFormat: (safeStr(data?.contentFormat, "") as any) || undefined,
            createdAtTs: (data?.createdAt as Timestamp) || null,
            updatedAtTs: (data?.updatedAt as Timestamp) || null,
          };
        });

        setQuestions(rows);
        setQuestionsLoading(false);
      },
      () => {
        setQuestions([]);
        setQuestionsLoading(false);
        toast({
          title: "Failed to load questions",
          description: "Please try again.",
          variant: "destructive",
        });
      }
    );

    return () => unsub();
  }, [uid, selectedTestId]);

  const existingBankIds = useMemo(() => {
    const s = new Set<string>();
    questions.forEach((q) => {
      if (q.bankQuestionId) s.add(String(q.bankQuestionId));
    });
    return s;
  }, [questions]);

  // Load global question bank when dialog opens
  useEffect(() => {
    if (!uid || !qbOpen) return;

    let alive = true;
    (async () => {
      try {
        setQbLoading(true);
        const qRef = query(collection(db, "question_bank"), orderBy("updatedAt", "desc"));
        const snap = await getDocs(qRef);
        if (!alive) return;

        const rows: QBQuestion[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            subject: safeStr(data?.subject, ""),
            topic: safeStr(data?.topic, ""),
            difficulty: normalizeDifficulty(data?.difficulty),
            question: safeStr(data?.question, ""),
            options: Array.isArray(data?.options) ? data.options.map(String) : [],
            correctOption: safeNum(data?.correctOption, 0),
            explanation: safeStr(data?.explanation, ""),
            marks: data?.marks != null ? safeNum(data?.marks, 0) : undefined,
            negativeMarks: data?.negativeMarks != null ? safeNum(data?.negativeMarks, 0) : undefined,
            updatedAtTs: (data?.updatedAt as Timestamp) || null,
          };
        });

        setQbRows(rows);
        setQbSelected({});
        setQbSearch("");
        setQbSubject("all");
        setQbTopic("all");
        setQbDifficulty("all");
      } catch (e) {
        console.error(e);
        toast({
          title: "Failed to load question bank",
          description: "Could not fetch global questions.",
          variant: "destructive",
        });
      } finally {
        setQbLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [uid, qbOpen]);

  const qbSubjects = useMemo(() => {
    const s = new Set<string>();
    qbRows.forEach((q) => q.subject && s.add(q.subject));
    return ["all", ...Array.from(s).sort((a, b) => a.localeCompare(b))];
  }, [qbRows]);

  const qbTopics = useMemo(() => {
    const s = new Set<string>();
    qbRows.forEach((q) => {
      if (qbSubject !== "all" && q.subject !== qbSubject) return;
      q.topic && s.add(q.topic);
    });
    return ["all", ...Array.from(s).sort((a, b) => a.localeCompare(b))];
  }, [qbRows, qbSubject]);

  const qbFiltered = useMemo(() => {
    const q = qbSearch.trim().toLowerCase();
    return qbRows.filter((x) => {
      if (qbDifficulty !== "all" && (x.difficulty || "medium") !== qbDifficulty) return false;
      if (qbSubject !== "all" && (x.subject || "") !== qbSubject) return false;
      if (qbTopic !== "all" && (x.topic || "") !== qbTopic) return false;
      if (!q) return true;
      const hay = [stripHtml(x.question), x.subject || "", x.topic || "", ...(x.options || []).map(stripHtml)]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [qbRows, qbSearch, qbDifficulty, qbSubject, qbTopic]);

  const qbSelectedIds = useMemo(() => Object.keys(qbSelected).filter((id) => qbSelected[id]), [qbSelected]);

  async function importSelectedFromQuestionBank() {
    if (!uid || !selectedTestId) return;
    const rawIds = qbSelectedIds;
    const ids = rawIds.filter((id) => !existingBankIds.has(id));
    if (!ids.length) {
      toast({ title: "Nothing to import", description: "All selected questions are already in this test." });
      return;
    }

    const byId = new Map(qbRows.map((q) => [q.id, q] as const));
    const items = ids.map((id) => byId.get(id)).filter(Boolean) as QBQuestion[];
    if (!items.length) {
      toast({ title: "Nothing to import", description: "Selected questions were not found." });
      return;
    }

    try {
      setQbLoading(true);

      let batch = writeBatch(db);
      let ops = 0;
      let added = 0;

      for (const q of items) {
        const docRef = doc(collection(db, "test_series", selectedTestId, "questions"));

        const payload: any = {
          question: q.question,
          options: Array.isArray(q.options) ? q.options : [],
          correctOption: safeNum(q.correctOption, 0),
          explanation: q.explanation || "",
          difficulty: normalizeDifficulty(q.difficulty),
          subject: q.subject || selectedTest?.subject || "",
          topic: q.topic || "",
          isActive: true,
          usageCount: 0,

          // link back to global bank
          source: "question_bank",
          bankQuestionId: q.id,
          contentFormat: "html",

          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        if (q.marks != null) payload.marks = safeNum(q.marks, 0);
        if (q.negativeMarks != null) payload.negativeMarks = safeNum(q.negativeMarks, 0);

        batch.set(docRef, payload);

        // optional: bump usageCount on the global question
        batch.update(doc(db, "question_bank", q.id), {
          usageCount: increment(1),
          updatedAt: serverTimestamp(),
        });

        ops += 2;
        added += 1;
        if (ops >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          ops = 0;
        }
      }

      // update test counts
      batch.update(doc(db, "test_series", selectedTestId), {
        questionsCount: increment(added),
        updatedAt: serverTimestamp(),
      });
      ops += 1;

      if (ops > 0) await batch.commit();

      toast({ title: "Imported", description: `Added ${added} questions from Question Bank.` });
      setQbOpen(false);
    } catch (e) {
      console.error(e);
      toast({ title: "Import failed", description: "Could not import from Question Bank.", variant: "destructive" });
    } finally {
      setQbLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter((x) => {
      if (difficultyFilter !== "all" && x.difficulty !== difficultyFilter) return false;
      const active = x.isActive !== false;
      if (statusFilter === "active" && !active) return false;
      if (statusFilter === "inactive" && active) return false;

      if (!q) return true;

      const hay = [
        x.question,
        (x.subject || ""),
        (x.topic || ""),
        ...(x.options || []),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [questions, search, difficultyFilter, statusFilter]);

  // analytics
  const total = questions.length;
  const activeCount = useMemo(() => questions.filter((q) => q.isActive !== false).length, [questions]);
  const easyCount = useMemo(() => questions.filter((q) => q.difficulty === "easy").length, [questions]);
  const medCount = useMemo(() => questions.filter((q) => q.difficulty === "medium").length, [questions]);
  const hardCount = useMemo(() => questions.filter((q) => q.difficulty === "hard").length, [questions]);

  const activePct = total ? Math.round((activeCount / total) * 100) : 0;

  function resetEditor() {
    setEditingId(null);
    setFormQuestion("");
    setFormOptions(["", "", "", ""]);
    setFormCorrect(0);
    setFormExplanation("");
    setFormDifficulty("medium");
    setFormSubject(selectedTest?.subject || "");
    setFormTopic("");
    setFormMarks(selectedTest?.positiveMarks != null ? String(selectedTest.positiveMarks) : "");
    setFormNegMarks(selectedTest?.negativeMarks != null ? String(selectedTest.negativeMarks) : "");
    setFormActive(true);
  }

  function openCreate() {
    if (!selectedTestId) {
      toast({ title: "Select a test first", description: "Choose a test to add questions." });
      return;
    }
    resetEditor();
    setEditorOpen(true);
  }

  function openEdit(q: QuestionDoc) {
    setEditingId(q.id);
    setFormQuestion(q.question || "");
    setFormOptions(() => {
      const base = Array.isArray(q.options) ? q.options.slice(0, 4) : [];
      while (base.length < 4) base.push("");
      return base;
    });
    setFormCorrect(Number.isFinite(q.correctOption) ? q.correctOption : 0);
    setFormExplanation(q.explanation || "");
    setFormDifficulty(q.difficulty || "medium");
    setFormSubject(q.subject || selectedTest?.subject || "");
    setFormTopic(q.topic || "");
    setFormMarks(q.marks != null ? String(q.marks) : (selectedTest?.positiveMarks != null ? String(selectedTest.positiveMarks) : ""));
    setFormNegMarks(q.negativeMarks != null ? String(q.negativeMarks) : (selectedTest?.negativeMarks != null ? String(selectedTest.negativeMarks) : ""));
    setFormActive(q.isActive !== false);
    setEditorOpen(true);
  }

  async function saveQuestion() {
    if (!uid) return;
    if (!selectedTestId) return;

    const questionText = formQuestion.trim();
    const options = formOptions.map((x) => x.trim()).filter((x) => x.length > 0);

    if (!questionText) {
      toast({ title: "Question required", description: "Please enter the question.", variant: "destructive" });
      return;
    }
    if (options.length < 2) {
      toast({ title: "Options required", description: "Add at least 2 options (recommended 4).", variant: "destructive" });
      return;
    }
    if (formCorrect < 0 || formCorrect >= (Array.isArray(formOptions) ? formOptions.length : 0)) {
      toast({ title: "Invalid correct option", description: "Select a valid correct option index.", variant: "destructive" });
      return;
    }
    if (!formOptions[formCorrect]?.trim()) {
      toast({ title: "Correct option empty", description: "The selected correct option cannot be empty.", variant: "destructive" });
      return;
    }

    const marks = formMarks.trim() === "" ? undefined : safeNum(formMarks, undefined as any);
    const negativeMarks = formNegMarks.trim() === "" ? undefined : safeNum(formNegMarks, undefined as any);

    setSaving(true);
    try {
      const basePayload: any = {
        question: questionText,
        options: formOptions.map((x) => x.trim()),
        correctOption: formCorrect,
        explanation: formExplanation.trim() || "",
        difficulty: formDifficulty,
        subject: formSubject.trim() || selectedTest?.subject || "",
        topic: formTopic.trim() || "",
        isActive: !!formActive,
        usageCount: 0,
        source: "manual",
        contentFormat: "html",
        updatedAt: serverTimestamp(),
      };

      if (marks != null && Number.isFinite(marks)) basePayload.marks = marks;
      if (negativeMarks != null && Number.isFinite(negativeMarks)) basePayload.negativeMarks = negativeMarks;

      if (!editingId) {
        basePayload.createdAt = serverTimestamp();

        await addDoc(collection(db, "test_series", selectedTestId, "questions"), basePayload);

        // keep test_series.questionsCount roughly in sync
        await updateDoc(doc(db, "test_series", selectedTestId), {
          questionsCount: increment(1),
          updatedAt: serverTimestamp(),
        });

        toast({ title: "Question added", description: "Question saved successfully." });
      } else {
        await updateDoc(doc(db, "test_series", selectedTestId, "questions", editingId), basePayload);

        await updateDoc(doc(db, "test_series", selectedTestId), {
          updatedAt: serverTimestamp(),
        });

        toast({ title: "Question updated", description: "Changes saved successfully." });
      }

      setEditorOpen(false);
      resetEditor();
    } catch (e) {
      console.error(e);
      toast({ title: "Save failed", description: "Could not save question.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(q: QuestionDoc, next: boolean) {
    if (!uid || !selectedTestId) return;
    try {
      await updateDoc(doc(db, "test_series", selectedTestId, "questions", q.id), {
        isActive: next,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
      toast({ title: "Update failed", description: "Could not update status.", variant: "destructive" });
    }
  }

  async function deleteQuestion(q: QuestionDoc) {
    if (!uid || !selectedTestId) return;

    const ok = window.confirm("Delete this question? This cannot be undone.");
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "test_series", selectedTestId, "questions", q.id));

      // safer count update (avoid negative)
      await runTransaction(db, async (tx) => {
        const testRef = doc(db, "test_series", selectedTestId);
        const snap = await tx.get(testRef);
        const curr = safeNum((snap.data() as any)?.questionsCount, 0);
        tx.update(testRef, {
          questionsCount: Math.max(0, curr - 1),
          updatedAt: serverTimestamp(),
        });
      });

      toast({ title: "Deleted", description: "Question removed." });
    } catch (e) {
      console.error(e);
      toast({ title: "Delete failed", description: "Could not delete question.", variant: "destructive" });
    }
  }

  async function copyExportJson() {
    try {
      const payload = questions.map((q) => ({
        question: q.question,
        options: q.options,
        correctOption: q.correctOption,
        explanation: q.explanation || "",
        difficulty: q.difficulty,
        subject: q.subject || "",
        topic: q.topic || "",
        marks: q.marks ?? null,
        negativeMarks: q.negativeMarks ?? null,
        isActive: q.isActive !== false,
      }));
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      toast({ title: "Export copied", description: "Questions JSON copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Could not copy export JSON.", variant: "destructive" });
    }
  }

  async function bulkImport() {
    if (!uid || !selectedTestId) return;

    const text = bulkText.trim();
    if (!text) {
      toast({ title: "Paste JSON first", description: "Provide an array of questions in JSON.", variant: "destructive" });
      return;
    }

    let arr: any[] = [];
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("Not array");
      arr = parsed;
    } catch {
      toast({ title: "Invalid JSON", description: "Expected a JSON array.", variant: "destructive" });
      return;
    }

    if (arr.length === 0) {
      toast({ title: "Nothing to import", description: "Array is empty.", variant: "destructive" });
      return;
    }

    setBulkSaving(true);
    try {
      // simple sequential add (safe and minimal setup)
      let added = 0;
      for (const item of arr) {
        const qText = String(item?.question || "").trim();
        const opts = Array.isArray(item?.options) ? item.options.map((x: any) => String(x || "").trim()) : [];
        const correct = safeNum(item?.correctOption, 0);
        if (!qText || opts.length < 2 || correct < 0 || correct >= opts.length) continue;

        const payload: any = {
          question: qText,
          options: opts,
          correctOption: correct,
          explanation: String(item?.explanation || ""),
          difficulty: normalizeDifficulty(item?.difficulty),
          subject: String(item?.subject || selectedTest?.subject || ""),
          topic: String(item?.topic || ""),
          isActive: item?.isActive !== false,
          usageCount: 0,
          source: "manual",
          contentFormat: "html",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        if (item?.marks != null) payload.marks = safeNum(item.marks, 0);
        if (item?.negativeMarks != null) payload.negativeMarks = safeNum(item.negativeMarks, 0);

        await addDoc(collection(db, "test_series", selectedTestId, "questions"), payload);

        added += 1;
      }

      if (added > 0) {
        await updateDoc(doc(db, "test_series", selectedTestId), {
          questionsCount: increment(added),
          updatedAt: serverTimestamp(),
        });
      }

      toast({ title: "Import done", description: `Imported ${added} questions.` });
      setBulkOpen(false);
      setBulkText("");
    } catch (e) {
      console.error(e);
      toast({ title: "Import failed", description: "Could not import questions.", variant: "destructive" });
    } finally {
      setBulkSaving(false);
    }
  }

  if (authLoading || testsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!uid) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Questions</h1>
        </div>
        <Card className="border-border/50">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Please login to manage questions.
            <div className="mt-4">
              <Button onClick={() => (window.location.href = "/login?role=admin")}>
                Go to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const testSelectValue = selectedTestId || "";

  const renderInlineEditor = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg">{editingId ? "Edit Question" : "New Question"}</h3>
        <Button variant="ghost" size="icon" onClick={() => { setEditorOpen(false); resetEditor(); }}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 space-y-6">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Question Content</Label>
            <ImageTextarea
              value={formQuestion}
              onChange={setFormQuestion}
              folder="/admin-test-questions"
              placeholder="Write your question with text, HTML/expressions, and images..."
              minHeight="170px"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {formOptions.map((opt, idx) => (
              <div key={idx} className="space-y-2">
                <Label className="text-sm font-semibold">{`Option ${String.fromCharCode(65 + idx)}`}</Label>
                <ImageTextarea
                  value={opt}
                  onChange={(v) => {
                    setFormOptions((prev) => prev.map((x, i) => (i === idx ? v : x)));
                  }}
                  folder="/admin-test-options"
                  placeholder={`Enter option ${idx + 1} with text/image/html`}
                  minHeight="95px"
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Explanation (optional)</Label>
            <ImageTextarea
              value={formExplanation}
              onChange={setFormExplanation}
              folder="/admin-test-explanations"
              placeholder="Explain the answer with text, images, or formatted content"
              minHeight="125px"
            />
          </div>
        </div>

        <div className="xl:col-span-2 space-y-5">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Correct Option</Label>
              <Select value={String(formCorrect)} onValueChange={(v) => setFormCorrect(Number(v))}>
                <SelectTrigger className="rounded-xl h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3].map((i) => (
                    <SelectItem key={i} value={String(i)}>
                      Option {String.fromCharCode(65 + i)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Difficulty</Label>
              <Select value={formDifficulty} onValueChange={(v: any) => setFormDifficulty(v)}>
                <SelectTrigger className="rounded-xl h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTY_OPTIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Published</p>
                <p className="text-xs text-muted-foreground">Draft is hidden from active use</p>
              </div>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Subject</Label>
              <Input
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder={selectedTest?.subject || "e.g. Physics"}
                className="rounded-xl h-11"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Topic</Label>
              <Input
                value={formTopic}
                onChange={(e) => setFormTopic(e.target.value)}
                placeholder="e.g. Kinematics"
                className="rounded-xl h-11"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Marks</Label>
                <Input
                  value={formMarks}
                  onChange={(e) => setFormMarks(e.target.value)}
                  placeholder={selectedTest?.positiveMarks != null ? String(selectedTest.positiveMarks) : "5"}
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Neg. Marks</Label>
                <Input
                  value={formNegMarks}
                  onChange={(e) => setFormNegMarks(e.target.value)}
                  placeholder={selectedTest?.negativeMarks != null ? String(selectedTest.negativeMarks) : "1"}
                  className="rounded-xl h-11"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <Button
          variant="outline"
          className="rounded-xl px-6"
          onClick={() => {
            setEditorOpen(false);
            resetEditor();
          }}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button 
          className="rounded-xl gradient-bg text-white px-8 min-w-[140px]" 
          onClick={saveQuestion} 
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>{editingId ? "Update Question" : "Save Question"}</>
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/tests")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Questions</h1>
            <p className="text-muted-foreground text-sm">
              Manage question bank for a test series (Firestore: <span className="font-mono">test_series/{`{testId}`}/questions</span>)
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="min-w-[260px]">
            <Select
              value={testSelectValue}
              onValueChange={(v) => {
                setSelectedTestId(v);
                // AppRoutes uses /admin/questions/:testId
                navigate(`/admin/questions/${v}`);
              }}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder={tests.length ? "Select a test" : "No tests found"} />
              </SelectTrigger>
              <SelectContent>
                {tests.length ? (
                  tests.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="__none" disabled>
                    Create a test first
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-xl" disabled={!selectedTestId}>
                <Upload className="h-4 w-4 mr-2" />
                Bulk Import
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl max-w-2xl">
              <DialogHeader>
                <DialogTitle>Bulk Import Questions (JSON)</DialogTitle>
                <DialogDescription>
                  Paste a JSON array. Each item:{" "}
                  <span className="font-mono">
                    {"{ question, options[], correctOption, explanation?, difficulty?, subject?, topic?, marks?, negativeMarks?, isActive? }"}
                  </span>
                </DialogDescription>
              </DialogHeader>

              <Textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder='[{"question":"...","options":["A","B","C","D"],"correctOption":1,"difficulty":"easy"}]'
                className="min-h-[220px] rounded-xl"
              />

              <div className="flex gap-2 justify-end">
                <Button variant="outline" className="rounded-xl" onClick={() => setBulkOpen(false)} disabled={bulkSaving}>
                  Cancel
                </Button>
                <Button className="rounded-xl gradient-bg text-white" onClick={bulkImport} disabled={bulkSaving}>
                  {bulkSaving ? "Importing..." : "Import"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={qbOpen} onOpenChange={setQbOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-xl" disabled={!selectedTestId}>
                <BookOpen className="h-4 w-4 mr-2" />
                Import from Question Bank
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl max-w-5xl">
              <DialogHeader>
                <DialogTitle>Import Questions from Global Question Bank</DialogTitle>
                <DialogDescription>
                  Select questions from <span className="font-mono">question_bank</span> and add them to this test.
                </DialogDescription>
              </DialogHeader>

              {/* Filters */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-4">
                  <Label className="text-xs">Search</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={qbSearch}
                      onChange={(e) => setQbSearch(e.target.value)}
                      placeholder="Search question / option / topic..."
                      className="pl-9 rounded-xl"
                    />
                  </div>
                </div>

                <div className="lg:col-span-3">
                  <Label className="text-xs">Subject</Label>
                  <Select value={qbSubject} onValueChange={setQbSubject}>
                    <SelectTrigger className="rounded-xl mt-1">
                      <SelectValue placeholder="All subjects" />
                    </SelectTrigger>
                    <SelectContent>
                      {qbSubjects.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s === "all" ? "All subjects" : s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="lg:col-span-3">
                  <Label className="text-xs">Topic</Label>
                  <Select value={qbTopic} onValueChange={setQbTopic}>
                    <SelectTrigger className="rounded-xl mt-1">
                      <SelectValue placeholder="All topics" />
                    </SelectTrigger>
                    <SelectContent>
                      {qbTopics.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t === "all" ? "All topics" : t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="lg:col-span-2">
                  <Label className="text-xs">Difficulty</Label>
                  <Select value={qbDifficulty} onValueChange={(v: any) => setQbDifficulty(v)}>
                    <SelectTrigger className="rounded-xl mt-1">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-border overflow-hidden">
                <div className="p-3 flex items-center justify-between bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    Showing <span className="font-medium text-foreground">{qbFiltered.length}</span> / {qbRows.length}
                  </p>
                  <p className="text-sm">
                    Selected: <span className="font-semibold">{qbSelectedIds.length}</span>
                  </p>
                </div>

                <div className="max-h-[460px] overflow-auto">
                  {qbLoading ? (
                    <div className="p-8 flex items-center justify-center text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading question bank…
                    </div>
                  ) : qbFiltered.length === 0 ? (
                    <div className="p-10 text-center text-muted-foreground">No questions match your filters.</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {qbFiltered.map((q) => {
                        const already = existingBankIds.has(q.id);
                        const checked = !!qbSelected[q.id];
                        return (
                          <div key={q.id} className="p-3 flex gap-3 items-start">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={checked}
                              disabled={already}
                              onChange={(e) =>
                                setQbSelected((prev) => ({ ...prev, [q.id]: e.target.checked }))
                              }
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <Badge variant="secondary" className={cn("rounded-full", difficultyBadge(normalizeDifficulty(q.difficulty)))}>
                                  {normalizeDifficulty(q.difficulty)}
                                </Badge>
                                {q.subject ? <Badge variant="secondary" className="rounded-full">{q.subject}</Badge> : null}
                                {q.topic ? <Badge variant="secondary" className="rounded-full">{q.topic}</Badge> : null}
                                {already ? (
                                  <Badge variant="secondary" className="rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    <CheckCircle2 className="h-3 w-3 mr-1" /> Already in test
                                  </Badge>
                                ) : null}
                              </div>

                              <div className="prose prose-sm dark:prose-invert max-w-none line-clamp-3" dangerouslySetInnerHTML={{ __html: q.question }} />
                              <p className="mt-1 text-xs text-muted-foreground">
                                Options: {q.options?.length || 0}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" className="rounded-xl" onClick={() => setQbOpen(false)} disabled={qbLoading}>
                  Cancel
                </Button>
                <Button
                  className="rounded-xl gradient-bg text-white"
                  onClick={importSelectedFromQuestionBank}
                  disabled={qbLoading || qbSelectedIds.length === 0}
                >
                  {qbLoading ? "Importing..." : "Add Selected"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" className="rounded-xl" onClick={copyExportJson} disabled={!selectedTestId || questions.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>

          <Button className="rounded-xl gradient-bg text-white" onClick={openCreate} disabled={!selectedTestId}>
            <Plus className="h-4 w-4 mr-2" />
            Add Question
          </Button>
        </div>
      </div>

      {/* Selected Test Summary */}
      {selectedTest && (
        <Card className="border-border/50">
          <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Selected Test</p>
              <p className="text-lg font-semibold truncate">{selectedTest.title}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedTest.subject ? <Badge variant="secondary" className="rounded-full">{selectedTest.subject}</Badge> : null}
                {selectedTest.level ? <Badge variant="secondary" className="rounded-full">{selectedTest.level}</Badge> : null}
                <Badge variant="secondary" className="rounded-full">{safeNum(selectedTest.durationMinutes, 60)} min</Badge>
              </div>
            </div>

            <div className="w-full md:w-[320px] space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Published questions</span>
                <span className="font-medium">{activeCount}/{total} ({activePct}%)</span>
              </div>
              <Progress value={activePct} />
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="p-2 rounded-xl bg-muted/40">
                  <p className="text-[11px] text-muted-foreground">Easy</p>
                  <p className="text-sm font-semibold">{easyCount}</p>
                </div>
                <div className="p-2 rounded-xl bg-muted/40">
                  <p className="text-[11px] text-muted-foreground">Medium</p>
                  <p className="text-sm font-semibold">{medCount}</p>
                </div>
                <div className="p-2 rounded-xl bg-muted/40">
                  <p className="text-[11px] text-muted-foreground">Hard</p>
                  <p className="text-sm font-semibold">{hardCount}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="border-border/50">
        <CardContent className="p-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search question / option / topic..."
              className="pl-9 rounded-xl"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Select value={difficultyFilter} onValueChange={(v: any) => setDifficultyFilter(v)}>
              <SelectTrigger className="w-[160px] rounded-xl">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Difficulty</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-[150px] rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Published</SelectItem>
                <SelectItem value="inactive">Draft</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setSearch("");
                setDifficultyFilter("all");
                setStatusFilter("all");
              }}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="questions">
        <TabsList className="rounded-xl">
          <TabsTrigger value="questions" className="rounded-lg">
            Question Bank
          </TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-lg">
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="pt-4">
          {questionsLoading ? (
            <Card className="border-border/50">
              <CardContent className="p-8 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading questions…
              </CardContent>
            </Card>
          ) : !selectedTestId ? (
            <Card className="border-border/50">
              <CardContent className="p-8 text-center text-muted-foreground">
                Select a test to manage its questions.
                <div className="mt-4">
                  <Button asChild className="rounded-xl">
                    <Link to="/admin/tests">Go to Tests</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : filtered.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="p-10 text-center text-muted-foreground">
                No questions found.
                <div className="mt-4">
                  <Button className="rounded-xl gradient-bg text-white" onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add your first question
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {editorOpen && !editingId && (
                <Card className="border-primary/40 shadow-md ring-1 ring-primary/20">
                  <CardContent className="p-6">
                    {renderInlineEditor()}
                  </CardContent>
                </Card>
              )}

              {filtered.map((q, idx) => {
                const isHtml = q.contentFormat === "html" || q.source === "question_bank" || /<\w+[\s\S]*>/i.test(q.question || "");
                const correctText = q.options?.[q.correctOption] || "";
                const correctTextPlain = stripHtml(correctText);
                const isEditing = editingId === q.id && editorOpen;

                return (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(0.2, idx * 0.02) }}
                  >
                    <Card className={cn(
                      "border-border/50 hover:shadow-sm transition-all duration-300",
                      isEditing && "border-primary/40 shadow-md ring-1 ring-primary/20"
                    )}>
                      <CardContent className="p-4">
                        {isEditing ? (
                          renderInlineEditor()
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <Badge variant="secondary" className={cn("rounded-full", difficultyBadge(q.difficulty))}>
                                  {q.difficulty}
                                </Badge>
                                {q.subject ? (
                                  <Badge variant="secondary" className="rounded-full">
                                    {q.subject}
                                  </Badge>
                                ) : null}
                                {q.topic ? (
                                  <Badge variant="secondary" className="rounded-full">
                                    {q.topic}
                                  </Badge>
                                ) : null}

                                {q.isActive !== false ? (
                                  <Badge variant="secondary" className="rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    published
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="rounded-full bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300">
                                    <XCircle className="h-3 w-3 mr-1" />
                                    draft
                                  </Badge>
                                )}
                              </div>

                              {isHtml ? (
                                <div
                                  className="prose prose-sm dark:prose-invert max-w-none leading-snug line-clamp-3"
                                  dangerouslySetInnerHTML={{ __html: q.question }}
                                />
                              ) : (
                                <p className="font-medium text-foreground leading-snug line-clamp-3">
                                  {q.question}
                                </p>
                              )}

                              {q.options?.length ? (
                                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {q.options.slice(0, 4).map((opt, i) => (
                                    <div
                                      key={i}
                                      className={cn(
                                        "text-sm p-2 rounded-xl border",
                                        i === q.correctOption
                                          ? "border-primary/40 bg-primary/5"
                                          : "border-border bg-muted/20"
                                      )}
                                    >
                                      <span className="text-xs text-muted-foreground mr-2">
                                        {String.fromCharCode(65 + i)}.
                                      </span>
                                      {isHtml ? (
                                        <span
                                          className={cn(i === q.correctOption && "font-medium")}
                                          dangerouslySetInnerHTML={{ __html: opt }}
                                        />
                                      ) : (
                                        <span className={cn(i === q.correctOption && "font-medium")}>
                                          {opt}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : null}

                              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                <span>Correct: <span className="font-medium text-foreground">{correctTextPlain || "—"}</span></span>
                                <span>Marks: <span className="font-medium text-foreground">{q.marks ?? selectedTest?.positiveMarks ?? "—"}</span></span>
                                <span>Neg: <span className="font-medium text-foreground">{q.negativeMarks ?? selectedTest?.negativeMarks ?? "—"}</span></span>
                                <span>Used: <span className="font-medium text-foreground">{q.usageCount ?? 0}</span></span>
                                <span>Updated: <span className="font-medium text-foreground">{fmtDate(q.updatedAtTs || q.createdAtTs || null)}</span></span>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={q.isActive !== false}
                                  onCheckedChange={(checked) => toggleActive(q, checked)}
                                />
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="rounded-xl"
                                  onClick={() => openEdit(q)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="rounded-xl"
                                  onClick={() => {
                                    navigator.clipboard.writeText(q.question);
                                    toast({ title: "Copied", description: "Question text copied." });
                                  }}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="rounded-xl text-destructive"
                                  onClick={() => deleteQuestion(q)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {!isEditing && q.explanation ? (
                          <div className="mt-4 p-3 rounded-xl bg-muted/30 border border-border">
                            <p className="text-xs text-muted-foreground mb-1">Explanation</p>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{q.explanation}</p>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total questions</span>
                  <span className="font-semibold">{total}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Published</span>
                  <span className="font-semibold">{activeCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Draft</span>
                  <span className="font-semibold">{Math.max(0, total - activeCount)}</span>
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>Published ratio</span>
                    <span className="font-medium">{activePct}%</span>
                  </div>
                  <Progress value={activePct} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Difficulty Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {([
                  { label: "Easy", value: easyCount, key: "easy" as Difficulty },
                  { label: "Medium", value: medCount, key: "medium" as Difficulty },
                  { label: "Hard", value: hardCount, key: "hard" as Difficulty },
                ] as const).map((row) => {
                  const pct = total ? Math.round((row.value / total) * 100) : 0;
                  return (
                    <div key={row.key}>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className={cn("rounded-full", difficultyBadge(row.key))}>
                            {row.label}
                          </Badge>
                          <span className="text-muted-foreground">{row.value} questions</span>
                        </div>
                        <span className="font-medium">{pct}%</span>
                      </div>
                      <Progress value={pct} />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

