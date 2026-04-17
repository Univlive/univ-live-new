import { useEffect, useMemo, useRef, useState } from "react";
import {
    Search,
    Plus,
    Trash2,
    Loader2,
    X,
    Copy,
    Image as ImageIcon,
    CheckCircle2,
    FileUp,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

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

// Firebase
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    onSnapshot,
    serverTimestamp,
    updateDoc,
    writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ------------------------------
// Sub-component: Educator Questions Manager (manual only)
// Works for both imported admin tests and educator custom tests.
// IMPORTANT: No question-bank import here.
// ------------------------------

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

const QuestionsManager = ({
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
}) => {
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

export default QuestionsManager;