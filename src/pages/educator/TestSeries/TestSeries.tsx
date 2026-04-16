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
  Folder,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Move,
  Award,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import EmptyState from "@/components/educator/EmptyState";
import AiQuestionImportOverlay from "@/components/educator/AiQuestionImportOverlay";
import InlineStatusTracker from "@/components/educator/InlineStatusTracker";
import ImageTextarea from "@/components/educator/ImageTextarea";
import {
  buildImportedQuestionPayload,
  formatNegativeMarksDisplay,
  importQuestionsFromPdf,
  type AiImportPreviewItem,
  type AiImportSummary,
  type PageProgressUpdate,
} from "@/lib/aiQuestionImport";
import { aiFeatureFlags, getAiFeatureDisabledMessage } from "@/lib/aiFeatureFlags";
import { uploadToImageKit } from "@/lib/imagekitUpload";

// Component
import CreateCustomTest from "./CreateCustomTest";
import NewFolderButton from "./NewFolder";

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
import MoveTest from "./MoveTest";

type Difficulty = "easy" | "medium" | "hard";

type TestQuestion = {
  id: string;
  questionOrder?: number;

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

  // Always normalize to +5 marks and -1 negative marks
  const marks = 5;
  const negativeMarks = -1;

  const difficulty = (data?.difficulty as Difficulty) || "medium";

  return {
    id,
    questionOrder: Number.isFinite(Number(data?.questionOrder)) ? Number(data.questionOrder) : undefined,
    question,
    options,
    correctOption: Number.isFinite(correctOption) ? correctOption : 0,
    explanation: data?.explanation ? String(data.explanation) : "",
    difficulty,
    subject: data?.subject ? String(data.subject) : "",
    topic: data?.topic ? String(data.topic) : "",
    marks: marks,
    negativeMarks: negativeMarks,
    isActive: data?.isActive !== false,
    createdAt: data?.createdAt,
    updatedAt: data?.updatedAt,
  };
}

function timestampToMillis(value: any) {
  if (!value) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return 0;
}

function sortQuestionsForDisplay(rows: TestQuestion[]) {
  return [...rows].sort((a, b) => {
    const aOrder = Number.isFinite(Number(a.questionOrder)) ? Number(a.questionOrder) : null;
    const bOrder = Number.isFinite(Number(b.questionOrder)) ? Number(b.questionOrder) : null;
    if (aOrder != null && bOrder != null && aOrder !== bOrder) return aOrder - bOrder;
    if (aOrder != null && bOrder == null) return -1;
    if (aOrder == null && bOrder != null) return 1;

    const aImportIndex = Number.isFinite(Number(a.importSourceIndex)) ? Number(a.importSourceIndex) : null;
    const bImportIndex = Number.isFinite(Number(b.importSourceIndex)) ? Number(b.importSourceIndex) : null;
    if (aImportIndex != null && bImportIndex != null && aImportIndex !== bImportIndex) {
      return aImportIndex - bImportIndex;
    }

    const aCreated = timestampToMillis(a.createdAt) || timestampToMillis(a.updatedAt);
    const bCreated = timestampToMillis(b.createdAt) || timestampToMillis(b.updatedAt);
    if (aCreated !== bCreated) return aCreated - bCreated;

    return a.id.localeCompare(b.id);
  });
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

  try {
    // Use "website" scope so educators can upload (question-bank scope is admin-only)
    const { url } = await uploadToImageKit(f, f.name, folder, "website");
    const imgTag = `\n<img src="${url}" alt="" />\n`;
    return { next: (current || "") + imgTag, url };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Failed to upload image";
    console.error("[Image Upload Error]", errorMsg);
    throw error; // Re-throw so caller can handle
  }
}

export default function TestSeries() {
  const [activeTab, setActiveTab] = useState<"library" | "bank">("library");
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Data
  const [myTests, setMyTests] = useState<any[]>([]);
  const [bankTests, setBankTests] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // UI
  const [search, setSearch] = useState("");
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<any>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [globalAttemptsAllowed, setGlobalAttemptsAllowed] = useState(3);
  const [savingGlobalAttempts, setSavingGlobalAttempts] = useState(false);

  // Create custom test dialog fields
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Folder UI state
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderCreating, setFolderCreating] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [moveTestOpen, setMoveTestOpen] = useState(false);
  const [testToMove, setTestToMove] = useState<any>(null);

  // Auth + Data
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      setCurrentUser(user);

      // Load educator preferences
      const unsubEdu = onSnapshot(doc(db, "educators", user.uid), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setGlobalAttemptsAllowed(data?.testDefaults?.attemptsAllowed ?? 3);
        }
      });

      // FOLDERS: educators/{uid}/folders
      const foldersQ = query(collection(db, "educators", user.uid, "folders"));
      const unsubFolders = onSnapshot(
        foldersQ,
        (snap) => {
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setFolders(rows);
        },
        () => {
          toast.error("Failed to load folders.");
        }
      );

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
        unsubFolders();
        unsubMy();
        unsubBank();
      };
    });

    return () => unsubAuth();
  }, []);

  const handleCreateFolder = async () => {
    if (!currentUser) {
      toast.error("Please login again and retry.");
      return;
    }

    const name = newFolderName.trim();
    if (!name) {
      toast.error("Folder name is required.");
      return;
    }

    const exists = folders.some(
      (f) => String(f?.name || "").trim().toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      toast.error("A folder with this name already exists.");
      return;
    }

    setFolderCreating(true);
    try {
      const folderRef = await addDoc(collection(db, "educators", currentUser.uid, "folders"), {
        name,
        createdAt: serverTimestamp(),
      });
      setExpandedFolders((prev) => ({ ...prev, [folderRef.id]: true }));
      toast.success("Folder created");
      setNewFolderName("");
      setCreateFolderOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to create folder");
    } finally {
      setFolderCreating(false);
    }
  };

  const handleMoveTest = async (testId: string, folderId: string | null) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, "educators", currentUser.uid, "my_tests", testId), {
        folderId: folderId,
        updatedAt: serverTimestamp(),
      });
      toast.success("Moved successfully");
      setMoveTestOpen(false);
      setTestToMove(null);
    } catch (e) {
      console.error(e);
      toast.error("Failed to move test");
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!currentUser) return;
    if (!confirm("Delete this folder? Tests inside will be moved to their subject folders or Uncategorized.")) return;
    try {
      // 1. Reset folderId for tests in this folder
      const batch = writeBatch(db);
      const testsInFolder = myTests.filter(t => t.folderId === folderId);
      testsInFolder.forEach(t => {
        batch.update(doc(db, "educators", currentUser.uid, "my_tests", t.id), { folderId: null });
      });

      // 2. Delete folder doc
      batch.delete(doc(db, "educators", currentUser.uid, "folders", folderId));

      await batch.commit();
      toast.success("Folder deleted");
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete folder");
    }
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const normalizeSubjectName = (sub: string) => {
    const s = sub.trim().toLowerCase();

    // Exact mapping for requested subjects
    if (s === "bst" || s === "business studies" || s === "business study") return "Business Studies";
    if (s === "phy" || s === "physics") return "Physics";
    if (s === "chem" || s === "chemistry") return "Chemistry";
    if (s === "math" || s === "maths" || s === "mathematics") return "Maths";
    if (s === "eng" || s === "english") return "English";
    if (s === "gt" || s === "general test") return "General Test";
    if (s === "acc" || s === "accountancy" || s === "accounts") return "Accountancy";
    if (s === "eco" || s === "economics") return "Economics";
    if (s === "geo" || s === "geography") return "Geography";
    if (s === "pol sc" || s === "political science" || s === "polscience" || s === "polity") return "Political Science";
    if (s === "hist" || s === "history") return "History";

    // Default: Capitalize first letter of each word
    return sub.trim().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  };

  const SUGGESTED_SUBJECTS = [
    "Physics", "Chemistry", "Maths", "English", "General Test",
    "Accountancy", "Business Studies", "Economics", "Geography",
    "Political Science", "History"
  ];

  const groupedTests = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = myTests.filter((t) => {
      if (!q) return true;
      const hay = `${t.title || ""} ${t.description || ""} ${t.subject || ""} ${t.level || ""}`.toLowerCase();
      return hay.includes(q);
    });

    const groups: Record<string, { name: string; type: "custom" | "subject" | "uncategorized", tests: any[] }> = {};

    // 1. Custom Folders (Preserve empty custom folders)
    folders.forEach(f => {
      groups[f.id] = { name: f.name, type: "custom", tests: [] };
    });

    // 2. Pre-create empty folders for main subjects if they have tests or to keep them visible
    // (Actually, let's only create them if tests exist or user has custom folder with same name)

    // 3. Distribute Tests
    filtered.forEach(t => {
      if (t.folderId && groups[t.folderId]) {
        groups[t.folderId].tests.push(t);
      } else if (t.subject) {
        const normalizedName = normalizeSubjectName(t.subject);
        const subKey = `subject_${normalizedName.toLowerCase().replace(/\s+/g, "_")}`;
        if (!groups[subKey]) {
          groups[subKey] = { name: normalizedName, type: "subject", tests: [] };
        }
        groups[subKey].tests.push(t);
      } else {
        const unKey = "uncategorized";
        if (!groups[unKey]) {
          groups[unKey] = { name: "Uncategorized", type: "uncategorized", tests: [] };
        }
        groups[unKey].tests.push(t);
      }
    });

    return groups;
  }, [myTests, folders, search]);

  const groupedBankTests = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = bankTests.filter((t) => {
      if (!q) return true;
      const hay = `${t.title || ""} ${t.description || ""} ${t.subject || ""} ${t.level || ""}`.toLowerCase();
      return hay.includes(q);
    });

    const groups: Record<string, { name: string; type: "subject" | "uncategorized", tests: any[] }> = {};

    filtered.forEach(t => {
      if (t.subject) {
        const normalizedName = normalizeSubjectName(t.subject);
        const subKey = `bank_subject_${normalizedName.toLowerCase().replace(/\s+/g, "_")}`;
        if (!groups[subKey]) {
          groups[subKey] = { name: normalizedName, type: "subject", tests: [] };
        }
        groups[subKey].tests.push(t);
      } else {
        const unKey = "bank_uncategorized";
        if (!groups[unKey]) {
          groups[unKey] = { name: "Uncategorized", type: "uncategorized", tests: [] };
        }
        groups[unKey].tests.push(t);
      }
    });

    return groups;
  }, [bankTests, search]);

  const folderState = {
    createFolderOpen,
    setCreateFolderOpen,
    newFolderName,
    setNewFolderName,
    folderCreating,
    handleCreateFolder
  };

  const handleSaveGlobalAttempts = async (val: number) => {
    if (!currentUser) return;
    setSavingGlobalAttempts(true);
    try {
      // 1. Update educator profile
      await updateDoc(doc(db, "educators", currentUser.uid), {
        "testDefaults.attemptsAllowed": val,
        updatedAt: serverTimestamp(),
      });

      // 2. Bulk update all existing tests to this value
      const testsSnap = await getDocs(collection(db, "educators", currentUser.uid, "my_tests"));
      if (!testsSnap.empty) {
        const CHUNK_SIZE = 450;
        const docs = testsSnap.docs;
        
        for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
          const batch = writeBatch(db);
          const chunk = docs.slice(i, i + CHUNK_SIZE);
          chunk.forEach((d) => {
            batch.update(d.ref, { 
              attemptsAllowed: val, 
              updatedAt: serverTimestamp() 
            });
          });
          await batch.commit();
        }
      }

      toast.success(`Global default attempts set to ${val} for all tests`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to save global setting");
    } finally {
      setSavingGlobalAttempts(false);
    }
  };

  const handleUpdateTestAttempts = async (testId: string, val: number) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, "educators", currentUser.uid, "my_tests", testId), {
        attemptsAllowed: val,
        updatedAt: serverTimestamp(),
      });
      toast.success(`Attempts for this test set to ${val}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to update test attempts");
    }
  };

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
        attemptsAllowed: globalAttemptsAllowed,
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
      attemptsAllowed: globalAttemptsAllowed,

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

  const creatCustomTestState = {
    createOpen,
    setCreateOpen,
    handleCreateCustom,
    creating
  }

  const moveTestState = {
    moveTestOpen,
    setMoveTestOpen,
    testToMove,
    handleMoveTest,
    folders
  }

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

        <div className="hidden lg:flex items-center gap-4 bg-muted/30 border border-border/50 rounded-full px-4 py-1.5 transition-all hover:bg-muted/50 group">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform">
              <Award className="h-3.5 w-3.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-black text-muted-foreground tracking-widest leading-none">Default</span>
              <span className="text-[11px] font-bold text-foreground/80">Attempts</span>
            </div>
          </div>
          <div className="h-6 w-px bg-border/60" />
          <Select
            value={String(globalAttemptsAllowed)}
            onValueChange={(v) => handleSaveGlobalAttempts(Number(v))}
            disabled={savingGlobalAttempts}
          >
            <SelectTrigger className="h-8 w-[60px] rounded-full border-none bg-background shadow-sm hover:bg-muted transition-colors text-xs font-black focus:ring-0">
              {savingGlobalAttempts ? <Loader2 className="h-3 w-3 animate-spin text-primary" /> : <SelectValue />}
            </SelectTrigger>
            <SelectContent className="rounded-xl border-none shadow-2xl overflow-hidden p-1">
              <SelectItem value="1" className="rounded-lg text-xs font-bold py-2">1 Attempt</SelectItem>
              <SelectItem value="2" className="rounded-lg text-xs font-bold py-2">2 Attempts</SelectItem>
              <SelectItem value="3" className="rounded-lg text-xs font-bold py-2">3 Attempts</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="hidden lg:flex items-center gap-4 bg-muted/30 border border-border/50 rounded-full px-4 py-1.5 transition-all hover:bg-muted/50 group">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform">
              <Award className="h-3.5 w-3.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-black text-muted-foreground tracking-widest leading-none">Default</span>
              <span className="text-[11px] font-bold text-foreground/80">Attempts</span>
            </div>
          </div>
          <div className="h-6 w-px bg-border/60" />
          <Select
            value={String(globalAttemptsAllowed)}
            onValueChange={(v) => handleSaveGlobalAttempts(Number(v))}
            disabled={savingGlobalAttempts}
          >
            <SelectTrigger className="h-8 w-[60px] rounded-full border-none bg-background shadow-sm hover:bg-muted transition-colors text-xs font-black focus:ring-0">
              {savingGlobalAttempts ? <Loader2 className="h-3 w-3 animate-spin text-primary" /> : <SelectValue />}
            </SelectTrigger>
            <SelectContent className="rounded-xl border-none shadow-2xl overflow-hidden p-1">
              <SelectItem value="1" className="rounded-lg text-xs font-bold py-2">1 Attempt</SelectItem>
              <SelectItem value="2" className="rounded-lg text-xs font-bold py-2">2 Attempts</SelectItem>
              <SelectItem value="3" className="rounded-lg text-xs font-bold py-2">3 Attempts</SelectItem>
            </SelectContent>
          </Select>
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

          {/* Create Custom Test */}
          <CreateCustomTest {...creatCustomTestState} />

        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <div className="w-full flex flex-row justify-between">
          <TabsList className="rounded-xl">
            <TabsTrigger value="library" className="rounded-xl">
              Your Library
            </TabsTrigger>
            <TabsTrigger value="bank" className="rounded-xl">
              Admin Bank
            </TabsTrigger>
          </TabsList>

          <NewFolderButton {...folderState} />
        </div>

        {/* Library */}
        <TabsContent value="library" className="mt-6">
          {Object.keys(groupedTests).length === 0 ? (
            <EmptyState icon={FileText} title="No tests found" description="Create a custom test or import from the admin bank." />
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedTests).map(([groupId, group]) => {
                const isExpanded = !!expandedFolders[groupId]; // default closed
                return (
                  <div key={groupId} className="space-y-4">
                    <div
                      className="flex items-center justify-between group cursor-pointer bg-muted/20 p-2 rounded-xl"
                      onClick={() => toggleFolder(groupId)}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                        <Folder className={cn("h-5 w-5", group.type === "custom" ? "text-primary fill-primary/20" : "text-muted-foreground")} />
                        <h3 className="font-semibold text-lg">{group.name}</h3>
                        <Badge variant="secondary" className="rounded-full ml-2">
                          {group.tests.length}
                        </Badge>
                      </div>

                      {group.type === "custom" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 rounded-xl text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFolder(groupId);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pl-4">
                        {group.tests.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 italic col-span-full">No tests in this folder.</p>
                        ) : (
                          group.tests.map((test) => (
                            <motion.div key={test.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                              <Card className="h-full flex flex-col hover:shadow-md transition-shadow relative">
                                <CardHeader>
                                  <CardTitle className="flex justify-between items-start gap-2">
                                    <span className="truncate text-lg">{test.title}</span>
                                    <div className="flex items-center gap-1">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
                                            <MoreVertical className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-xl">
                                          <DropdownMenuItem onClick={() => {
                                            setTestToMove(test);
                                            setMoveTestOpen(true);
                                          }}>
                                            <Move className="mr-2 h-4 w-4" /> Move to Folder
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            className="text-destructive"
                                            onClick={async () => {
                                              if (!currentUser) return;
                                              if (!confirm("Delete this test and all its questions?")) return;
                                              try {
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
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="flex-1 flex flex-col gap-4">
                                  <p className="text-sm text-muted-foreground line-clamp-2">{test.description}</p>

                                  <div className="flex items-center justify-between mt-auto">
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <BookOpen className="h-3 w-3" /> {test.subject || "—"}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" /> {Number(test.durationMinutes || 0)}m
                                      </span>
                                      {test.source === "imported" ? (
                                        <Badge variant="secondary" className="text-[10px] py-0 px-2 h-5">
                                          Imported
                                        </Badge>
                                      ) : (
                                        <Badge className="text-[10px] py-0 px-2 h-5">Custom</Badge>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] font-medium text-muted-foreground uppercase">Attempts:</span>
                                      <Select
                                        value={String(test.attemptsAllowed || 3)}
                                        onValueChange={(v) => handleUpdateTestAttempts(test.id, Number(v))}
                                      >
                                        <SelectTrigger className="h-7 w-[50px] text-xs rounded-lg bg-muted/50 border-none shadow-none">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                          <SelectItem value="1">1</SelectItem>
                                          <SelectItem value="2">2</SelectItem>
                                          <SelectItem value="3">3</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 gap-2 mt-4 pt-4 border-t">
                                    <Button
                                      className="gradient-bg text-white rounded-xl shadow-sm"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedTest(test);
                                        setIsManageOpen(true);
                                      }}
                                    >
                                      <Edit className="mr-2 h-3 w-3" /> Manage Questions
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            </motion.div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Move Test Dialog */}
          <MoveTest {...moveTestState}/>
          
        </TabsContent>

        {/* Admin Bank */}
        <TabsContent value="bank" className="mt-6">
          {Object.keys(groupedBankTests).length === 0 ? (
            <EmptyState icon={FileText} title="No bank tests found" description="No admin tests are available for import yet." />
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedBankTests).map(([groupId, group]) => {
                const isExpanded = !!expandedFolders[groupId]; // default closed
                return (
                  <div key={groupId} className="space-y-4">
                    <div
                      className="flex items-center justify-between group cursor-pointer bg-muted/20 p-2 rounded-xl"
                      onClick={() => toggleFolder(groupId)}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                        <Folder className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold text-lg">{group.name}</h3>
                        <Badge variant="secondary" className="rounded-full ml-2">
                          {group.tests.length}
                        </Badge>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pl-4">
                        {group.tests.map((test) => (
                          <Card key={test.id} className="bg-muted/30 border-dashed hover:border-primary transition-colors">
                            <CardHeader>
                              <CardTitle className="flex justify-between items-start">
                                <span className="truncate">{test.title}</span>
                                <Badge variant="outline">Admin</Badge>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <p className="text-sm text-muted-foreground line-clamp-2">{test.description}</p>
                              <div className="flex gap-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {test.subject || "—"}</span>
                                <span>•</span>
                                <span>{test.level || "—"}</span>
                              </div>
                              <Button className="w-full rounded-xl" disabled={importingId === test.id} onClick={() => handleImport(test)}>
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
                  </div>
                );
              })}
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
  // Image upload state is now handled internally by ImageTextarea

  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [confirmPdfOpen, setConfirmPdfOpen] = useState(false);
  const [pendingPdfFile, setPendingPdfFile] = useState<File | null>(null);
  const [savingImported, setSavingImported] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importSummary, setImportSummary] = useState<AiImportSummary | null>(null);
  const [importItems, setImportItems] = useState<AiImportPreviewItem[]>([]);
  const [importProgressUpdates, setImportProgressUpdates] = useState<PageProgressUpdate[]>([]);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const importAbortControllerRef = useRef<AbortController | null>(null);
  const isAiPdfImportEnabled = aiFeatureFlags.pdfImport;

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
        setQuestions(sortQuestionsForDisplay(rows));
        setLoading(false);
      },
      () => {
        setLoading(false);
        toast.error("Failed to load questions");
      }
    );
    return () => unsub();
  }, [qCol]);

  useEffect(() => {
    if (!importBusy) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!importAbortControllerRef.current) return;
      importAbortControllerRef.current.abort();
      event.preventDefault();
      event.returnValue = "AI import is in progress. Leaving will cancel it.";
    };

    const handlePageHide = () => {
      if (importAbortControllerRef.current) {
        importAbortControllerRef.current.abort();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [importBusy]);

  const filteredQuestions = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return questions;
    return questions.filter((row) => {
      const hay = `${stripHtml(row.question)} ${stripHtml(row.explanation || "")} ${row.subject || ""} ${row.topic || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [questions, searchQ]);

  const questionNumberById = useMemo(() => {
    const numberMap = new Map<string, number>();
    questions.forEach((q, index) => {
      const persistedOrder = Number(q.questionOrder);
      const displayOrder = Number.isFinite(persistedOrder) && persistedOrder > 0 ? persistedOrder : index + 1;
      numberMap.set(q.id, displayOrder);
    });
    return numberMap;
  }, [questions]);

  function getNextQuestionOrder() {
    const maxOrder = questions.reduce((max, q) => {
      const n = Number(q.questionOrder);
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0);
    return maxOrder + 1;
  }

  async function resequenceQuestionOrders(remainingQuestions: TestQuestion[]) {
    const ordered = sortQuestionsForDisplay(remainingQuestions);
    const updates = ordered
      .map((q, index) => {
        const nextOrder = index + 1;
        const currentOrder = Number(q.questionOrder);
        return {
          id: q.id,
          nextOrder,
          currentOrder: Number.isFinite(currentOrder) ? currentOrder : null,
        };
      })
      .filter((item) => item.currentOrder !== item.nextOrder);

    if (!updates.length) return;

    const CHUNK_SIZE = 450;
    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      const chunk = updates.slice(i, i + CHUNK_SIZE);
      chunk.forEach((item) => {
        batch.update(doc(qCol, item.id), {
          questionOrder: item.nextOrder,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }
  }

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
          questionOrder: getNextQuestionOrder(),
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
      const remaining = questions.filter((q) => q.id !== id);
      await resequenceQuestionOrders(remaining);
      setQuestions(
        sortQuestionsForDisplay(remaining).map((q, index) => ({
          ...q,
          questionOrder: index + 1,
        }))
      );
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
        questionOrder: getNextQuestionOrder(),
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
    if (!isAiPdfImportEnabled) {
      toast.error(getAiFeatureDisabledMessage("pdfImport"));
      return;
    }

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
    setImportProgressUpdates([]);
    toast.info("AI import started. Please do not close this tab while processing.", {
      duration: 3500,
    });

    try {
      const result = await importQuestionsFromPdf(
        file,
        { testTitle, subject: testSubject, educatorId: educatorUid },
        (update) => {
          setImportProgressUpdates((prev) => [...prev, update]);
        },
        importAbortControllerRef.current.signal,
        // Callback to add questions in real-time as they're detected
        (newQuestions, pageNum) => {
          setImportItems((prev) => sortImportItemsBySourceIndex([...prev, ...newQuestions]));
        }
      );
      // Update summary at the end (questions already added via callback)
      setImportSummary(result.summary || null);
      setImportItems(
        sortImportItemsBySourceIndex(
          (result.items || []).map((item) => ({
            ...item,
            include: item.status === "ready",
          }))
        )
      );
      setImportProgressUpdates([]);
      toast.success("AI import preview is ready");
    } catch (error) {
      console.error(error);
      const errorMsg = error instanceof Error ? error.message : "Failed to import PDF with AI";
      // Don't show error toast if it was cancelled
      if (!errorMsg.includes("cancelled")) {
        toast.error(errorMsg);
      }
      setImportPreviewOpen(false);
      setImportProgressUpdates([]);
    } finally {
      setImportBusy(false);
      importAbortControllerRef.current = null;
    }
  }

  async function confirmAndStartPdfImport() {
    if (!pendingPdfFile) {
      setConfirmPdfOpen(false);
      return;
    }

    const selectedFile = pendingPdfFile;
    setConfirmPdfOpen(false);
    setPendingPdfFile(null);
    await handlePdfSelected(selectedFile);
  }

  function cancelPdfImport() {
    if (importAbortControllerRef.current) {
      importAbortControllerRef.current.abort();
      setImportBusy(false);
      setImportPreviewOpen(false);
      setImportProgressUpdates([]); // Clear progress tracker
      toast.info("PDF import cancelled");
    }
  }

  function sortImportItemsBySourceIndex(items: AiImportPreviewItem[]) {
    return [...items].sort((a, b) => {
      const aIdx = Number.isFinite(Number(a.sourceIndex)) ? Number(a.sourceIndex) : Number.MAX_SAFE_INTEGER;
      const bIdx = Number.isFinite(Number(b.sourceIndex)) ? Number(b.sourceIndex) : Number.MAX_SAFE_INTEGER;
      return aIdx - bIdx;
    });
  }

  function updateImportItemInclude(sourceIndex: number, include: boolean) {
    setImportItems((prev) => prev.map((item) => (item.sourceIndex === sourceIndex ? { ...item, include } : item)));
  }

  function selectAllImportItems() {
    setImportItems((prev) =>
      prev.map((item) => ({
        ...item,
        include: true,
      }))
    );
  }

  function selectOnlyReadyImportItems() {
    setImportItems((prev) =>
      prev.map((item) => ({
        ...item,
        include: item.status === "ready",
      }))
    );
  }

  function selectOnlyPartialImportItems() {
    setImportItems((prev) =>
      prev.map((item) => ({
        ...item,
        include: item.status === "partial",
      }))
    );
  }

  function selectOnlyRejectedImportItems() {
    setImportItems((prev) =>
      prev.map((item) =>
        ({ ...item, include: item.status === "rejected" })
      )
    );
  }

  async function saveImportedQuestions() {
    const selected = importItems.filter((item) => item.include);
    if (!selected.length) {
      toast.error("No questions selected to save");
      return;
    }

    setSavingImported(true);
    try {
      const baseOrder = questions.reduce((max, q) => {
        const n = Number(q.questionOrder);
        return Number.isFinite(n) ? Math.max(max, n) : max;
      }, 0);

      for (let i = 0; i < selected.length; i += 200) {
        const batch = writeBatch(db);
        const chunk = selected.slice(i, i + 200);
        for (let j = 0; j < chunk.length; j += 1) {
          const item = chunk[j];
          const payload = buildImportedQuestionPayload(item);
          const newRef = doc(qCol);
          batch.set(newRef, {
            ...payload,
            questionOrder: baseOrder + i + j + 1,
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
      setImportProgressUpdates([]); // Clear progress tracker
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
                disabled={importBusy || !isAiPdfImportEnabled}
                title={!isAiPdfImportEnabled ? getAiFeatureDisabledMessage("pdfImport") : undefined}
              >
                {importBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                Import PDF with AI
              </Button>
              {!isAiPdfImportEnabled ? (
                <p className="text-xs text-muted-foreground">
                  {getAiFeatureDisabledMessage("pdfImport")}
                </p>
              ) : null}
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0] || null;
                  event.currentTarget.value = "";
                  if (!file) return;
                  setPendingPdfFile(file);
                  setConfirmPdfOpen(true);
                }}
              />

              {importBusy && importProgressUpdates.length > 0 && (
                <InlineStatusTracker updates={importProgressUpdates} isProcessing={importBusy} />
              )}

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
                filteredQuestions.map((q) => (
                  <div
                    key={q.id}
                    onClick={() => openEdit(q)}
                    className="p-3 rounded-xl border cursor-pointer text-sm hover:bg-accent transition-colors bg-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium line-clamp-2">
                          Q{questionNumberById.get(q.id) ?? "-"}: {stripHtml(q.question) || "(empty)"}
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
                  <Label>Question (text or HTML)</Label>
                  <ImageTextarea
                    value={formQuestion}
                    onChange={setFormQuestion}
                    folder="/test-questions"
                    placeholder="Type text, or paste / drag & drop images. Supports HTML like <b>bold</b>"
                    minHeight="140px"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[0, 1, 2, 3].map((idx) => (
                    <div key={idx} className="space-y-2">
                      <Label>
                        Option {String.fromCharCode(65 + idx)}
                        {formCorrect === idx ? <span className="ml-2 text-green-600 inline-flex items-center gap-1 text-xs"><CheckCircle2 className="h-3 w-3" /> Correct</span> : null}
                      </Label>
                      <ImageTextarea
                        value={formOptions[idx] || ""}
                        onChange={(v) => setFormOptions((prev) => prev.map((x, i) => (i === idx ? v : x)))}
                        folder="/test-options"
                        placeholder="Option text or HTML"
                        minHeight="90px"
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
                  <Label>Explanation (optional)</Label>
                  <ImageTextarea
                    value={formExplanation}
                    onChange={setFormExplanation}
                    folder="/test-explanations"
                    placeholder="Optional explanation (text or HTML). Drag & drop or paste images here."
                    minHeight="120px"
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
            if (!savingImported && !importBusy) {
              setImportPreviewOpen(false);
              setImportProgressUpdates([]); // Clear progress tracker
            }
          }}
          onCancel={cancelPdfImport}
          onItemIncludeChange={updateImportItemInclude}
          onSelectAll={selectAllImportItems}
          onSelectOnlyReady={selectOnlyReadyImportItems}
          onSelectOnlyPartial={selectOnlyPartialImportItems}
          onSelectOnlyRejected={selectOnlyRejectedImportItems}
          onSaveSelected={saveImportedQuestions}
        />

        <Dialog
          open={confirmPdfOpen}
          onOpenChange={(open) => {
            setConfirmPdfOpen(open);
            if (!open) {
              setPendingPdfFile(null);
            }
          }}
        >
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Confirm PDF Import</DialogTitle>
              <DialogDescription>
                Please confirm this is the correct file to import with AI.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border bg-muted/30 p-3 text-sm">
              <p className="font-medium truncate">{pendingPdfFile?.name || "No file selected"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Size: {pendingPdfFile ? `${(pendingPdfFile.size / (1024 * 1024)).toFixed(2)} MB` : "-"}
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmPdfOpen(false);
                  setPendingPdfFile(null);
                }}
              >
                Cancel
              </Button>
              <Button className="gradient-bg text-white" onClick={confirmAndStartPdfImport}>
                Confirm & Start Import
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
