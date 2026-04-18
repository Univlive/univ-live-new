// pages/admin/TestForm.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Save, Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import EmptyState from "@/components/admin/EmptyState";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthProvider";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

type Difficulty = "Easy" | "Medium" | "Hard";

type Section = {
  id: string;
  name: string;
  questionsCount: number; // display only (admin can set, questions page can override later)
  durationMinutes?: number;
};

type MarkingScheme = {
  correct: number;
  incorrect: number;
  unanswered: number;
};

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function safeNum(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDifficulty(v: any): Difficulty {
  const s = String(v || "").trim();
  if (s === "Easy" || s === "Medium" || s === "Hard") return s;
  return "Medium";
}

const SUBJECTS = [
  "Accountancy",
  "Business Studies",
  "Applied Mathematics",
  "General Test",
  "English",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "History",
  "Geography",
  "Political Science",
  "Economics",
];

export default function TestForm() {
  const navigate = useNavigate();
  const params = useParams<{ id?: string; testId?: string }>();
const testId = params.testId || params.id;

  const { firebaseUser, profile, loading: authLoading } = useAuth();
  const isAdmin = profile?.role === "ADMIN";

  const isEdit = !!testId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<string>("General Test");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [description, setDescription] = useState("");

  const [durationMinutes, setDurationMinutes] = useState<string>("60");
  const [attemptsAllowed, setAttemptsAllowed] = useState<string>("3");

  // IMPORTANT: your new rule is “no test without code/pay”
  // keep this true by default.
  const [requiresUnlock, setRequiresUnlock] = useState(true);

  const [price, setPrice] = useState<string>("0"); // payment upcoming
  const [isPublished, setIsPublished] = useState(false);

  const [markingScheme, setMarkingScheme] = useState<MarkingScheme>({
    correct: 5,
    incorrect: -1,
    unanswered: 0,
  });

  // syllabus editor (multiline)
  const [syllabusText, setSyllabusText] = useState("");

  // sections editor
  const [sections, setSections] = useState<Section[]>([
    { id: uid("sec"), name: "Section 1", questionsCount: 0, durationMinutes: undefined },
  ]);

  const computedQuestionsCount = useMemo(() => {
    return sections.reduce((acc, s) => acc + safeNum(s.questionsCount, 0), 0);
  }, [sections]);

  // Load (edit)
  useEffect(() => {
    if (authLoading) return;

    // guard
    if (!firebaseUser?.uid || !isAdmin) {
      setLoading(false);
      return;
    }

    if (!isEdit) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);

        const ref = doc(db, "test_series", testId!);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          toast.error("Test not found");
          navigate("/admin/tests");
          return;
        }

        const d = snap.data() as any;

        setTitle(String(d?.title || ""));
        setSubject(String(d?.subject || "General Test"));
        setDifficulty(normalizeDifficulty(d?.level || d?.difficulty));
        setDescription(String(d?.description || ""));

        setDurationMinutes(String(safeNum(d?.durationMinutes ?? d?.duration, 60)));
        setAttemptsAllowed(String(Math.max(1, safeNum(d?.attemptsAllowed ?? d?.maxAttempts, 3))));

        setRequiresUnlock(d?.requiresUnlock !== false); // default true
        setPrice(String(Math.max(0, safeNum(d?.price, 0))));
        setIsPublished(!!d?.isPublished);

        if (d?.markingScheme) {
          setMarkingScheme({
            correct: safeNum(d.markingScheme.correct, 5),
            incorrect: safeNum(d.markingScheme.incorrect, -1),
            unanswered: safeNum(d.markingScheme.unanswered, 0),
          });
        } else {
          setMarkingScheme({
            correct: safeNum(d?.positiveMarks, 5),
            incorrect: safeNum(d?.negativeMarks, -1),
            unanswered: 0,
          });
        }

        const syl = Array.isArray(d?.syllabus) ? d.syllabus.map(String) : [];
        setSyllabusText(syl.join("\n"));

        const rawSections = Array.isArray(d?.sections) ? d.sections : [];
        const parsed: Section[] =
          rawSections.length > 0
            ? rawSections.map((s: any, idx: number) => ({
                id: String(s?.id || `sec_${idx + 1}`),
                name: String(s?.name || `Section ${idx + 1}`),
                questionsCount: safeNum(s?.questionsCount, 0),
                durationMinutes:
                  s?.durationMinutes != null
                    ? safeNum(s.durationMinutes, undefined as any)
                    : s?.duration != null
                    ? safeNum(s.duration, undefined as any)
                    : undefined,
              }))
            : [{ id: uid("sec"), name: "Section 1", questionsCount: 0 }];

        setSections(parsed);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load test");
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, firebaseUser?.uid, isAdmin, isEdit, testId, navigate]);

  function addSection() {
    setSections((prev) => [
      ...prev,
      { id: uid("sec"), name: `Section ${prev.length + 1}`, questionsCount: 0 },
    ]);
  }

  function removeSection(sectionId: string) {
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
  }

  function updateSection(sectionId: string, patch: Partial<Section>) {
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)));
  }

  function parseSyllabus(text: string) {
    return text
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  async function save(goToQuestions: boolean) {
    if (!firebaseUser?.uid || !isAdmin) return;

    const t = title.trim();
    if (!t) return toast.error("Please enter a title");

    const dur = safeNum(durationMinutes, 60);
    if (dur <= 0) return toast.error("Duration must be a positive number");

    const attempts = Math.max(1, safeNum(attemptsAllowed, 3));
    const p = Math.max(0, safeNum(price, 0)); // payment upcoming

    const cleanedSections = sections
      .map((s, idx) => ({
        id: String(s.id || `sec_${idx + 1}`),
        name: String(s.name || `Section ${idx + 1}`).trim(),
        questionsCount: Math.max(0, safeNum(s.questionsCount, 0)),
        durationMinutes:
          s.durationMinutes != null && String(s.durationMinutes) !== ""
            ? Math.max(0, safeNum(s.durationMinutes, 0))
            : null,
      }))
      .filter((s) => s.name);

    if (cleanedSections.length === 0) {
      return toast.error("Please add at least one section");
    }

    const payload: Record<string, any> = {
      title: t,
      subject: subject || "General Test",
      level: difficulty, // student side reads level/difficulty
      description: description.trim() || "",
      durationMinutes: dur,
      attemptsAllowed: attempts,

      // 🔒 new business rule
      requiresUnlock,

      // payment (upcoming) – keep field ready
      price: p,

      markingScheme: {
        correct: safeNum(markingScheme.correct, 5),
        incorrect: safeNum(markingScheme.incorrect, -1),
        unanswered: safeNum(markingScheme.unanswered, 0),
      },

      syllabus: parseSyllabus(syllabusText),

      sections: cleanedSections.map((s: any) => ({
        id: s.id,
        name: s.name,
        questionsCount: s.questionsCount,
        // store as durationMinutes, keep backward compat too
        durationMinutes: s.durationMinutes,
      })),

      // this is only “declared” count (Questions page can update real count later)
      questionsCount: cleanedSections.reduce((acc: number, s: any) => acc + (s.questionsCount || 0), 0),

      isPublished,
      updatedAt: serverTimestamp(),
    };

    setSaving(true);
    try {
      if (!isEdit) {
        const ref = await addDoc(collection(db, "test_series"), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: firebaseUser.uid,
          source: "admin",
        });

        toast.success("Test created");

        if (goToQuestions) {
          // AppRoutes uses /admin/questions/:testId
          navigate(`/admin/questions/${ref.id}`);
        } else {
          // AppRoutes uses /admin/tests/edit/:id
          navigate(`/admin/tests/edit/${ref.id}`);
        }
      } else {
        await updateDoc(doc(db, "test_series", testId!), payload);
        toast.success("Test updated");

        if (goToQuestions) {
          // AppRoutes uses /admin/questions/:testId
          navigate(`/admin/questions/${testId}`);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Guards
  if (!authLoading && (!firebaseUser?.uid || !isAdmin)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Admin • Test Editor</h1>
          <p className="text-muted-foreground text-sm">You must be logged in as an admin.</p>
        </div>
        <EmptyState
          title="Admin access required"
          description="Please login with an ADMIN account to manage tests."
          actionLabel="Go to Login"
          onAction={() => (window.location.href = "/login?role=admin")}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading test…
        </div>
        <div className="rounded-xl border border-border p-6 text-muted-foreground">Please wait…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <Button variant="ghost" asChild className="px-0">
            <Link to="/admin/tests">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Test Bank
            </Link>
          </Button>
          <h1 className="text-2xl font-display font-bold">
            {isEdit ? "Edit Test" : "Create Test"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Saved in <Badge variant="secondary" className="rounded-full">test_series</Badge>
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => save(true)}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save & Questions
          </Button>

          <Button className="gradient-bg rounded-xl" onClick={() => save(false)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </div>
      </div>

      {/* Basic Info */}
      <Card className="card-soft border-0">
        <CardHeader>
          <CardTitle className="text-base">Basic Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl" />
            </div>

            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Easy">Easy</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Duration (minutes)</Label>
              <Input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="rounded-xl"
                min={1}
              />
            </div>

            <div className="space-y-2">
              <Label>Attempts Allowed</Label>
              <Select value={attemptsAllowed} onValueChange={setAttemptsAllowed}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Price (Payment upcoming)</Label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="rounded-xl"
                min={0}
              />
              <p className="text-xs text-muted-foreground">
                Students will see “Pay Online (Upcoming)”. Access codes will work now.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-2xl min-h-[110px]"
              placeholder="Write a short description for students..."
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border flex-1">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Requires Unlock</p>
                <p className="text-xs text-muted-foreground">
                  🔒 If ON: student must redeem access code (or pay later).
                </p>
              </div>
              <Switch checked={requiresUnlock} onCheckedChange={setRequiresUnlock} />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border flex-1">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Published</p>
                <p className="text-xs text-muted-foreground">
                  If OFF: hidden from students (recommended while editing).
                </p>
              </div>
              <Switch checked={isPublished} onCheckedChange={setIsPublished} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Marking Scheme */}
      <Card className="card-soft border-0">
        <CardHeader>
          <CardTitle className="text-base">Marking Scheme</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Correct</Label>
            <Input
              type="number"
              value={String(markingScheme.correct)}
              onChange={(e) =>
                setMarkingScheme((p) => ({ ...p, correct: safeNum(e.target.value, 5) }))
              }
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Incorrect</Label>
            <Input
              type="number"
              value={String(markingScheme.incorrect)}
              onChange={(e) =>
                setMarkingScheme((p) => ({ ...p, incorrect: safeNum(e.target.value, -1) }))
              }
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Unanswered</Label>
            <Input
              type="number"
              value={String(markingScheme.unanswered)}
              onChange={(e) =>
                setMarkingScheme((p) => ({ ...p, unanswered: safeNum(e.target.value, 0) }))
              }
              className="rounded-xl"
            />
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      <Card className="card-soft border-0">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Sections</CardTitle>
          <Button variant="outline" className="rounded-xl" onClick={addSection}>
            <Plus className="h-4 w-4 mr-2" />
            Add Section
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {sections.map((s, idx) => (
            <div key={s.id} className="p-4 rounded-2xl border border-border bg-muted/20">
              <div className="flex flex-col md:flex-row gap-3 md:items-end">
                <div className="flex-1 space-y-2">
                  <Label>Section Name</Label>
                  <Input
                    value={s.name}
                    onChange={(e) => updateSection(s.id, { name: e.target.value })}
                    className="rounded-xl"
                    placeholder={`Section ${idx + 1}`}
                  />
                </div>

                <div className="w-full md:w-44 space-y-2">
                  <Label>Questions</Label>
                  <Input
                    type="number"
                    value={String(s.questionsCount)}
                    onChange={(e) =>
                      updateSection(s.id, { questionsCount: Math.max(0, safeNum(e.target.value, 0)) })
                    }
                    className="rounded-xl"
                    min={0}
                  />
                </div>

                <div className="w-full md:w-52 space-y-2">
                  <Label>Duration (optional)</Label>
                  <Input
                    type="number"
                    value={s.durationMinutes == null ? "" : String(s.durationMinutes)}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateSection(s.id, {
                        durationMinutes: v === "" ? undefined : Math.max(0, safeNum(v, 0)),
                      });
                    }}
                    className="rounded-xl"
                    placeholder="e.g. 20"
                    min={0}
                  />
                </div>

                <Button
                  variant="ghost"
                  className="rounded-xl text-destructive"
                  onClick={() => removeSection(s.id)}
                  disabled={sections.length <= 1}
                  title={sections.length <= 1 ? "At least 1 section required" : "Remove section"}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
            <p className="text-sm text-muted-foreground">Declared total questions</p>
            <p className="text-sm font-semibold">{computedQuestionsCount}</p>
          </div>

          <p className="text-xs text-muted-foreground">
            Note: the <b>Questions</b> page can maintain the real count later by syncing with question docs.
          </p>
        </CardContent>
      </Card>

      {/* Syllabus */}
      <Card className="card-soft border-0">
        <CardHeader>
          <CardTitle className="text-base">Syllabus</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>Topics (one per line)</Label>
          <Textarea
            value={syllabusText}
            onChange={(e) => setSyllabusText(e.target.value)}
            className="rounded-2xl min-h-[140px]"
            placeholder={`E.g.\nNumber System\nAlgebra\nTrigonometry\n...`}
          />
        </CardContent>
      </Card>

      {/* Bottom actions */}
      <div className="flex flex-col sm:flex-row gap-2 justify-end">
        <Button
          variant="outline"
          className="rounded-xl"
          onClick={() => navigate("/admin/tests")}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          variant="outline"
          className="rounded-xl"
          onClick={() => save(true)}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save & Questions
        </Button>
        <Button className="gradient-bg rounded-xl" onClick={() => save(false)} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save
        </Button>
      </div>
    </div>
  );
}

