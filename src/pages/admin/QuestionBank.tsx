// src/pages/admin/QuestionBank.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Trash2,
  Edit,
  Upload,
  Download,
  Loader2,
  Image as ImageIcon,
  Check,
  FileSpreadsheet,
} from "lucide-react";
import JSZip from "jszip";
import Papa from "papaparse";
import katex from "katex";
import "katex/dist/katex.min.css";

import { db } from "@/lib/firebase";
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadToImageKit } from "@/lib/imagekitUpload";

type Difficulty = "easy" | "medium" | "hard";

type QBQuestion = {
  id: string;
  course?: string;
  topic?: string;
  difficulty?: Difficulty;

  question: string;
  options: string[];
  correctOption: number; // 0-based, single correct
  explanation?: string;

  marks?: number;
  negativeMarks?: number;

  tags?: string[];
  source?: string; // "manual" | "zip" | "csv"
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  searchText?: string;

  // Image URLs (pre-uploaded)
  questionImage?: string;
  optionImages?: string[]; // len 4
  explanationImage?: string;

  // Question format
  format?: "single_correct_mcq" | "multicorrect_mcq" | "subjective" | "subjective_long";

  // Multi-correct (CSV only)
  correctOptions?: number[]; // 0-based indices

  // Subject linkage
  subjectId?: string;
  subjectName?: string;

  // Multi-topic
  topics?: string[];

  // Ownership (for educator-visible admin questions)
  uploadedBy?: string;
  uploadedByRole?: "admin" | "educator";

  // Rendering mode: "html" (default, legacy) | "latex" (CSV imports)
  contentFormat?: "html" | "latex";
};

type ZipQuestion = {
  _id?: string;
  id?: string;
  subject?: string; // legacy field from zip imports
  ["spayee:objective"]?: string;
  type?: string;
  tag?: string[];
  text?: string;
  searchtext?: string;
  mark?: number;
  penalty?: number;
  options?: { option?: Array<{ content?: string }> };
  answer?: {
    correctOptions?: { option?: number[] };
    solution?: { text?: string };
  };
};

type QuestionBankScope = "admin" | "educator";

type QuestionBankProps = {
  scope?: QuestionBankScope;
  educatorUid?: string;
};

// ---------- helpers ----------
function stripHtml(html: string) {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
}

function sanitizeHtml(input: string) {
  if (!input) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(input, "text/html");

    const allowedTags = new Set([
      "P","BR","B","STRONG","I","EM","U","S","SUB","SUP","UL","OL","LI",
      "DIV","SPAN","IMG","A","H1","H2","H3","H4","H5","H6","TABLE","THEAD",
      "TBODY","TR","TH","TD","CODE","PRE",
    ]);

    const allowedAttrs = new Set(["href", "target", "rel", "src", "alt", "title", "width", "height"]);

    Array.from(doc.body.querySelectorAll("*")).forEach((el) => {
      if (!allowedTags.has(el.tagName)) {
        el.replaceWith(...Array.from(el.childNodes));
        return;
      }

      Array.from(el.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (name.startsWith("on")) el.removeAttribute(attr.name);
        else if (name === "style") el.removeAttribute(attr.name);
        else if (!allowedAttrs.has(attr.name)) el.removeAttribute(attr.name);
      });

      if (el.tagName === "A") {
        const href = el.getAttribute("href") || "";
        if (!href.startsWith("http") && !href.startsWith("/") && !href.startsWith("#")) {
          el.removeAttribute("href");
        } else {
          el.setAttribute("target", "_blank");
          el.setAttribute("rel", "noopener noreferrer");
        }
      }

      if (el.tagName === "IMG") {
        const src = el.getAttribute("src") || "";
        if (!src.startsWith("http") && !src.startsWith("data:")) {
          el.removeAttribute("src");
        }
      }
    });

    return doc.body.innerHTML;
  } catch {
    return input;
  }
}

function ensureDifficulty(v: any): Difficulty {
  const x = String(v || "").toLowerCase();
  if (x === "easy" || x === "medium" || x === "hard") return x;
  return "medium";
}

function normalizeTags(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

// Renders question text — either HTML (legacy) or LaTeX+plain text (CSV imports)
function QuestionRenderer({
  text,
  contentFormat,
  className,
}: {
  text: string;
  contentFormat?: "html" | "latex";
  className?: string;
}) {
  if (!text) return null;

  if (!contentFormat || contentFormat === "html") {
    return (
      <div
        className={cn("prose prose-sm max-w-none dark:prose-invert", className)}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }}
      />
    );
  }

  // Split on $$...$$ (display) and $...$ (inline) keeping delimiters
  const segments = text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)/g);

  return (
    <div className={cn("text-sm leading-relaxed", className)}>
      {segments.map((seg, i) => {
        if (seg.startsWith("$$") && seg.endsWith("$$")) {
          const math = seg.slice(2, -2);
          try {
            return (
              <span
                key={i}
                className="block text-center my-1"
                dangerouslySetInnerHTML={{
                  __html: katex.renderToString(math, { displayMode: true, throwOnError: false }),
                }}
              />
            );
          } catch {
            return <span key={i} className="font-mono text-xs bg-muted px-1 rounded">{seg}</span>;
          }
        }
        if (seg.startsWith("$") && seg.endsWith("$") && seg.length > 2) {
          const math = seg.slice(1, -1);
          try {
            return (
              <span
                key={i}
                dangerouslySetInnerHTML={{
                  __html: katex.renderToString(math, { displayMode: false, throwOnError: false }),
                }}
              />
            );
          } catch {
            return <span key={i} className="font-mono text-xs bg-muted px-1 rounded">{seg}</span>;
          }
        }
        return <span key={i} style={{ whiteSpace: "pre-wrap" }}>{seg}</span>;
      })}
    </div>
  );
}

function safeBaseNameFromSrc(src: string) {
  if (!src) return "";
  const cleaned = src.split("?")[0].split("#")[0];
  const base = cleaned.split("/").pop() || cleaned;
  try {
    return decodeURIComponent(base);
  } catch {
    return base;
  }
}

async function uploadQuestionImageToImageKit(file: File): Promise<string> {
  const { url } = await uploadToImageKit(file, file.name, "/question-bank");
  if (!url) throw new Error("ImageKit upload returned no URL");
  return url;
}



// ContentEditable editor with paste-image support
function RichHtmlEditor({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const el = divRef.current;
    if (!el) return;
    if (el.innerHTML !== value) el.innerHTML = value || "";
  }, [value]);

  const insertHtmlAtCursor = (html: string) => {
    const el = divRef.current;
    if (!el) return;
    el.focus();

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      el.innerHTML += html;
      onChange(el.innerHTML);
      return;
    }

    const range = sel.getRangeAt(0);
    range.deleteContents();

    const tpl = document.createElement("template");
    tpl.innerHTML = html;
    const frag = tpl.content;
    const lastNode = frag.lastChild;

    range.insertNode(frag);

    if (lastNode) {
      range.setStartAfter(lastNode);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    onChange(el.innerHTML);
  };

  const handleUploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files || []).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;

    setBusy(true);
    try {
      for (const f of list) {
        const url = await uploadQuestionImageToImageKit(f);
        insertHtmlAtCursor(`<img src="${url}" alt="image" />`);
      }
      toast({ title: "Image added", description: "Image uploaded and inserted." });
    } catch (e: any) {
      toast({
        title: "Image upload failed",
        description: typeof e?.message === "string" ? e.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files;
              if (f && f.length) handleUploadFiles(f);
              e.currentTarget.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ImageIcon className="h-4 w-4 mr-2" />}
            Add Image
          </Button>
        </div>
      </div>

      <div
        ref={divRef}
        contentEditable
        suppressContentEditableWarning
        className={cn(
          "min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "prose prose-sm max-w-none dark:prose-invert",
          busy && "opacity-60 pointer-events-none"
        )}
        data-placeholder={placeholder || "Type here..."}
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        onPaste={async (e) => {
          const dt = e.clipboardData;
          if (!dt) return;
          const files = dt.files;
          if (files && files.length) {
            const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
            if (imgs.length) {
              e.preventDefault();
              await handleUploadFiles(imgs);
            }
          }
        }}
        onDrop={async (e) => {
          const files = e.dataTransfer?.files;
          if (files && files.length) {
            const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
            if (imgs.length) {
              e.preventDefault();
              await handleUploadFiles(imgs);
            }
          }
        }}
      />

      <p className="text-xs text-muted-foreground">
        Tip: You can paste images with <span className="font-medium">Ctrl + V</span> (or ⌘V).
      </p>
    </div>
  );
}

export default function QuestionBank({ scope = "admin", educatorUid }: QuestionBankProps = {}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [items, setItems] = useState<QBQuestion[]>([]);
  const [qSearch, setQSearch] = useState("");
  const [fCourse, setFCourse] = useState<string>("all");
  const [fTopic, setFTopic] = useState<string>("all");
  const [fDifficulty, setFDifficulty] = useState<string>("all");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [course, setCourse] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [tags, setTags] = useState<string>("");

  const [question, setQuestion] = useState<string>("");
  const [options, setOptions] = useState<string[]>(["", "", "", ""]);
  const [correctOption, setCorrectOption] = useState<number>(0);
  const [explanation, setExplanation] = useState<string>("");

  const [marks, setMarks] = useState<number>(5);
  const [negativeMarks, setNegativeMarks] = useState<number>(-1);

  // Extended editor fields
  const [qFormat, setQFormat] = useState<NonNullable<QBQuestion["format"]>>("single_correct_mcq");
  const [qSubjectId, setQSubjectId] = useState("");
  const [topicsInput, setTopicsInput] = useState(""); // comma-separated
  const [multiCorrects, setMultiCorrects] = useState<number[]>([0]);
  const [qImgUrl, setQImgUrl] = useState("");
  const [oImgUrls, setOImgUrls] = useState<string[]>(["", "", "", ""]);
  const [eImgUrl, setEImgUrl] = useState("");

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importInfo, setImportInfo] = useState<{ total: number; done: number } | null>(null);

  const [imgUploadOpen, setImgUploadOpen] = useState(false);
  const [imgUploading, setImgUploading] = useState(false);
  const [imgUrl, setImgUrl] = useState("");
  const [imgCopied, setImgCopied] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);

  // Subjects (for CSV subject matching)
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  // Admin questions visible in educator scope
  const [adminItems, setAdminItems] = useState<QBQuestion[]>([]);

  // CSV import
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvProgress, setCsvProgress] = useState(0);
  const [csvInfo, setCsvInfo] = useState<{ total: number; done: number; errors: number } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgUploading(true);
    setImgUrl("");
    try {
      const result = await uploadToImageKit(file, file.name, "/question-bank", "question-bank");
      setImgUrl(result.url);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setImgUploading(false);
      if (imgInputRef.current) imgInputRef.current.value = "";
    }
  }

  function copyImgUrl() {
    if (!imgUrl) return;
    navigator.clipboard.writeText(imgUrl).then(() => {
      setImgCopied(true);
      setTimeout(() => setImgCopied(false), 2000);
    });
  }

  const isEducatorScope = scope === "educator";
  const questionBankLabel = isEducatorScope ? "Educator Question Bank" : "Question Bank";
  const questionBankDescription = isEducatorScope
    ? "Your educator-scoped question bank. Bulk import, attach images, and reuse across your tests."
    : "Global admin question bank. Bulk import, attach images, and reuse across tests.";

  const questionBankCollection = useMemo(() => {
    if (isEducatorScope) {
      if (!educatorUid) return null;
      return collection(db, "educators", educatorUid, "question_bank");
    }
    return collection(db, "question_bank");
  }, [isEducatorScope, educatorUid]);

  const questionBankDoc = (id: string) => {
    if (isEducatorScope) {
      if (!educatorUid) return null;
      return doc(db, "educators", educatorUid, "question_bank", id);
    }
    return doc(db, "question_bank", id);
  };

  useEffect(() => {
    if (!questionBankCollection) {
      setItems([]);
      setLoading(false);
      return;
    }

    const qRef = query(questionBankCollection, orderBy("updatedAt", "desc"), limit(500));
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list: QBQuestion[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setItems(list);
        setLoading(false);
      },
      () => {
        setLoading(false);
        toast({
          title: "Failed to load question bank",
          description: "Please refresh and try again.",
          variant: "destructive",
        });
      }
    );
    return () => unsub();
  }, [questionBankCollection]);

  // Load subjects list for CSV subject matching
  useEffect(() => {
    getDocs(query(collection(db, "subjects"), orderBy("name"))).then((snap) => {
      setSubjects(snap.docs.map((d) => ({ id: d.id, name: d.data().name as string })));
    });
  }, []);

  // Educator scope: also subscribe to admin /question_bank so educators can browse admin questions
  useEffect(() => {
    if (!isEducatorScope) {
      setAdminItems([]);
      return;
    }
    const adminCol = collection(db, "question_bank");
    const qRef = query(adminCol, orderBy("updatedAt", "desc"), limit(500));
    const unsub = onSnapshot(qRef, (snap) => {
      setAdminItems(
        snap.docs.map((d) => ({
          id: `admin::${d.id}`,
          ...(d.data() as any),
          uploadedByRole: "admin",
        }))
      );
    });
    return () => unsub();
  }, [isEducatorScope]);

  // Merge own questions with admin questions (educator scope only)
  const allItems = useMemo(() => {
    if (!isEducatorScope) return items;
    return [...items, ...adminItems];
  }, [items, adminItems, isEducatorScope]);

  const courses = useMemo(() => {
    const s = new Set<string>();
    allItems.forEach((x) => x.course && s.add(x.course));
    return Array.from(s).sort();
  }, [allItems]);

  const topics = useMemo(() => {
    const s = new Set<string>();
    allItems.forEach((x) => x.topic && s.add(x.topic));
    return Array.from(s).sort();
  }, [allItems]);

  const filtered = useMemo(() => {
    const needle = qSearch.trim().toLowerCase();
    return allItems.filter((x) => {
      if (fCourse !== "all" && (x.course || "") !== fCourse) return false;
      if (fTopic !== "all" && (x.topic || "") !== fTopic) return false;
      if (fDifficulty !== "all" && (x.difficulty || "medium") !== fDifficulty) return false;

      if (!needle) return true;
      const hay = (x.searchText || x.question + " " + (x.options || []).join(" ")).toLowerCase();
      return hay.includes(needle);
    });
  }, [allItems, qSearch, fCourse, fTopic, fDifficulty]);

  const resetEditor = () => {
    setEditingId(null);
    setCourse("");
    setTopic("");
    setDifficulty("medium");
    setTags("");
    setQuestion("");
    setOptions(["", "", "", ""]);
    setCorrectOption(0);
    setExplanation("");
    setMarks(5);
    setNegativeMarks(-1);
    setQFormat("single_correct_mcq");
    setQSubjectId("");
    setTopicsInput("");
    setMultiCorrects([0]);
    setQImgUrl("");
    setOImgUrls(["", "", "", ""]);
    setEImgUrl("");
  };

  const openCreate = () => {
    resetEditor();
    setEditorOpen(true);
  };

  const openEdit = (x: QBQuestion) => {
    setEditingId(x.id);
    setCourse(x.course || "");
    setTopic(x.topic || "");
    setDifficulty(ensureDifficulty(x.difficulty));
    setTags((x.tags || []).join(", "));
    setQuestion(x.question || "");
    setOptions((x.options?.length ? x.options : ["", "", "", ""]).slice(0, 4).concat(["", "", "", ""]).slice(0, 4));
    setCorrectOption(Number.isFinite(x.correctOption) ? x.correctOption : 0);
    setExplanation(x.explanation || "");
    setMarks(typeof x.marks === "number" ? x.marks : 5);
    setNegativeMarks(typeof x.negativeMarks === "number" ? x.negativeMarks : -1);
    setQFormat(x.format || "single_correct_mcq");
    setQSubjectId(x.subjectId || "");
    setTopicsInput((x.topics?.length ? x.topics : x.topic ? [x.topic] : []).join(", "));
    setMultiCorrects(x.correctOptions?.length ? x.correctOptions : [x.correctOption ?? 0]);
    setQImgUrl(x.questionImage || "");
    setOImgUrls(x.optionImages?.length ? [...x.optionImages, "", "", "", ""].slice(0, 4) : ["", "", "", ""]);
    setEImgUrl(x.explanationImage || "");
    setEditorOpen(true);
  };

  const validate = () => {
    if (!stripHtml(question).trim()) {
      toast({ title: "Question required", description: "Please enter question text.", variant: "destructive" });
      return false;
    }
    const isMcq = qFormat === "single_correct_mcq" || qFormat === "multicorrect_mcq";
    if (isMcq) {
      const optClean = options.map((o) => stripHtml(o).trim());
      if (optClean.filter(Boolean).length < 2) {
        toast({ title: "Options required", description: "Please provide at least 2 options.", variant: "destructive" });
        return false;
      }
      if (qFormat === "single_correct_mcq" && (correctOption < 0 || correctOption >= options.length || !optClean[correctOption])) {
        toast({ title: "Correct option invalid", description: "Select a valid correct option.", variant: "destructive" });
        return false;
      }
      if (qFormat === "multicorrect_mcq" && multiCorrects.length === 0) {
        toast({ title: "Correct options required", description: "Select at least one correct option.", variant: "destructive" });
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setBusy(true);
    try {
      const isMcq = qFormat === "single_correct_mcq" || qFormat === "multicorrect_mcq";
      const topicsArr = topicsInput.split(",").map((s) => s.trim()).filter(Boolean);
      const matchedSubject = subjects.find((s) => s.id === qSubjectId);

      const base: Partial<QBQuestion> = {
        format: qFormat,
        difficulty,
        tags: normalizeTags(tags),
        question: sanitizeHtml(question),
        options: isMcq ? options.map((o) => sanitizeHtml(o)) : [],
        correctOption: qFormat === "single_correct_mcq" ? correctOption : (multiCorrects[0] ?? 0),
        explanation: sanitizeHtml(explanation || ""),
        marks: Number.isFinite(marks) ? marks : (isMcq ? 5 : 10),
        negativeMarks: Number.isFinite(negativeMarks) ? negativeMarks : (isMcq ? -1 : 0),
        source: "manual",
        contentFormat: "html",
        updatedAt: serverTimestamp() as any,
      };

      // Optional fields — omit if empty to avoid undefined in Firestore
      if (course.trim()) base.course = course.trim();
      if (topic.trim()) base.topic = topic.trim();
      if (topicsArr.length) base.topics = topicsArr;
      if (qSubjectId && matchedSubject) {
        base.subjectId = matchedSubject.id;
        base.subjectName = matchedSubject.name;
      }
      if (qFormat === "multicorrect_mcq") base.correctOptions = multiCorrects;
      if (qImgUrl.trim()) base.questionImage = qImgUrl.trim();
      if (oImgUrls.some(Boolean)) base.optionImages = oImgUrls;
      if (eImgUrl.trim()) base.explanationImage = eImgUrl.trim();

      base.searchText = [course, topicsArr.join(" "), stripHtml(question), stripHtml(options.join(" ")), stripHtml(explanation)]
        .join(" ")
        .toLowerCase()
        .slice(0, 5000);

      const payload = base;

      if (editingId) {
        const ref = questionBankDoc(editingId);
        if (!ref) throw new Error("Missing educator identity");
        await updateDoc(ref, payload as any);
        toast({ title: "Saved", description: "Question updated." });
      } else {
        payload.createdAt = serverTimestamp() as any;
        if (!questionBankCollection) throw new Error("Missing educator identity");
        const ref = await addDoc(questionBankCollection, payload as any);
        toast({ title: "Added", description: `Question added (${ref.id}).` });
      }

      setEditorOpen(false);
      resetEditor();
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: typeof e?.message === "string" ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = confirm("Delete this question from the question bank?");
    if (!ok) return;

    setBusy(true);
    try {
      const ref = questionBankDoc(id);
      if (!ref) throw new Error("Missing educator identity");
      await deleteDoc(ref);
      toast({ title: "Deleted", description: "Question removed from the bank." });
    } catch {
      toast({ title: "Delete failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const parseZip = async (file: File) => {
    const buf = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);

    const qKey = Object.keys(zip.files).find((k) => k.toLowerCase().endsWith("questions.json"));
    if (!qKey) throw new Error("questions.json not found in zip");

    const jsonText = await zip.files[qKey].async("string");
    const raw = JSON.parse(jsonText) as ZipQuestion[];
    if (!Array.isArray(raw)) throw new Error("questions.json must be an array");

    const imageMap = new Map<string, Blob>();
    for (const [name, f] of Object.entries(zip.files)) {
      if ((f as any).dir) continue;
      const lower = name.toLowerCase();
      if (!lower.match(/\.(png|jpg|jpeg|webp|gif)$/)) continue;
      const base = name.split("/").pop() || name;
      const blob = await (f as any).async("blob");
      imageMap.set(base, blob);
    }

    return { raw, imageMap };
  };

  const replaceImagesInHtml = async (
    html: string,
    imageMap: Map<string, Blob>,
    uploadedCache: Map<string, string>
  ) => {
    if (!html) return "";
    const imgSrcRe = /<img[^>]*\ssrc=["']([^"']+)["'][^>]*>/gi;

    let out = html;
    const matches = Array.from(html.matchAll(imgSrcRe));
    for (const m of matches) {
      const src = m[1] || "";

      // already hosted / already embedded — keep it
      if (src.startsWith("http") || src.startsWith("data:")) continue;

      const base = safeBaseNameFromSrc(src);
      if (!base) continue;

      // reuse already-uploaded URL for same file name
      const cached = uploadedCache.get(base);
      if (cached) {
        out = out.replaceAll(src, cached);
        continue;
      }

      const blob = imageMap.get(base);
      if (!blob) continue;

      const file = new File([blob], base, { type: blob.type || "image/png" });
      const url = await uploadQuestionImageToImageKit(file);

      uploadedCache.set(base, url);
      out = out.replaceAll(src, url);
    }
    return out;
  };

  const handleImport = async () => {
    if (!importFile) {
      toast({ title: "Pick a zip file", description: "Upload the provided questions zip.", variant: "destructive" });
      return;
    }

    setImporting(true);
    setImportProgress(0);
    setImportInfo(null);

    try {
      const { raw, imageMap } = await parseZip(importFile);
      setImportInfo({ total: raw.length, done: 0 });

      let batch = writeBatch(db);
      let ops = 0;
      let done = 0;

      const uploadedCache = new Map<string, string>();

      for (let i = 0; i < raw.length; i++) {
        const q = raw[i];
        const id = String(q.id || q._id || "").trim();
        if (!id) continue;

        const course = String(q.subject || "").trim() || "General";
        const topic = String((q as any)["spayee:objective"] || "").trim() || "General";
        const tags = normalizeTags(q.tag || []);
        // Always normalize to +5 marks and -1 negative marks
        const marks = 5;
        const negativeMarks = -1;

        const questionHtml = await replaceImagesInHtml(String(q.text || ""), imageMap, uploadedCache);

        const opts = Array.isArray(q.options?.option) ? q.options!.option! : [];
        const optionsHtml = await Promise.all(
          opts.slice(0, 4).map(async (o) =>
            replaceImagesInHtml(String(o?.content || ""), imageMap, uploadedCache)
          )
        );

        const corr = q.answer?.correctOptions?.option?.[0];
        const correctIdx = typeof corr === "number" ? Math.max(0, Math.min(3, corr - 1)) : 0;

        const explanationHtml = await replaceImagesInHtml(
          String(q.answer?.solution?.text || ""),
          imageMap,
          uploadedCache
        );
        const payload: Partial<QBQuestion> = {
          course,
          topic,
          difficulty: "medium",
          tags,
          question: sanitizeHtml(questionHtml),
          options: optionsHtml.map((o) => sanitizeHtml(o)),
          correctOption: correctIdx,
          explanation: sanitizeHtml(explanationHtml),
          marks,
          negativeMarks,
          source: "zip",
          searchText: (
            course +
            " " +
            topic +
            " " +
            (q.searchtext || "") +
            " " +
            stripHtml(questionHtml) +
            " " +
            stripHtml(optionsHtml.join(" ")) +
            " " +
            stripHtml(explanationHtml)
          )
            .toLowerCase()
            .slice(0, 5000),
          updatedAt: serverTimestamp() as any,
          createdAt: serverTimestamp() as any,
        };

        const ref = questionBankDoc(id);
        if (!ref) throw new Error("Missing educator identity");
        batch.set(ref, payload as any, { merge: true });
        ops++;

        if (ops >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          ops = 0;
        }

        done++;
        if (done % 10 === 0 || done === raw.length) {
          setImportProgress(Math.round((done / raw.length) * 100));
          setImportInfo({ total: raw.length, done });
        }
      }

      if (ops > 0) await batch.commit();

      toast({ title: "Import complete", description: "Questions added to Question Bank." });
      setImportOpen(false);
      setImportFile(null);
      setImportProgress(0);
      setImportInfo(null);
    } catch (e: any) {
      toast({
        title: "Import failed",
        description: typeof e?.message === "string" ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    try {
      if (!questionBankCollection) throw new Error("Missing educator identity");
      const qRef = query(questionBankCollection, orderBy("updatedAt", "desc"), limit(2000));
      const snap = await getDocs(qRef);
      const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `question_bank_export_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Export failed", description: "Please try again.", variant: "destructive" });
    }
  };

  function downloadCsvTemplate() {
    const headers = [
      "ques","ques_img","opt_1","opt_1_img","opt_2","opt_2_img","opt_3","opt_3_img","opt_4","opt_4_img",
      "correct_ans","soln","soln_img","topics","format","subject","difficulty","marks","negative_marks","course","tags",
    ];
    const rows = [
      [
        "Find the values of $x$ if $x^2 - 5x + 6 = 0$","",
        "$x = 2$","","$x = 3$","","$x = 4$","","$x = 1$","",
        "1,2",
        "Factoring: $(x-2)(x-3)=0$ gives roots $x=2$ and $x=3$.","",
        "Quadratic Equations","multicorrect_mcq","Mathematics","medium","5","-1","JEE","algebra",
      ],
      [
        "State Newton's second law of motion.","",
        "","","","","","","","",
        "","Net force equals $F = ma$ where $m$ is mass and $a$ is acceleration.","",
        "Laws of Motion","subjective_long","Physics","easy","10","0","NEET","",
      ],
    ];
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "question_bank_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCsvImport() {
    if (!csvFile) return;
    setCsvImporting(true);
    setCsvProgress(0);
    setCsvInfo(null);

    try {
      const text = await csvFile.text();
      const result = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      });

      const rows = result.data;
      const total = rows.length;
      let done = 0;
      let errors = 0;

      setCsvInfo({ total, done: 0, errors: 0 });

      let batch = writeBatch(db);
      let ops = 0;

      const targetCol = questionBankCollection;
      if (!targetCol) throw new Error("Missing educator identity");

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const ques = (row.ques || "").trim();
        const fmt = (row.format || "").trim().toLowerCase() as QBQuestion["format"];

        if (!ques || !fmt) { errors++; done++; continue; }

        const isMcq = fmt === "single_correct_mcq" || fmt === "multicorrect_mcq";
        const correctAnsRaw = (row.correct_ans || "").trim();
        if (isMcq && !correctAnsRaw) { errors++; done++; continue; }

        const correctAnswers = correctAnsRaw
          .split(",")
          .map((s) => parseInt(s.trim(), 10) - 1)
          .filter((n) => Number.isFinite(n) && n >= 0 && n <= 3);

        const subjectName = (row.subject || "").trim();
        const matchedSubject = subjects.find(
          (s) => s.name.toLowerCase() === subjectName.toLowerCase()
        );

        const topicsArr = (row.topics || "").split(",").map((s) => s.trim()).filter(Boolean);
        const tagsArr = (row.tags || "").split(",").map((s) => s.trim()).filter(Boolean);

        const defaultMarks = isMcq ? 5 : 10;
        const defaultNeg = isMcq ? -1 : 0;
        const marksVal = parseFloat(row.marks || "") || defaultMarks;
        const negMarksVal = parseFloat(row.negative_marks || "") || defaultNeg;

        const opts = [row.opt_1 || "", row.opt_2 || "", row.opt_3 || "", row.opt_4 || ""];
        const optImgs = [
          row.opt_1_img || "", row.opt_2_img || "", row.opt_3_img || "", row.opt_4_img || "",
        ];

        const courseVal = (row.course || "").trim();
        const searchText = [courseVal, subjectName, topicsArr.join(" "), ques, opts.join(" "), row.soln || ""]
          .join(" ")
          .toLowerCase()
          .slice(0, 5000);

        const payload: Partial<QBQuestion> & Record<string, any> = {
          question: ques,
          options: opts,
          correctOption: correctAnswers[0] ?? 0,
          explanation: (row.soln || "").trim(),
          format: fmt,
          contentFormat: "latex",
          difficulty: ensureDifficulty(row.difficulty),
          marks: marksVal,
          negativeMarks: negMarksVal,
          course: courseVal || undefined,
          topic: topicsArr[0] || undefined,
          topics: topicsArr.length ? topicsArr : undefined,
          tags: tagsArr.length ? tagsArr : undefined,
          subjectId: matchedSubject?.id || undefined,
          subjectName: matchedSubject?.name || subjectName || undefined,
          uploadedByRole: scope === "admin" ? "admin" : "educator",
          uploadedBy: educatorUid || undefined,
          source: "csv",
          searchText,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

        if (row.ques_img?.trim()) payload.questionImage = row.ques_img.trim();
        if (optImgs.some(Boolean)) payload.optionImages = optImgs;
        if (row.soln_img?.trim()) payload.explanationImage = row.soln_img.trim();
        if (fmt === "multicorrect_mcq" && correctAnswers.length > 1) {
          payload.correctOptions = correctAnswers;
        }

        // Firestore rejects undefined values — strip them before writing
        const cleanPayload = Object.fromEntries(
          Object.entries(payload).filter(([, v]) => v !== undefined)
        );

        const newRef = doc(targetCol);
        batch.set(newRef, cleanPayload);
        ops++;

        if (ops >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          ops = 0;
        }

        done++;
        if (done % 10 === 0 || done === total) {
          setCsvProgress(Math.round((done / total) * 100));
          setCsvInfo({ total, done, errors });
        }
      }

      if (ops > 0) await batch.commit();

      toast({
        title: "CSV import complete",
        description: `Imported ${done - errors} questions${errors ? `, ${errors} skipped (missing required fields)` : ""}.`,
      });
      setCsvOpen(false);
      setCsvFile(null);
      setCsvProgress(0);
      setCsvInfo(null);
    } catch (e: any) {
      toast({
        title: "CSV import failed",
        description: typeof e?.message === "string" ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setCsvImporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading question bank...
      </div>
    );
  }

  if (!questionBankCollection) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto p-1">
        <Card>
          <CardHeader>
            <CardTitle>Question Bank unavailable</CardTitle>
            <CardDescription>Unable to resolve educator identity for question bank path.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-1">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">{questionBankLabel}</h1>
          <p className="text-sm text-muted-foreground">{questionBankDescription}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { setImgUrl(""); setImgUploadOpen(true); }} disabled={busy}>
            <ImageIcon className="h-4 w-4 mr-2" />
            Upload Image
          </Button>
          <Button variant="outline" onClick={() => { setCsvFile(null); setCsvInfo(null); setCsvOpen(true); }} disabled={busy}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button onClick={openCreate} disabled={busy}>
            <Plus className="h-4 w-4 mr-2" />
            New Question
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Search & Filters</CardTitle>
          <CardDescription>Filter by course/topic/difficulty, then search inside question text.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={qSearch}
                onChange={(e) => setQSearch(e.target.value)}
                className="pl-9"
                placeholder="Search question text..."
              />
            </div>

            <div>
              <Select value={fCourse} onValueChange={setFCourse}>
                <SelectTrigger>
                  <SelectValue placeholder="Course" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All courses</SelectItem>
                  {courses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={fTopic} onValueChange={setFTopic}>
                <SelectTrigger>
                  <SelectValue placeholder="Topic" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All topics</SelectItem>
                  {topics.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={fDifficulty} onValueChange={setFDifficulty}>
                <SelectTrigger>
                  <SelectValue placeholder="Difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">{filtered.length}</span> / {allItems.length}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQSearch("");
                setFCourse("all");
                setFTopic("all");
                setFDifficulty("all");
              }}
            >
              Reset
            </Button>
          </div>

          <ScrollArea className="h-[520px] pr-2">
            <div className="space-y-3">
              {filtered.map((q) => (
                <motion.div key={q.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="rounded-xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          {q.uploadedByRole === "admin" && isEducatorScope && (
                            <Badge variant="default" className="text-xs">Admin</Badge>
                          )}
                          {q.course && <Badge variant="secondary">{q.course}</Badge>}
                          {q.topic && <Badge variant="outline">{q.topic}</Badge>}
                          <Badge className="capitalize" variant="outline">
                            {q.difficulty || "medium"}
                          </Badge>
                          {q.format && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {q.format.replace(/_/g, " ")}
                            </Badge>
                          )}
                        </div>

                        <QuestionRenderer
                          text={q.question || ""}
                          contentFormat={q.contentFormat}
                          className="line-clamp-3"
                        />

                        {q.questionImage && (
                          <img src={q.questionImage} alt="" className="mt-1 h-10 w-auto rounded border object-contain" />
                        )}

                        <div className="mt-2 text-xs text-muted-foreground">
                          {q.marks ?? 5} marks • {q.negativeMarks ?? -1} negative • {q.options?.length ?? 0} options
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!(isEducatorScope && q.uploadedByRole === "admin") && (
                          <>
                            <Button variant="outline" size="icon" onClick={() => openEdit(q)} disabled={busy}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="text-destructive"
                              onClick={() => handleDelete(q.id)}
                              disabled={busy}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}

              {filtered.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No questions found. Try changing filters.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={(v) => (v ? setEditorOpen(true) : (setEditorOpen(false), resetEditor()))}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Question" : "New Question"}</DialogTitle>
            <DialogDescription>
              Supports rich text + image paste. Images upload and get stored as URLs.
            </DialogDescription>
          </DialogHeader>

          {/* Row 1: Format + Course + Subject + Difficulty */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={qFormat} onValueChange={(v) => setQFormat(v as QBQuestion["format"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_correct_mcq">Single Correct MCQ</SelectItem>
                  <SelectItem value="multicorrect_mcq">Multi-Correct MCQ</SelectItem>
                  <SelectItem value="subjective">Subjective</SelectItem>
                  <SelectItem value="subjective_long">Subjective Long</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Course</Label>
              <Input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="e.g. JEE, NEET" />
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={qSubjectId || "__none"} onValueChange={(v) => setQSubjectId(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— None —</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(ensureDifficulty(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Topics + Tags + Marks */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Topics <span className="text-muted-foreground text-xs">(comma-separated)</span></Label>
              <Input value={topicsInput} onChange={(e) => setTopicsInput(e.target.value)} placeholder="e.g. Integral, Derivatives" />
            </div>
            <div className="space-y-2">
              <Label>Tags <span className="text-muted-foreground text-xs">(comma-separated)</span></Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. jee, calculus, 2024" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Marks</Label>
                <Input type="number" value={marks} onChange={(e) => setMarks(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Neg. Marks</Label>
                <Input type="number" value={negativeMarks} onChange={(e) => setNegativeMarks(Number(e.target.value))} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Question */}
          <RichHtmlEditor label="Question" value={question} onChange={setQuestion} placeholder="Type the question here..." />
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Question image URL <span className="text-muted-foreground">(optional — paste pre-uploaded URL)</span></Label>
            <Input value={qImgUrl} onChange={(e) => setQImgUrl(e.target.value)} placeholder="https://ik.imagekit.io/..." className="text-xs font-mono" />
            {qImgUrl && <img src={qImgUrl} alt="" className="h-16 w-auto rounded border object-contain" />}
          </div>

          <Separator />

          {/* Options (MCQ only) */}
          {(qFormat === "single_correct_mcq" || qFormat === "multicorrect_mcq") && (
            <div className="space-y-3">
              <Label>Options {qFormat === "multicorrect_mcq" && <span className="text-xs text-muted-foreground ml-1">(check all correct)</span>}</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {options.map((opt, idx) => (
                  <div key={idx} className="rounded-xl border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Option {String.fromCharCode(65 + idx)}</span>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={qFormat === "multicorrect_mcq" ? multiCorrects.includes(idx) : correctOption === idx}
                          onCheckedChange={(checked) => {
                            if (qFormat === "multicorrect_mcq") {
                              setMultiCorrects((prev) =>
                                checked ? [...prev, idx] : prev.filter((x) => x !== idx)
                              );
                            } else {
                              setCorrectOption(idx);
                            }
                          }}
                        />
                        <span className="text-xs text-muted-foreground">Correct</span>
                      </div>
                    </div>
                    <RichHtmlEditor
                      label=""
                      className="space-y-0"
                      value={opt}
                      onChange={(v) => setOptions((prev) => { const c = [...prev]; c[idx] = v; return c; })}
                      placeholder={`Option ${String.fromCharCode(65 + idx)}...`}
                    />
                    <Input
                      value={oImgUrls[idx]}
                      onChange={(e) => setOImgUrls((prev) => { const c = [...prev]; c[idx] = e.target.value; return c; })}
                      placeholder="Image URL (optional)"
                      className="text-xs font-mono"
                    />
                    {oImgUrls[idx] && <img src={oImgUrls[idx]} alt="" className="h-10 w-auto rounded border object-contain" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Explanation */}
          <RichHtmlEditor label="Explanation (optional)" value={explanation} onChange={setExplanation} placeholder="Explanation / solution..." />
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Explanation image URL <span className="text-muted-foreground">(optional)</span></Label>
            <Input value={eImgUrl} onChange={(e) => setEImgUrl(e.target.value)} placeholder="https://ik.imagekit.io/..." className="text-xs font-mono" />
            {eImgUrl && <img src={eImgUrl} alt="" className="h-16 w-auto rounded border object-contain" />}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setEditorOpen(false); resetEditor(); }} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={(v) => (v ? setImportOpen(true) : (setImportOpen(false), setImportFile(null)))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Import (Zip)</DialogTitle>
            <DialogDescription>
              Upload your zip containing <span className="font-medium">questions.json</span> and images. We upload images and
              store public URLs in Firestore.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Zip File</Label>
              <Input
                type="file"
                accept=".zip"
                disabled={importing}
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-muted-foreground">
                Dependency: <span className="font-mono">npm i jszip</span>
              </p>
            </div>

            {importing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Importing…</span>
                  <span>{importProgress}%</span>
                </div>
                <div className="h-2 rounded bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${importProgress}%` }} />
                </div>
                {importInfo && (
                  <div className="text-xs text-muted-foreground">
                    {importInfo.done} / {importInfo.total}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={!importFile || importing}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                Import
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={csvOpen} onOpenChange={(v) => { if (!v) { setCsvOpen(false); setCsvFile(null); setCsvInfo(null); } else setCsvOpen(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV with LaTeX-formatted questions. Use <span className="font-mono">$...$</span> for inline math and <span className="font-mono">$$...$$</span> for display math.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setCsvFile(f);
                  setCsvInfo(null);
                  if (csvInputRef.current) csvInputRef.current.value = "";
                }}
              />
              <Button variant="outline" className="flex-1" onClick={() => csvInputRef.current?.click()} disabled={csvImporting}>
                <Upload className="h-4 w-4 mr-2" />
                {csvFile ? csvFile.name : "Choose CSV file"}
              </Button>
              <Button variant="ghost" size="sm" onClick={downloadCsvTemplate} disabled={csvImporting}>
                <Download className="h-4 w-4 mr-1" />
                Template
              </Button>
            </div>

            {csvFile && !csvInfo && (
              <p className="text-sm text-muted-foreground">
                Ready to import: <span className="font-medium">{csvFile.name}</span>
              </p>
            )}

            {csvImporting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Importing…</span>
                  <span>{csvProgress}%</span>
                </div>
                <div className="h-2 rounded bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${csvProgress}%` }} />
                </div>
                {csvInfo && (
                  <div className="text-xs text-muted-foreground">
                    {csvInfo.done} / {csvInfo.total} processed • {csvInfo.errors} skipped
                  </div>
                )}
              </div>
            )}

            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Required columns:</p>
              <p className="font-mono">ques, format</p>
              <p className="font-medium">For MCQ also required:</p>
              <p className="font-mono">opt_1, opt_2, correct_ans</p>
              <p className="font-medium">Formats:</p>
              <p className="font-mono">single_correct_mcq · multicorrect_mcq · subjective · subjective_long</p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setCsvOpen(false)} disabled={csvImporting}>Cancel</Button>
              <Button onClick={handleCsvImport} disabled={!csvFile || csvImporting}>
                {csvImporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                Import
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Image for CSV */}
      <Dialog open={imgUploadOpen} onOpenChange={(v) => { setImgUploadOpen(v); if (!v) setImgUrl(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Upload Image</DialogTitle>
            <DialogDescription>Upload an image to ImageKit and copy the URL for use in bulk import CSVs.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            <Button variant="outline" className="w-full" onClick={() => imgInputRef.current?.click()} disabled={imgUploading}>
              {imgUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImageIcon className="h-4 w-4 mr-2" />}
              {imgUploading ? "Uploading…" : "Choose Image"}
            </Button>

            {imgUrl && (
              <div className="space-y-2">
                <img src={imgUrl} alt="uploaded" className="w-full rounded-md border object-contain max-h-48" />
                <div className="flex gap-2">
                  <Input value={imgUrl} readOnly className="font-mono text-xs flex-1" />
                  <Button size="icon" variant="outline" onClick={copyImgUrl}>
                    {imgCopied ? <Check className="h-4 w-4 text-green-600" /> : <ImageIcon className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {imgCopied ? "Copied!" : "Click icon to copy URL"}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
