import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  setDoc,
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
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"library" | "bank">("library");
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Data
  const [myTests, setMyTests] = useState<any[]>([]);
  const [bankTests, setBankTests] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // UI
  const [search, setSearch] = useState("");
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

  const importedAdminTestIds = useMemo(() => {
    const ids = new Set<string>();

    myTests.forEach((test: any) => {
      const linkedId = String(test?.linkedAdminTestId || test?.originalTestId || "").trim();
      const isImportedFromAdmin =
        test?.originSource === "admin" ||
        test?.source === "imported" ||
        test?.source === "linked_admin";

      if (linkedId && isImportedFromAdmin) {
        ids.add(linkedId);
      }
    });

    return ids;
  }, [myTests]);

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

  // Import admin test as a shared reference (no question copy)
  const handleImport = async (bankTest: any) => {
    if (!currentUser) return;

    if (importedAdminTestIds.has(bankTest.id)) {
      toast.info("Already added to your library");
      return;
    }

    setImportingId(bankTest.id);

    try {
      const meta: any = pruneUndefined({
        title: bankTest.title ?? "",
        description: bankTest.description ?? "",
        subject: bankTest.subject ?? "",
        level: bankTest.level ?? "",
        durationMinutes: Number(bankTest.durationMinutes ?? bankTest.duration ?? 0),

        sections: bankTest.sections ?? [],
        instructions: bankTest.instructions ?? "",

        attemptsAllowed: globalAttemptsAllowed,
        markingScheme: bankTest.markingScheme ?? undefined,

        positiveMarks:
          bankTest.positiveMarks != null ? Number(bankTest.positiveMarks) : undefined,
        negativeMarks:
          bankTest.negativeMarks != null ? Number(bankTest.negativeMarks) : undefined,

        source: "linked_admin",
        originSource: "admin",
        linkedAdminTestId: bankTest.id,
        originalTestId: bankTest.id,
        isQuestionSourceShared: true,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: currentUser.uid,
        questionsCount: Math.max(
          0,
          Number(bankTest.questionsCount ?? bankTest.questionCount ?? bankTest.totalQuestions ?? 0)
        ),
      });

      await setDoc(doc(db, "educators", currentUser.uid, "my_tests", bankTest.id), meta);

      toast.success("Added as linked admin test");
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

        <div className="flex items-center gap-3 bg-white dark:bg-card border border-border/50 rounded-2xl px-4 py-2 shadow-sm hover:shadow-md transition-all group w-full sm:w-auto">
          <div className="flex items-center gap-3 flex-1 sm:flex-none">
            <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform shrink-0">
              <Award className="h-4 w-4" />
            </div>
            <div className="flex flex-col min-w-[90px]">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider leading-tight">Default Limit</span>
              <span className="text-xs font-semibold text-foreground truncate">Global Attempts</span>
            </div>
          </div>
          <div className="h-8 w-px bg-border/60 mx-1 shrink-0" />
          <Select
            value={String(globalAttemptsAllowed)}
            onValueChange={(v) => handleSaveGlobalAttempts(Number(v))}
            disabled={savingGlobalAttempts}
          >
            <SelectTrigger className="h-4 w-[65px] rounded-xl border-none bg-muted/50 hover:bg-muted transition-colors text-xs font-black focus:ring-0 shadow-none shrink-0">
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
                              {(() => {
                                const isAdminLinked =
                                  test.originSource === "admin" ||
                                  test.source === "imported" ||
                                  test.source === "linked_admin" ||
                                  test.isQuestionSourceShared === true ||
                                  !!test.linkedAdminTestId ||
                                  !!test.originalTestId;

                                return (
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

                                  <div className="flex flex-wrap items-center justify-between gap-y-3 mt-auto">
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1 shrink-0">
                                        <BookOpen className="h-3 w-3" /> {test.subject || "—"}
                                      </span>
                                      <span className="flex items-center gap-1 shrink-0">
                                        <Clock className="h-3 w-3" /> {Number(test.durationMinutes || 0)}m
                                      </span>
                                      {isAdminLinked ? (
                                        <Badge variant="outline" className="text-[10px] py-0 px-2 h-5 shrink-0">
                                          Admin Linked
                                        </Badge>
                                      ) : test.source === "imported" ? (
                                        <Badge variant="secondary" className="text-[10px] py-0 px-2 h-5 shrink-0">
                                          Imported
                                        </Badge>
                                      ) : (
                                        <Badge className="text-[10px] py-0 px-2 h-5 shrink-0">Custom</Badge>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1 bg-muted/30 px-2 py-1 rounded-lg shrink-0">
                                      <span className="text-[9px] font-bold text-muted-foreground uppercase">Attempts:</span>
                                      <Select
                                        value={String(test.attemptsAllowed || 3)}
                                        disabled={isAdminLinked}
                                        onValueChange={(v) => handleUpdateTestAttempts(test.id, Number(v))}
                                      >
                                        <SelectTrigger className="h-6 w-[45px] text-[10px] font-bold rounded-md bg-background border-none shadow-none focus:ring-0">
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
                                        navigate(`/educator/test-series/${test.id}/questions`);
                                      }}
                                    >
                                      <Edit className="mr-2 h-3 w-3" /> {isAdminLinked ? "View Questions" : "Manage Questions"}
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                                );
                              })()}
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
                        {group.tests.map((test) => {
                          const alreadyLinked = importedAdminTestIds.has(test.id);

                          return (
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
                              <Button
                                className="w-full rounded-xl"
                                disabled={importingId === test.id || alreadyLinked}
                                onClick={() => handleImport(test)}
                              >
                                {alreadyLinked ? (
                                  <>
                                    <CheckCircle2 className="mr-2 h-4 w-4" /> Added to Library
                                  </>
                                ) : importingId === test.id ? (
                                  <Loader2 className="animate-spin h-4 w-4" />
                                ) : (
                                  <>
                                    <Download className="mr-2 h-4 w-4" /> Import to Library
                                  </>
                                )}
                              </Button>
                            </CardContent>
                          </Card>
                        )})}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

    </div>
  );
}

