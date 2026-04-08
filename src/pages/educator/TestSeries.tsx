import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  FileText,
  Download,
  Clock,
  BookOpen,
  Loader2,
  X,
  Copy,
  Image as ImageIcon,
  CheckCircle2,
  FileUp,
  XCircle,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

import EmptyState from "@/components/educator/EmptyState";
import AiQuestionImportOverlay from "@/components/educator/AiQuestionImportOverlay";
import {
  buildImportedQuestionPayload,
  formatNegativeMarksDisplay,
  importQuestionsFromPdf,
  type AiImportPreviewItem,
  type AiImportSummary,
} from "@/lib/aiQuestionImport";
import { uploadToImageKit } from "@/lib/imagekitUpload";

// Firebase
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type Difficulty = "easy" | "medium" | "hard";

type TestQuestion = {
  id: string;

  // Stored schema (admin-compatible)
  question: string; // can be plain text OR HTML
  options: string[]; // can be plain text OR HTML strings
  correctOption: number; // index
  explanation?: string; // plain/HTML

  difficulty: Difficulty;
  subject?: string;
  topic?: string;

  marks?: number; // positive marks
  negativeMarks?: number;

  isActive?: boolean;

  // AI import metadata
  source?: "ai_import" | "ai_import_partial" | string;
  importStatus?: "ready" | "partial";
  reviewRequired?: boolean;
  importIssues?: string[];
  importSourceIndex?: number;
  rawImportBlock?: string;
  questionImageUrl?: string;

  createdAt?: any;
  updatedAt?: any;
};

function stripHtml(input: string) {
  if (!input) return "";
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeQuestionDoc(id: string, data: any): TestQuestion {
  const question = String(data?.question ?? data?.text ?? "");
  const optionsRaw = Array.isArray(data?.options) ? data.options : [];
  const options = optionsRaw.map((x: any) => String(x ?? ""));

  const correctOption = Number(
    data?.correctOption ?? data?.correctOptionIndex ?? data?.correctOptionIndex ?? 0
  );

  const marks = data?.marks ?? data?.positiveMarks;
  const negativeMarks = data?.negativeMarks ?? data?.negative ?? data?.negMarks;

  const difficulty = (data?.difficulty as Difficulty) || "medium";

  return {
    id,
    question,
    options,
    correctOption: Number.isFinite(correctOption) ? correctOption : 0,
    explanation: data?.explanation ? String(data.explanation) : "",
    difficulty,
    subject: data?.subject ? String(data.subject) : "",
    topic: data?.topic ? String(data.topic) : "",
    marks: marks != null && marks !== "" ? Number(marks) : undefined,
    negativeMarks: negativeMarks != null && negativeMarks !== "" ? Number(negativeMarks) : undefined,
    isActive: data?.isActive !== false,
    createdAt: data?.createdAt,
    updatedAt: data?.updatedAt,
  };
}

function pruneUndefined<T extends Record<string, any>>(obj: T): T {
  Object.keys(obj).forEach((k) => {
    const v = (obj as any)[k];
    if (v === undefined) {
      delete (obj as any)[k];
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      pruneUndefined(v);
    }
  });
  return obj;
}


async function pickImageFile(): Promise<File | null> {
  return await new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const f = input.files?.[0] || null;
      resolve(f);
    };
    input.click();
  });
}

async function appendImageToField(current: string, folder = "/test-questions") {
  const f = await pickImageFile();
  if (!f) return { next: current, url: null };

  const { url } = await uploadToImageKit(f, f.name, folder);
  const imgTag = `\n<img src="${url}" alt="" />\n`;
  return { next: (current || "") + imgTag, url };
}

export default function TestSeries() {
  const [activeTab, setActiveTab] = useState<"library" | "bank">("library");
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Data
  const [myTests, setMyTests] = useState<any[]>([]);
  const [bankTests, setBankTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // UI
  const [search, setSearch] = useState("");
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<any>(null);
  const [importingId, setImportingId] = useState<string | null>(null);

  // Create custom test dialog fields
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Auth + Data
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      setCurrentUser(user);

      // MY tests: educators/{uid}/my_tests
      const myTestsQ = query(collection(db, "educators", user.uid, "my_tests"));
      const unsubMy = onSnapshot(
        myTestsQ,
        (snap) => {
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setMyTests(rows);
        },
        () => {
          toast.error("Failed to load your tests.");
        }
      );

      // BANK tests: root test_series where source == "admin"
      // NOTE: admin tests created via admin TestForm.tsx use { source: "admin" }
      const bankQ = query(collection(db, "test_series"), where("source", "==", "admin"));
      const unsubBank = onSnapshot(
        bankQ,
        (snap) => {
          const rows = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            // Hide drafts if admin uses isPublished === false
            .filter((t: any) => t?.isPublished !== false);

          setBankTests(rows);
          setLoading(false);
        },
        () => {
          setLoading(false);
          toast.error("Failed to load bank tests.");
        }
      );

      return () => {
        unsubMy();
        unsubBank();
      };
    });

    return () => unsubAuth();
  }, []);

  const filteredMyTests = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return myTests;
    return myTests.filter((t) => {
      const hay = `${t.title || ""} ${t.description || ""} ${t.subject || ""} ${t.level || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [myTests, search]);

  const filteredBankTests = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bankTests;
    return bankTests.filter((t) => {
      const hay = `${t.title || ""} ${t.description || ""} ${t.subject || ""} ${t.level || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [bankTests, search]);

  // Import admin test (metadata + questions) into educator library copy
  const handleImport = async (bankTest: any) => {
    if (!currentUser) return;
    setImportingId(bankTest.id);

    try {
      // Copy metadata to educators/{uid}/my_tests
      const meta: any = pruneUndefined({
        // whitelisted fields (keeps compatibility + avoids copying weird transient fields)
        title: bankTest.title ?? "",
        description: bankTest.description ?? "",
        subject: bankTest.subject ?? "",
        level: bankTest.level ?? "",
        durationMinutes: Number(bankTest.durationMinutes ?? bankTest.duration ?? 0),

        sections: bankTest.sections ?? [],
        instructions: bankTest.instructions ?? "",

        // attempts & marking
        attemptsAllowed: bankTest.attemptsAllowed != null
          ? Math.max(1, Number(bankTest.attemptsAllowed))
          : 3,
        markingScheme: bankTest.markingScheme ?? undefined,

        // marks config (omit if missing - Firestore rejects undefined)
        positiveMarks:
          bankTest.positiveMarks != null ? Number(bankTest.positiveMarks) : undefined,
        negativeMarks:
          bankTest.negativeMarks != null ? Number(bankTest.negativeMarks) : undefined,

        // provenance
        source: "imported",
        originSource: "admin",
        originalTestId: bankTest.id,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: currentUser.uid,
        questionsCount: 0,
      });

      const newTestRef = await addDoc(collection(db, "educators", currentUser.uid, "my_tests"), meta);

      // Copy questions from test_series/{id}/questions → educators/{uid}/my_tests/{new}/questions
      const questionsSnap = await getDocs(collection(db, "test_series", bankTest.id, "questions"));
      const batch = writeBatch(db);
      let activeCount = 0;

      questionsSnap.forEach((qDoc) => {
        const data = qDoc.data();
        if (data?.isActive !== false) activeCount += 1;
        const newQRef = doc(collection(db, "educators", currentUser.uid, "my_tests", newTestRef.id, "questions"));
        batch.set(newQRef, {
          ...data,
          importedFromTestId: bankTest.id,
          importedAt: serverTimestamp(),
        });
      });

      await batch.commit();
      await updateDoc(newTestRef, { questionsCount: activeCount, updatedAt: serverTimestamp() });

      toast.success("Imported to your library");
      setActiveTab("library");
    } catch (e) {
      console.error(e);
      toast.error("Failed to import test");
    } finally {
      setImportingId(null);
    }
  };

  // Create educator custom test (NO question bank import allowed, manual questions only)
  const handleCreateCustom = async (e: any) => {
    e.preventDefault();
    if (!currentUser) return;

    const fd = new FormData(e.target);

    const payload: any = {
      title: String(fd.get("title") || ""),
      description: String(fd.get("description") || ""),
      subject: String(fd.get("subject") || ""),
      level: String(fd.get("level") || "General"),
      durationMinutes: Number(fd.get("duration") || 0),
      attemptsAllowed: 3,

      // educator ownership
      source: "custom",
      originSource: "educator",
      createdBy: currentUser.uid,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      questionsCount: 0,
    };

    setCreating(true);
    try {
      await addDoc(collection(db, "educators", currentUser.uid, "my_tests"), payload);

      toast.success("Custom test created");
      setCreateOpen(false);
      e.target.reset?.();
      setActiveTab("library");
    } catch (err) {
      console.error(err);
      toast.error("Failed to create test");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Test Series</h1>
          <p className="text-muted-foreground">
            Import admin tests to your library, or create custom tests (manual questions only).
          </p>
        </div>

        <div className="flex gap-2">
          <div className="relative w-full sm:w-[320px]">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tests..."
              className="pl-9 rounded-xl"
            />
          </div>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-bg text-white shadow-lg">
                <Plus className="mr-2 h-4 w-4" /> Create Custom Test
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-xl rounded-2xl">
              <DialogHeader>
                <DialogTitle>Create New Test</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleCreateCustom} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input name="title" required placeholder="e.g. Weekly Biology Mock" className="rounded-xl" />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    name="description"
                    placeholder="Short instructions / overview..."
                    className="rounded-xl min-h-[90px]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input name="subject" required className="rounded-xl" placeholder="e.g. Maths" />
                  </div>
                  <div className="space-y-2">
                    <Label>Level</Label>
                    <Input name="level" className="rounded-xl" placeholder="e.g. Medium" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Duration (minutes)</Label>
                  <Input name="duration" required type="number" min={1} defaultValue={60} className="rounded-xl" />
                </div>

                <Button type="submit" className="w-full rounded-xl" disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Test"}
                </Button>

                <p className="text-xs text-muted-foreground">
                  Note: Educators cannot import from the global question bank. Add questions manually inside the test.
                </p>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="rounded-xl">
          <TabsTrigger value="library" className="rounded-xl">
            Your Library
          </TabsTrigger>
          <TabsTrigger value="bank" className="rounded-xl">
            Admin Bank
          </TabsTrigger>
        </TabsList>

        {/* Library */}
        <TabsContent value="library" className="mt-6">
          {filteredMyTests.length === 0 ? (
            <EmptyState icon={FileText} title="No tests found" description="Create a custom test or import from the admin bank." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMyTests.map((test) => (
                <motion.div key={test.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="h-full flex flex-col hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="flex justify-between items-start gap-2">
                        <span className="truncate text-lg">{test.title}</span>
                        {test.source === "imported" ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Imported
                          </Badge>
                        ) : (
                          <Badge className="text-[10px]">Custom</Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-4">
                      <p className="text-sm text-muted-foreground line-clamp-2">{test.description}</p>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-auto">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" /> {test.subject || "—"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {Number(test.durationMinutes || 0)}m
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTest(test);
                            setIsManageOpen(true);
                          }}
                        >
                          <Edit className="mr-2 h-3 w-3" /> Manage Questions
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={async () => {
                            if (!currentUser) return;
                            if (!confirm("Delete this test and all its questions?")) return;
                            try {
                              // delete subcollection questions first (best-effort)
                              const qs = await getDocs(collection(db, "educators", currentUser.uid, "my_tests", test.id, "questions"));
                              const batch = writeBatch(db);
                              qs.forEach((d) => batch.delete(d.ref));
                              batch.delete(doc(db, "educators", currentUser.uid, "my_tests", test.id));
                              await batch.commit();
                              toast.success("Test deleted");
                            } catch (e) {
                              console.error(e);
                              toast.error("Delete failed");
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Admin Bank */}
        <TabsContent value="bank" className="mt-6">
          {filteredBankTests.length === 0 ? (
            <EmptyState icon={FileText} title="No bank tests found" description="No admin tests are available for import yet." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBankTests.map((test) => (
                <Card key={test.id} className="bg-muted/30 border-dashed">
                  <CardHeader>
                    <CardTitle className="flex justify-between items-start">
                      <span className="truncate">{test.title}</span>
                      <Badge variant="outline">Admin</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground line-clamp-2">{test.description}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>{test.subject || "—"}</span> • <span>{test.level || "—"}</span>
                    </div>
                    <Button className="w-full" disabled={importingId === test.id} onClick={() => handleImport(test)}>
                      {importingId === test.id ? (
                        <Loader2 className="animate-spin h-4 w-4" />
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" /> Import to Library
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Questions Manager Modal */}
      {isManageOpen && selectedTest && currentUser && (
        <QuestionsManager
          testId={selectedTest.id}
          testTitle={selectedTest.title}
          testSubject={selectedTest.subject}
          educatorUid={currentUser.uid}
          onClose={() => setIsManageOpen(false)}
        />
      )}
    </div>
  );
}

// ------------------------------
// Sub-component: Educator Questions Manager (manual only)
// Works for both imported admin tests and educator custom tests.
// IMPORTANT: No question-bank import here.
// ------------------------------
function QuestionsManager({
  testId,
  testTitle,
  testSubject,
  educatorUid,
  onClose,
}: {
  testId: string;
  testTitle?: string;
  testSubject?: string;
  educatorUid: string;
  onClose: () => void;
}) {
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQ, setSearchQ] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formQuestion, setFormQuestion] = useState("");
  const [formOptions, setFormOptions] = useState<string[]>(["", "", "", ""]);
  const [formCorrect, setFormCorrect] = useState(0);
  const [formExplanation, setFormExplanation] = useState("");
  const [formDifficulty, setFormDifficulty] = useState<Difficulty>("medium");
  const [formSubject, setFormSubject] = useState("");
  const [formTopic, setFormTopic] = useState("");
  const [formMarks, setFormMarks] = useState("");
  const [formNegMarks, setFormNegMarks] = useState("");
  const [formActive, setFormActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [imgBusy, setImgBusy] = useState<null | "q" | "e" | 0 | 1 | 2 | 3>(null);

  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [savingImported, setSavingImported] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importSummary, setImportSummary] = useState<AiImportSummary | null>(null);
  const [importItems, setImportItems] = useState<AiImportPreviewItem[]>([]);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const importAbortControllerRef = useRef<AbortController | null>(null);

  const qCol = useMemo(
    () => collection(db, "educators", educatorUid, "my_tests", testId, "questions"),
    [educatorUid, testId]
  );

  async function syncTestQuestionCount() {
    try {
      const snap = await getDocs(qCol);
      let activeCount = 0;
      snap.forEach((item) => {
        if (item.data()?.isActive !== false) activeCount += 1;
      });
      await updateDoc(doc(db, "educators", educatorUid, "my_tests", testId), {
        questionsCount: activeCount,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to sync question count", error);
    }
  }

  useEffect(() => {
    const unsub = onSnapshot(
      qCol,
      (snap) => {
        const rows = snap.docs.map((d) => normalizeQuestionDoc(d.id, d.data()));
        setQuestions(rows);
        setLoading(false);
      },
      () => {
        setLoading(false);
        toast.error("Failed to load questions");
      }
    );
    return () => unsub();
  }, [qCol]);

  const filteredQuestions = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return questions;
    return questions.filter((row) => {
      const hay = `${stripHtml(row.question)} ${stripHtml(row.explanation || "")} ${row.subject || ""} ${row.topic || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [questions, searchQ]);

  function resetEditor() {
    setEditingId(null);
    setFormQuestion("");
    setFormOptions(["", "", "", ""]);
    setFormCorrect(0);
    setFormExplanation("");
    setFormDifficulty("medium");
    setFormSubject("");
    setFormTopic("");
    setFormMarks("");
    setFormNegMarks("");
    setFormActive(true);
  }

  function openNew() {
    resetEditor();
    setEditorOpen(true);
  }

  function openEdit(q: TestQuestion) {
    setEditingId(q.id);
    setFormQuestion(q.question || "");
    setFormOptions([
      q.options?.[0] || "",
      q.options?.[1] || "",
      q.options?.[2] || "",
      q.options?.[3] || "",
    ]);
    setFormCorrect(Number.isFinite(q.correctOption) ? q.correctOption : 0);
    setFormExplanation(q.explanation || "");
    setFormDifficulty(q.difficulty || "medium");
    setFormSubject(q.subject || "");
    setFormTopic(q.topic || "");
    setFormMarks(q.marks != null ? String(q.marks) : "");
    setFormNegMarks(q.negativeMarks != null ? String(q.negativeMarks) : "");
    setFormActive(q.isActive !== false);
    setEditorOpen(true);
  }

  async function saveQuestion() {
    if (saving) return;

    const trimmedQuestion = formQuestion.trim();
    const normalizedOptions = formOptions.map((value) => value ?? "");
    const nonEmptyOptions = normalizedOptions.filter((value) => value.trim() !== "");

    if (!trimmedQuestion) {
      toast.error("Question is required");
      return;
    }
    if (nonEmptyOptions.length < 2) {
      toast.error("At least two options are required");
      return;
    }
    if (!normalizedOptions[formCorrect] || normalizedOptions[formCorrect].trim() === "") {
      toast.error("Correct option cannot be empty");
      return;
    }

    const payload: any = {
      question: formQuestion,
      options: normalizedOptions,
      correctOption: Number(formCorrect) || 0,
      explanation: formExplanation || "",
      difficulty: formDifficulty || "medium",
      subject: formSubject || "",
      topic: formTopic || "",
      isActive: !!formActive,
      updatedAt: serverTimestamp(),
    };

    if (formMarks.trim() !== "") payload.marks = Number(formMarks);
    else payload.marks = null;

    if (formNegMarks.trim() !== "") payload.negativeMarks = Number(formNegMarks);
    else payload.negativeMarks = null;

    setSaving(true);
    try {
      if (!editingId) {
        await addDoc(qCol, {
          ...payload,
          createdAt: serverTimestamp(),
          source: "manual",
        });
        toast.success("Question added");
      } else {
        await updateDoc(doc(qCol, editingId), payload);
        toast.success("Question updated");
      }
      await syncTestQuestionCount();
      setEditorOpen(false);
      resetEditor();
    } catch (e) {
      console.error(e);
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuestion(id: string) {
    if (!confirm("Delete this question?")) return;
    try {
      await deleteDoc(doc(qCol, id));
      await syncTestQuestionCount();
      toast.success("Deleted");
      if (editingId === id) {
        setEditorOpen(false);
        resetEditor();
      }
    } catch (e) {
      console.error(e);
      toast.error("Delete failed");
    }
  }

  async function duplicateQuestion(q: TestQuestion) {
    try {
      await addDoc(qCol, {
        question: q.question,
        options: q.options || ["", "", "", ""],
        correctOption: q.correctOption ?? 0,
        explanation: q.explanation || "",
        difficulty: q.difficulty || "medium",
        subject: q.subject || "",
        topic: q.topic || "",
        marks: q.marks ?? null,
        negativeMarks: q.negativeMarks ?? null,
        isActive: q.isActive !== false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        source: "manual",
        duplicatedAt: serverTimestamp(),
      });
      await syncTestQuestionCount();
      toast.success("Duplicated");
    } catch (e) {
      console.error(e);
      toast.error("Duplicate failed");
    }
  }

  async function toggleActive(q: TestQuestion, next: boolean) {
    try {
      await updateDoc(doc(qCol, q.id), { isActive: next, updatedAt: serverTimestamp() });
      await syncTestQuestionCount();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update");
    }
  }



  // Upload pdf starts here....
  async function handlePdfSelected(file: File | null) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file only");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Please upload a PDF up to 15 MB for AI import");
      return;
    }

    // Create a new abort controller for this import
    importAbortControllerRef.current = new AbortController();

    setImportBusy(true);
    setImportFileName(file.name);
    setImportPreviewOpen(true);
    setImportItems([]);
    setImportSummary(null);

    try {
      const result = await importQuestionsFromPdf(
        file,
        { testTitle, subject: testSubject, educatorId: educatorUid },
        (completed, total) => {
          toast.info(`Processing page ${completed} of ${total}...`, { id: "pdf-progress" });
        },
        importAbortControllerRef.current.signal
      );
      const previewItems: AiImportPreviewItem[] = (result.items || []).map((item) => ({
        ...item,
        include: item.status === "ready",
      }));
      setImportItems(previewItems);
      setImportSummary(result.summary || null);
      toast.success("AI import preview is ready");
    } catch (error) {
      console.error(error);
      const errorMsg = error instanceof Error ? error.message : "Failed to import PDF with AI";
      // Don't show error toast if it was cancelled
      if (!errorMsg.includes("cancelled")) {
        toast.error(errorMsg);
      } else {
        toast.info("PDF import cancelled");
      }
      setImportPreviewOpen(false);
    } finally {
      setImportBusy(false);
      importAbortControllerRef.current = null;
    }
  }

  function cancelPdfImport() {
    if (importAbortControllerRef.current) {
      importAbortControllerRef.current.abort();
      setImportBusy(false);
      setImportPreviewOpen(false);
      toast.info("PDF import cancelled");
    }
  }

  function updateImportItemInclude(sourceIndex: number, include: boolean) {
    setImportItems((prev) => prev.map((item) => (item.sourceIndex === sourceIndex ? { ...item, include } : item)));
  }

  function selectReadyOnly() {
    setImportItems((prev) =>
      prev.map((item) => ({
        ...item,
        include: item.status === "ready",
      }))
    );
  }

  function toggleAllPartials(include: boolean) {
    setImportItems((prev) =>
      prev.map((item) =>
        item.status === "partial"
          ? { ...item, include }
          : item.status === "ready"
            ? { ...item, include: true }
            : { ...item, include: false }
      )
    );
  }

  async function saveImportedQuestions() {
    const selected = importItems.filter((item) => item.include && item.status !== "rejected");
    if (!selected.length) {
      toast.error("No questions selected to save");
      return;
    }

    setSavingImported(true);
    try {
      for (let i = 0; i < selected.length; i += 200) {
        const batch = writeBatch(db);
        for (const item of selected.slice(i, i + 200)) {
          const payload = buildImportedQuestionPayload(item);
          const newRef = doc(qCol);
          batch.set(newRef, {
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }

      await syncTestQuestionCount();
      toast.success(`${selected.length} imported question${selected.length === 1 ? "" : "s"} saved`);
      setImportPreviewOpen(false);
      setImportItems([]);
      setImportSummary(null);
      if (!editorOpen) openNew();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save imported questions");
    } finally {
      setSavingImported(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="relative bg-background w-full max-w-6xl h-[92vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        <div className="p-4 border-b flex items-center justify-between bg-muted/30">
          <div className="min-w-0">
            <h2 className="font-bold text-lg">Manage Questions</h2>
            <p className="text-xs text-muted-foreground">
              Add questions manually or import them from a PDF with AI. Saved questions stay in the same Firestore path.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <div className="w-full md:w-[380px] h-1/3 md:h-auto border-b md:border-b-0 md:border-r flex flex-col bg-muted/10 shrink-0">
            <div className="p-4 border-b space-y-3">
              <Button className="w-full rounded-xl" onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" /> Add Question
              </Button>

              <Button
                variant="outline"
                className="w-full rounded-xl"
                onClick={() => pdfInputRef.current?.click()}
                disabled={importBusy}
              >
                {importBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                Import PDF with AI
              </Button>
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0] || null;
                  event.currentTarget.value = "";
                  await handlePdfSelected(file);
                }}
              />

              <div className="relative">
                <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Search questions..."
                  className="pl-9 rounded-xl"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="animate-spin text-muted-foreground" />
                </div>
              ) : filteredQuestions.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-10">No questions yet.</p>
              ) : (
                filteredQuestions.map((q, idx) => (
                  <div
                    key={q.id}
                    onClick={() => openEdit(q)}
                    className="p-3 rounded-xl border cursor-pointer text-sm hover:bg-accent transition-colors bg-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium line-clamp-2">
                          Q{idx + 1}: {stripHtml(q.question) || "(empty)"}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge variant="secondary" className="text-[10px] rounded-full">
                            {(q.difficulty || "medium").toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] rounded-full">
                            +{q.marks ?? "—"} / {formatNegativeMarksDisplay(q.negativeMarks)}
                          </Badge>
                          {q.source === "ai_import" ? (
                            <Badge variant="outline" className="text-[10px] rounded-full">AI</Badge>
                          ) : q.source === "ai_import_partial" ? (
                            <Badge variant="outline" className="text-[10px] rounded-full">AI Draft</Badge>
                          ) : null}
                          {q.isActive !== false ? (
                            <Badge className="text-[10px] rounded-full">Active</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px] rounded-full">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-xl"
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateQuestion(q);
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-xl text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteQuestion(q.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {q.subject || "—"} {q.topic ? `• ${q.topic}` : ""}
                      </div>
                      <Switch
                        checked={q.isActive !== false}
                        onCheckedChange={(checked) => toggleActive(q, checked)}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-8 max-w-3xl mx-auto">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold">
                    {editingId ? "Edit Question" : "Create Question"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Supports HTML + images. AI-imported draft questions can be fixed here before activating them.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      if (editorOpen) {
                        setEditorOpen(false);
                        resetEditor();
                      } else {
                        openNew();
                      }
                    }}
                  >
                    {editorOpen ? "Cancel" : "New"}
                  </Button>
                  <Button className="rounded-xl" disabled={saving} onClick={saveQuestion}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Question (text or HTML)</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={imgBusy !== null}
                      onClick={async () => {
                        setImgBusy("q");
                        try {
                          const { next } = await appendImageToField(formQuestion, "/test-questions");
                          setFormQuestion(next);
                          toast.success("Image added");
                        } catch (e) {
                          console.error(e);
                          toast.error("Image upload failed");
                        } finally {
                          setImgBusy(null);
                        }
                      }}
                    >
                      {imgBusy === "q" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ImageIcon className="h-4 w-4 mr-2" /> Add Image</>}
                    </Button>
                  </div>
                  <Textarea
                    value={formQuestion}
                    onChange={(e) => setFormQuestion(e.target.value)}
                    className="rounded-xl min-h-[140px]"
                    placeholder="You can type plain text, or HTML like <b>bold</b> and <img src='...' />"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[0, 1, 2, 3].map((idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>
                          Option {String.fromCharCode(65 + idx)}
                          {formCorrect === idx ? <span className="ml-2 text-green-600 inline-flex items-center gap-1 text-xs"><CheckCircle2 className="h-3 w-3" /> Correct</span> : null}
                        </Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          disabled={imgBusy !== null}
                          onClick={async () => {
                            setImgBusy(idx as any);
                            try {
                              const { next } = await appendImageToField(formOptions[idx] || "", "/test-options");
                              setFormOptions((prev) => prev.map((v, i) => (i === idx ? next : v)));
                              toast.success("Image added");
                            } catch (e) {
                              console.error(e);
                              toast.error("Image upload failed");
                            } finally {
                              setImgBusy(null);
                            }
                          }}
                        >
                          {imgBusy === idx ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <ImageIcon className="h-4 w-4 mr-2" /> Img
                            </>
                          )}
                        </Button>
                      </div>

                      <Textarea
                        value={formOptions[idx] || ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFormOptions((prev) => prev.map((x, i) => (i === idx ? v : x)));
                        }}
                        className="rounded-xl min-h-[90px]"
                        placeholder="Option text or HTML"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Correct Option</Label>
                    <Select value={String(formCorrect)} onValueChange={(v) => setFormCorrect(Number(v))}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 1, 2, 3].map((i) => (
                          <SelectItem key={i} value={String(i)}>
                            {String.fromCharCode(65 + i)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Difficulty</Label>
                    <Select value={formDifficulty} onValueChange={(v: any) => setFormDifficulty(v)}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border mt-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Active</p>
                      <p className="text-xs text-muted-foreground">Visible for students</p>
                    </div>
                    <Switch checked={formActive} onCheckedChange={setFormActive} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input value={formSubject} onChange={(e) => setFormSubject(e.target.value)} className="rounded-xl" placeholder="e.g. Physics" />
                  </div>
                  <div className="space-y-2">
                    <Label>Topic</Label>
                    <Input value={formTopic} onChange={(e) => setFormTopic(e.target.value)} className="rounded-xl" placeholder="e.g. Kinematics" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Marks</Label>
                    <Input value={formMarks} onChange={(e) => setFormMarks(e.target.value)} className="rounded-xl" placeholder="e.g. 5" />
                  </div>
                  <div className="space-y-2">
                    <Label>Negative Marks</Label>
                    <Input value={formNegMarks} onChange={(e) => setFormNegMarks(e.target.value)} className="rounded-xl" placeholder="e.g. -1" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Explanation (optional)</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={imgBusy !== null}
                      onClick={async () => {
                        setImgBusy("e");
                        try {
                          const { next } = await appendImageToField(formExplanation, "/test-explanations");
                          setFormExplanation(next);
                          toast.success("Image added");
                        } catch (e) {
                          console.error(e);
                          toast.error("Image upload failed");
                        } finally {
                          setImgBusy(null);
                        }
                      }}
                    >
                      {imgBusy === "e" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <ImageIcon className="h-4 w-4 mr-2" /> Add Image
                        </>
                      )}
                    </Button>
                  </div>
                  <Textarea
                    value={formExplanation}
                    onChange={(e) => setFormExplanation(e.target.value)}
                    className="rounded-xl min-h-[120px]"
                    placeholder="Optional explanation (text or HTML)"
                  />
                </div>

                <div className="text-xs text-muted-foreground flex items-start gap-2">
                  <div className="mt-0.5">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">AI import behavior</p>
                    <p>
                      Imported questions are saved in <span className="font-semibold">educators/{educatorUid}/my_tests/{testId}/questions</span>.
                      Partial AI questions stay inactive until you review and activate them.
                    </p>
                  </div>
                </div>

                <Button className="w-full rounded-xl" disabled={saving} onClick={saveQuestion}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? "Update Question" : "Add Question"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 border-t bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
          <span>Stored in: educators/{educatorUid}/my_tests/{testId}/questions</span>
          <span className="flex items-center gap-2">
            <FileUp className="h-4 w-4" />
            Manual + AI PDF Import
          </span>
        </div>

        <AiQuestionImportOverlay
          open={importPreviewOpen}
          fileName={importFileName}
          summary={importSummary}
          items={importItems}
          importing={importBusy}
          saving={savingImported}
          onClose={() => {
            if (!savingImported && !importBusy) setImportPreviewOpen(false);
          }}
          onCancel={cancelPdfImport}
          onItemIncludeChange={updateImportItemInclude}
          onSelectReadyOnly={selectReadyOnly}
          onToggleAllPartials={toggleAllPartials}
          onSaveSelected={saveImportedQuestions}
        />
      </div>
    </div>
  );
}
