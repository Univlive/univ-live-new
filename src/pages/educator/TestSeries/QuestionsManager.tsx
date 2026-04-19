import { useEffect, useMemo, useRef, useState } from "react";
import {
    ArrowLeft,
    GripVertical,
    Search,
    Plus,
    Trash2,
    Loader2,
    X,
    CheckCircle2,
    FileUp,
} from "lucide-react";

import {
    DndContext,
    PointerSensor,
    KeyboardSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import ReactCrop, {
    type Crop,
    type PercentCrop,
    type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

import AiQuestionImportOverlay from "@/components/educator/AiQuestionImportOverlay";
import ImageTextarea from "@/components/educator/ImageTextarea";
import InlineStatusTracker from "@/components/educator/InlineStatusTracker";
import {
    buildImportedQuestionPayload,
    formatNegativeMarksDisplay,
    importQuestionsFromPdf,
    type AiImportPreviewItem,
    type AiImportSummary,
    type PageProgressUpdate,
} from "@/lib/aiQuestionImport";
import { aiFeatureFlags, getAiFeatureDisabledMessage } from "@/lib/aiFeatureFlags";
import { HtmlView } from "@/lib/safeHtml";
import { uploadToImageKit } from "@/lib/imagekitUpload";

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

type EditorDraftSnapshot = {
    question: string;
    options: string[];
    correct: number;
    difficulty: Difficulty;
    subject: string;
    topic: string;
    marks: string;
    negativeMarks: string;
    active: boolean;
};

type PendingEditorAction =
    | { type: "close-manager" }
    | { type: "close-editor" }
    | { type: "open-new" }
    | { type: "open-edit"; question: TestQuestion };

type PreviewCropTarget =
    | { kind: "question"; imageIndex: number }
    | { kind: "option"; optionIndex: number; imageIndex: number };

function normalizeOptionsForSnapshot(options: string[] = []) {
    const normalized = options.slice(0, 6).map((value) => String(value ?? ""));
    while (normalized.length < 4) normalized.push("");
    return normalized;
}

function buildSnapshotFromQuestion(question?: TestQuestion): EditorDraftSnapshot {
    if (!question) {
        return {
            question: "",
            options: ["", "", "", ""],
            correct: 0,
            difficulty: "medium",
            subject: "",
            topic: "",
            marks: "",
            negativeMarks: "",
            active: true,
        };
    }

    const options = normalizeOptionsForSnapshot(question.options || []);
    const parsedCorrect = Number.isFinite(question.correctOption) ? question.correctOption : 0;

    return {
        question: question.question || "",
        options,
        correct: Math.min(Math.max(0, parsedCorrect), options.length - 1),
        difficulty: question.difficulty || "medium",
        subject: question.subject || "",
        topic: question.topic || "",
        marks: question.marks != null ? String(question.marks) : "",
        negativeMarks: question.negativeMarks != null ? String(question.negativeMarks) : "",
        active: isQuestionPublished(question.isActive),
    };
}

function areSnapshotsEqual(a: EditorDraftSnapshot, b: EditorDraftSnapshot) {
    if (a.question !== b.question) return false;
    if (a.correct !== b.correct) return false;
    if (a.difficulty !== b.difficulty) return false;
    if (a.subject !== b.subject) return false;
    if (a.topic !== b.topic) return false;
    if (a.marks !== b.marks) return false;
    if (a.negativeMarks !== b.negativeMarks) return false;
    if (a.active !== b.active) return false;
    if (a.options.length !== b.options.length) return false;
    for (let i = 0; i < a.options.length; i += 1) {
        if (a.options[i] !== b.options[i]) return false;
    }
    return true;
}

function stripHtml(input: string) {
    if (!input) return "";
    return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

const IMG_TAG_REGEX = /<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*\/?>/gi;

function splitPreviewContent(raw: string): { text: string; imageUrls: string[] } {
    if (!raw) return { text: "", imageUrls: [] };

    const imageUrls: string[] = [];
    let match: RegExpExecArray | null;
    const regex = new RegExp(IMG_TAG_REGEX.source, "gi");

    while ((match = regex.exec(raw)) !== null) {
        if (match[1]) imageUrls.push(match[1]);
    }

    const text = raw
        .replace(new RegExp(IMG_TAG_REGEX.source, "gi"), "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    return { text, imageUrls };
}

function hasPreviewContent(raw: string) {
    if (!raw) return false;
    const imageRegex = new RegExp(IMG_TAG_REGEX.source, "gi");
    if (imageRegex.test(raw)) return true;
    return raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().length > 0;
}

function combinePreviewContent(text: string, imageUrls: string[]) {
    if (imageUrls.length === 0) return text;
    const tags = imageUrls.map((url) => `<img src="${url}" alt="" />`).join("\n");
    if (!text) return tags;
    return text.endsWith("\n") ? `${text}${tags}` : `${text}\n${tags}`;
}

function isQuestionPublished(isActive?: boolean) {
    return isActive !== false;
}

function getPublishStatusLabel(isActive?: boolean) {
    return isQuestionPublished(isActive) ? "Published" : "Draft";
}

type SortableQuestionListItemProps = {
    q: TestQuestion;
    displayOrder: number;
    dragDisabled: boolean;
    onOpenEdit: (q: TestQuestion) => void;
    onDuplicate: (q: TestQuestion) => void;
    onDelete: (id: string) => void;
    onToggleActive: (q: TestQuestion, next: boolean) => void;
};

function SortableQuestionListItem({
    q,
    displayOrder,
    dragDisabled,
    onOpenEdit,
    onDuplicate,
    onDelete,
    onToggleActive,
}: SortableQuestionListItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: q.id,
        disabled: dragDisabled,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };
    const isPublished = isQuestionPublished(q.isActive);
    const publishLabel = getPublishStatusLabel(q.isActive);

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={() => onOpenEdit(q)}
            className={`p-3 rounded-xl border cursor-pointer text-sm hover:bg-gray-300/10 transition-colors bg-card ${isDragging ? "opacity-70" : ""}`}
        >
            <div className="flex items-start gap-2">

                {/* Drag Handle */}
                <Button
                    data-drag-handle
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg text-muted-foreground mt-0.5 cursor-grab active:cursor-grabbing shrink-0"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Drag to reorder"
                    {...attributes}
                    {...listeners}
                    disabled={dragDisabled}
                >
                    <GripVertical className="h-4 w-4" />
                </Button>

                {/* Content */}
                <div className="w-full min-w-0">

                    {/* Question + Delete */}
                    <div className="flex items-start gap-2">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 min-w-0">

                                {/* Q Number */}
                                <span className="text-muted-foreground shrink-0">
                                    Q{displayOrder}:
                                </span>

                                {/* Question */}
                                <div className="min-w-0 flex-1 overflow-hidden">
                                    {hasPreviewContent(q.question || "") ? (
                                        <HtmlView
                                            html={q.question || ""}
                                            className="text-sm line-clamp-1 break-words [&_p]:m-0 [&_img]:hidden"
                                        />
                                    ) : (
                                        <p className="text-sm text-muted-foreground truncate">
                                            (empty)
                                        </p>
                                    )}
                                </div>

                            </div>
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-xl text-destructive shrink-0"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(q.id);
                            }}
                            aria-label="Delete question"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Meta */}
                    <div className="mt-2 flex flex-wrap justify-between w-full gap-2">

                        <div className="flex gap-1.5 flex-wrap">
                            <Badge variant="secondary" className="text-[10px] rounded-full">
                                {(q.difficulty || "medium").toUpperCase()}
                            </Badge>

                            <Badge variant="outline" className="text-[10px] rounded-full">
                                +{q.marks ?? "-"} / {formatNegativeMarksDisplay(q.negativeMarks)}
                            </Badge>

                            {q.source === "ai_import" && (
                                <Badge variant="outline" className="text-[10px] rounded-full">AI</Badge>
                            )}

                            {q.source === "ai_import_partial" && (
                                <Badge variant="outline" className="text-[10px] rounded-full">AI Draft</Badge>
                            )}

                            {isPublished ? (
                                <Badge className="text-[10px] rounded-full">Published</Badge>
                            ) : (
                                <Badge variant="destructive" className="text-[10px] rounded-full">
                                    Draft
                                </Badge>
                            )}
                        </div>

                        <div
                            className="flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                        >
                            <Switch
                                checked={isPublished}
                                onCheckedChange={(checked) => onToggleActive(q, checked)}
                            />
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}

const QuestionsManager = ({
    testId,
    testTitle,
    testSubject,
    educatorUid,
    onClose,
    mode = "modal",
}: {
    testId: string;
    testTitle?: string;
    testSubject?: string;
    educatorUid: string;
    onClose: () => void;
    mode?: "modal" | "page";
}) => {
    const isPageMode = mode === "page";
    const [questions, setQuestions] = useState<TestQuestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [reordering, setReordering] = useState(false);

    const [searchQ, setSearchQ] = useState("");
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [formQuestion, setFormQuestion] = useState("");
    const [formOptions, setFormOptions] = useState<string[]>(["", "", "", ""]);
    const [formCorrect, setFormCorrect] = useState(0);
    const [formDifficulty, setFormDifficulty] = useState<Difficulty>("medium");
    const [formSubject, setFormSubject] = useState("");
    const [formTopic, setFormTopic] = useState("");
    const [formMarks, setFormMarks] = useState("");
    const [formNegMarks, setFormNegMarks] = useState("");
    const [formActive, setFormActive] = useState(true);
    const [editorSnapshot, setEditorSnapshot] = useState<EditorDraftSnapshot | null>(null);
    const [unsavedConfirmOpen, setUnsavedConfirmOpen] = useState(false);
    const [pendingEditorAction, setPendingEditorAction] = useState<PendingEditorAction | null>(null);
    const [previewCropOpen, setPreviewCropOpen] = useState(false);
    const [previewCropTargetUrl, setPreviewCropTargetUrl] = useState<string | null>(null);
    const [previewCropTarget, setPreviewCropTarget] = useState<PreviewCropTarget | null>(null);
    const [previewCropSelection, setPreviewCropSelection] = useState<Crop>({
        unit: "%",
        x: 10,
        y: 10,
        width: 80,
        height: 80,
    });
    const [previewCropPixels, setPreviewCropPixels] = useState<PixelCrop | null>(null);
    const [previewCropping, setPreviewCropping] = useState(false);
    const previewCropImageRef = useRef<HTMLImageElement | null>(null);

    const [saving, setSaving] = useState(false);

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
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 6 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const qCol = useMemo(
        () => collection(db, "educators", educatorUid, "my_tests", testId, "questions"),
        [educatorUid, testId]
    );

    async function syncTestQuestionCount() {
        try {
            const snap = await getDocs(qCol);
            let activeCount = 0;
            snap.forEach((item) => {
                if (isQuestionPublished(item.data()?.isActive)) activeCount += 1;
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

    useEffect(() => {
        if (!editingId) return;
        const current = questions.find((q) => q.id === editingId);
        if (!current) return;
        setFormActive(isQuestionPublished(current.isActive));
    }, [editingId, questions]);

    const filteredQuestions = useMemo(() => {
        const q = searchQ.trim().toLowerCase();
        if (!q) return questions;
        return questions.filter((row) => {
            const hay = `${stripHtml(row.question)} ${stripHtml(row.explanation || "")} ${row.subject || ""} ${row.topic || ""}`.toLowerCase();
            return hay.includes(q);
        });
    }, [questions, searchQ]);

    const previewOptions = useMemo(
        () =>
            formOptions
                .map((option, index) => ({ index, option }))
                .filter(({ option }) => hasPreviewContent(option || "")),
        [formOptions]
    );

    const questionPreviewParts = useMemo(() => splitPreviewContent(formQuestion || ""), [formQuestion]);

    const currentEditorSnapshot = useMemo<EditorDraftSnapshot>(
        () => ({
            question: formQuestion,
            options: normalizeOptionsForSnapshot(formOptions),
            correct: Number(formCorrect) || 0,
            difficulty: formDifficulty || "medium",
            subject: formSubject || "",
            topic: formTopic || "",
            marks: formMarks,
            negativeMarks: formNegMarks,
            active: !!formActive,
        }),
        [formQuestion, formOptions, formCorrect, formDifficulty, formSubject, formTopic, formMarks, formNegMarks, formActive]
    );

    const hasUnsavedQuestionChanges = useMemo(() => {
        if (!editorOpen || !editorSnapshot) return false;
        return !areSnapshotsEqual(editorSnapshot, currentEditorSnapshot);
    }, [editorOpen, editorSnapshot, currentEditorSnapshot]);

    const dndEnabled = searchQ.trim().length === 0;

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

    async function persistDraggedOrder(reordered: TestQuestion[]) {
        try {
            setReordering(true);

            const updates = reordered
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
        } catch (e) {
            console.error(e);
            toast.error("Failed to save question order");
        } finally {
            setReordering(false);
        }
    }

    async function handleDragEnd(event: DragEndEvent) {
        if (!dndEnabled || reordering) return;

        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = questions.findIndex((q) => q.id === String(active.id));
        const newIndex = questions.findIndex((q) => q.id === String(over.id));
        if (oldIndex < 0 || newIndex < 0) return;

        const reordered = arrayMove(questions, oldIndex, newIndex).map((q, index) => ({
            ...q,
            questionOrder: index + 1,
        }));

        setQuestions(reordered);
        await persistDraggedOrder(reordered);
    }

    function resetEditor() {
        setEditingId(null);
        setFormQuestion("");
        setFormOptions(["", "", "", ""]);
        setFormCorrect(0);
        setFormDifficulty("medium");
        setFormSubject("");
        setFormTopic("");
        setFormMarks("");
        setFormNegMarks("");
        setFormActive(true);
        setEditorSnapshot(null);
    }

    function addOptionField() {
        setFormOptions((prev) => (prev.length >= 6 ? prev : [...prev, ""]));
    }

    function removeOptionField(index: number) {
        setFormOptions((prev) => {
            if (prev.length <= 2) return prev;
            const next = prev.filter((_, i) => i !== index);
            setFormCorrect((current) => {
                if (current === index) return 0;
                if (current > index) return current - 1;
                return Math.min(current, next.length - 1);
            });
            return next;
        });
    }

    function openNewDirect() {
        resetEditor();
        setEditorSnapshot(buildSnapshotFromQuestion());
        setEditorOpen(true);
    }

    function openEditDirect(q: TestQuestion) {
        setEditingId(q.id);
        setFormQuestion(q.question || "");
        const existingOptions = normalizeOptionsForSnapshot(q.options || []);
        setFormOptions(existingOptions);
        const parsedCorrect = Number.isFinite(q.correctOption) ? q.correctOption : 0;
        setFormCorrect(Math.min(Math.max(0, parsedCorrect), existingOptions.length - 1));
        setFormDifficulty(q.difficulty || "medium");
        setFormSubject(q.subject || "");
        setFormTopic(q.topic || "");
        setFormMarks(q.marks != null ? String(q.marks) : "");
        setFormNegMarks(q.negativeMarks != null ? String(q.negativeMarks) : "");
        setFormActive(isQuestionPublished(q.isActive));
        setEditorSnapshot(buildSnapshotFromQuestion(q));
        setEditorOpen(true);
    }

    function runEditorAction(action: PendingEditorAction) {
        if (action.type === "close-manager") {
            onClose();
            return;
        }
        if (action.type === "close-editor") {
            setEditorOpen(false);
            resetEditor();
            return;
        }
        if (action.type === "open-new") {
            openNewDirect();
            return;
        }
        if (action.type === "open-edit") {
            openEditDirect(action.question);
        }
    }

    function requestEditorAction(action: PendingEditorAction) {
        if (editorOpen && hasUnsavedQuestionChanges) {
            setPendingEditorAction(action);
            setUnsavedConfirmOpen(true);
            return;
        }
        runEditorAction(action);
    }

    function openNew() {
        requestEditorAction({ type: "open-new" });
    }

    function openEdit(q: TestQuestion) {
        requestEditorAction({ type: "open-edit", question: q });
    }

    function requestCloseEditor() {
        requestEditorAction({ type: "close-editor" });
    }

    function requestCloseManager() {
        requestEditorAction({ type: "close-manager" });
    }

    function openPreviewCrop(target: PreviewCropTarget, imageUrl: string) {
        setPreviewCropTarget(target);
        setPreviewCropTargetUrl(imageUrl);
        setPreviewCropSelection({ unit: "%", x: 10, y: 10, width: 80, height: 80 });
        setPreviewCropPixels(null);
        setPreviewCropOpen(true);
    }

    function closePreviewCrop() {
        setPreviewCropOpen(false);
        setPreviewCropTarget(null);
        setPreviewCropTargetUrl(null);
        setPreviewCropPixels(null);
    }

    function handleQuestionPreviewImageClick(event: React.MouseEvent<HTMLDivElement>) {
        const target = event.target as HTMLElement;
        if (!target || target.tagName !== "IMG") return;
        const src = (target as HTMLImageElement).getAttribute("src") || "";
        if (!src) return;

        const imageIndex = questionPreviewParts.imageUrls.indexOf(src);
        if (imageIndex < 0) return;

        openPreviewCrop({ kind: "question", imageIndex }, src);
    }

    function handleOptionPreviewImageClick(optionIndex: number, optionRaw: string, event: React.MouseEvent<HTMLDivElement>) {
        const target = event.target as HTMLElement;
        if (!target || target.tagName !== "IMG") return;
        const src = (target as HTMLImageElement).getAttribute("src") || "";
        if (!src) return;

        const optionParts = splitPreviewContent(optionRaw || "");
        const imageIndex = optionParts.imageUrls.indexOf(src);
        if (imageIndex < 0) return;

        openPreviewCrop({ kind: "option", optionIndex, imageIndex }, src);
    }

    async function createPreviewCroppedBlob(image: HTMLImageElement, pixelCrop: PixelCrop): Promise<Blob> {
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;

        const outWidth = Math.max(1, Math.floor(pixelCrop.width * scaleX));
        const outHeight = Math.max(1, Math.floor(pixelCrop.height * scaleY));

        const canvas = document.createElement("canvas");
        canvas.width = outWidth;
        canvas.height = outHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create crop canvas");

        ctx.drawImage(
            image,
            pixelCrop.x * scaleX,
            pixelCrop.y * scaleY,
            pixelCrop.width * scaleX,
            pixelCrop.height * scaleY,
            0,
            0,
            outWidth,
            outHeight
        );

        const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((output) => resolve(output), "image/png", 1);
        });

        if (!blob) throw new Error("Failed to generate cropped image");
        return blob;
    }

    async function applyPreviewCrop() {
        if (!previewCropTarget || !previewCropTargetUrl || !previewCropPixels || !previewCropImageRef.current) {
            toast.error("Select a crop area first");
            return;
        }

        setPreviewCropping(true);
        try {
            const croppedBlob = await createPreviewCroppedBlob(previewCropImageRef.current, previewCropPixels);
            const folder = previewCropTarget.kind === "question" ? "/test-questions" : "/test-options";
            const fileName = `preview-crop-${Date.now()}.png`;
            const { url } = await uploadToImageKit(croppedBlob, fileName, folder, "website");

            if (previewCropTarget.kind === "question") {
                const current = splitPreviewContent(formQuestion || "");
                if (previewCropTarget.imageIndex < 0 || previewCropTarget.imageIndex >= current.imageUrls.length) {
                    closePreviewCrop();
                    return;
                }
                const nextUrls = [...current.imageUrls];
                nextUrls[previewCropTarget.imageIndex] = url;
                setFormQuestion(combinePreviewContent(current.text, nextUrls));
            } else {
                const optionValue = formOptions[previewCropTarget.optionIndex] || "";
                const current = splitPreviewContent(optionValue);
                if (previewCropTarget.imageIndex < 0 || previewCropTarget.imageIndex >= current.imageUrls.length) {
                    closePreviewCrop();
                    return;
                }
                const nextUrls = [...current.imageUrls];
                nextUrls[previewCropTarget.imageIndex] = url;
                const nextValue = combinePreviewContent(current.text, nextUrls);
                setFormOptions((prev) => prev.map((opt, i) => (i === previewCropTarget.optionIndex ? nextValue : opt)));
            }

            toast.success("Image cropped");
            closePreviewCrop();
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Image crop failed";
            console.error("[QuestionsManager preview crop error]", msg);
            toast.error(msg);
        } finally {
            setPreviewCropping(false);
        }
    }

    async function saveQuestion(): Promise<boolean> {
        if (saving) return false;

        const trimmedQuestion = formQuestion.trim();
        const normalizedOptions = formOptions.slice(0, 6).map((value) => value ?? "");
        const nonEmptyOptions = normalizedOptions.filter((value) => value.trim() !== "");

        if (!trimmedQuestion) {
            toast.error("Question is required");
            return false;
        }
        if (nonEmptyOptions.length < 2) {
            toast.error("At least two options are required");
            return false;
        }
        if (!normalizedOptions[formCorrect] || normalizedOptions[formCorrect].trim() === "") {
            toast.error("Correct option cannot be empty");
            return false;
        }

        const payload: any = {
            question: formQuestion,
            options: normalizedOptions,
            correctOption: Number(formCorrect) || 0,
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
            return true;
        } catch (e) {
            console.error(e);
            toast.error("Save failed");
            return false;
        } finally {
            setSaving(false);
        }
    }

    async function handleSaveAndContinue() {
        if (!pendingEditorAction) {
            setUnsavedConfirmOpen(false);
            return;
        }

        const actionToRun = pendingEditorAction;
        const saved = await saveQuestion();
        if (!saved) return;

        setUnsavedConfirmOpen(false);
        setPendingEditorAction(null);
        runEditorAction(actionToRun);
    }

    function handleExitWithoutSaving() {
        if (!pendingEditorAction) {
            setUnsavedConfirmOpen(false);
            return;
        }
        const actionToRun = pendingEditorAction;
        setUnsavedConfirmOpen(false);
        setPendingEditorAction(null);
        runEditorAction(actionToRun);
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
                isActive: isQuestionPublished(q.isActive),
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

    async function updateQuestionPublishState(questionId: string, next: boolean, previous: boolean, showToast = true) {
        setQuestions((prev) => prev.map((item) => (item.id === questionId ? { ...item, isActive: next } : item)));
        if (editingId === questionId) setFormActive(next);

        try {
            await updateDoc(doc(qCol, questionId), { isActive: next, updatedAt: serverTimestamp() });
            await syncTestQuestionCount();
            if (showToast) {
                toast.success(next ? "Question published" : "Question moved to draft");
            }
        } catch (e) {
            setQuestions((prev) => prev.map((item) => (item.id === questionId ? { ...item, isActive: previous } : item)));
            if (editingId === questionId) setFormActive(previous);
            console.error(e);
            toast.error("Failed to update publish status");
        }
    }

    async function toggleActive(q: TestQuestion, next: boolean) {
        const previous = isQuestionPublished(q.isActive);
        await updateQuestionPublishState(q.id, next, previous, true);
    }

    function handleEditorPublishChange(next: boolean) {
        const previous = formActive;
        setFormActive(next);

        if (!editingId) return;
        void updateQuestionPublishState(editingId, next, previous, false);
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
                        include: item.status !== "rejected",
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

    function updateImportItemContent(
        sourceIndex: number,
        patch: Partial<Pick<AiImportPreviewItem, "question" | "options" | "correctOption">>
    ) {
        setImportItems((prev) =>
            prev.map((item) => {
                if (item.sourceIndex !== sourceIndex) return item;

                const nextQuestion =
                    typeof patch.question === "string" ? patch.question : item.question;
                const nextOptions = Array.isArray(patch.options)
                    ? patch.options.map((value) => String(value ?? ""))
                    : item.options;

                let nextCorrectOption =
                    patch.correctOption !== undefined ? patch.correctOption : item.correctOption;

                if (
                    typeof nextCorrectOption === "number" &&
                    (nextCorrectOption < 0 || nextCorrectOption >= nextOptions.length)
                ) {
                    nextCorrectOption = nextOptions.length ? 0 : null;
                }

                return {
                    ...item,
                    question: nextQuestion,
                    options: nextOptions,
                    correctOption: nextCorrectOption,
                    manualEdited: true,
                };
            })
        );
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
            isActive: isQuestionPublished(data?.isActive),
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
        <div className={isPageMode ? "w-full bg-gradient-to-b from-background to-muted/10" : "fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm"}>
            <div
                className={
                    isPageMode
                        ? "relative bg-background w-full h-[calc(100vh-8rem)] flex flex-col overflow-hidden"
                        : "relative bg-background w-full max-w-6xl h-[92vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl"
                }
            >
                <div className="p-4 border-b flex items-center justify-between">
                    <div className="min-w-0">
                        <h2 className="font-bold text-lg">Manage Questions</h2>
                        <p className="text-xs text-muted-foreground">
                            Add questions manually or import them from a PDF with AI. Saved questions stay in the same Firestore path.
                        </p>
                    </div>
                    {isPageMode ? (
                        <Button variant="outline" onClick={requestCloseManager} className="rounded-xl">
                            <ArrowLeft className="h-4 w-4 mr-2" /> Back
                        </Button>
                    ) : (
                        <Button variant="ghost" size="icon" onClick={requestCloseManager} className="rounded-xl">
                            <X className="h-5 w-5" />
                        </Button>
                    )}
                </div>

                <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
                    <div className="order-1 flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
                        <div className="p-6 lg:p-8">
                            <div className="max-w-4xl mx-auto space-y-5">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <h3 className="text-lg font-semibold">
                                            {editingId ? "Edit Question" : "Question Workspace"}
                                        </h3>
                                        <p className="text-xs text-muted-foreground">
                                            Basic text editor for quick question entry.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" className="rounded-xl" onClick={openNew}>
                                            <Plus className="h-4 w-4 mr-2" /> New
                                        </Button>
                                        {editorOpen ? (
                                            <Button
                                                variant="outline"
                                                className="rounded-xl"
                                                onClick={requestCloseEditor}
                                            >
                                                Cancel
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>

                                {!editorOpen ? (
                                    <div className="rounded-2xl border border-dashed border-border bg-muted/15 px-6 py-12 text-center">
                                        <p className="text-base font-medium">Select a question from the list or create a new one</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Compose questions with plain text and keep editing simple.
                                        </p>
                                        <Button className="rounded-xl mt-4" onClick={openNew}>
                                            <Plus className="h-4 w-4 mr-2" /> Start Writing
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-5">
                                            <div className="space-y-2">
                                                <Label>Question Content</Label>
                                                <ImageTextarea
                                                    value={formQuestion}
                                                    onChange={setFormQuestion}
                                                    folder="/test-questions"
                                                    placeholder="Type your question here..."
                                                    minHeight="140px"
                                                    className="rounded-xl"
                                                />
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <Label>Answers</Label>
                                                    <span className="text-xs text-muted-foreground">{formOptions.length} / 6 options</span>
                                                </div>

                                                <div className="space-y-3">
                                                    {formOptions.map((opt, idx) => (
                                                        <div key={idx} className="space-y-2">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <Label>
                                                                    Choice {String.fromCharCode(65 + idx)}
                                                                    {formCorrect === idx ? <span className="ml-2 text-green-600 inline-flex items-center gap-1 text-xs"><CheckCircle2 className="h-3 w-3" /> Correct</span> : null}
                                                                </Label>
                                                                {formOptions.length > 2 ? (
                                                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive" onClick={() => removeOptionField(idx)}>
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                ) : null}
                                                            </div>
                                                            <ImageTextarea
                                                                value={opt || ""}
                                                                onChange={(value) => {
                                                                    setFormOptions((prev) => prev.map((x, i) => (i === idx ? value : x)));
                                                                }}
                                                                folder="/test-options"
                                                                placeholder={`Type choice ${String.fromCharCode(65 + idx)}...`}
                                                                minHeight="50px"
                                                                className="rounded-xl"
                                                                hideControls
                                                            />
                                                        </div>
                                                    ))}
                                                </div>

                                                <Button type="button" variant="outline" className="rounded-xl" onClick={addOptionField} disabled={formOptions.length >= 6}>
                                                    <Plus className="h-4 w-4 mr-2" /> Add Option
                                                </Button>
                                            </div>

                                            <div className="space-y-4 rounded-xl border border-border bg-muted/15 p-4">
                                                <p className="text-sm font-semibold">Question Settings</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                    <div className="space-y-2">
                                                        <Label>Mark as Correct Option</Label>
                                                        <Select value={String(formCorrect)} onValueChange={(v) => setFormCorrect(Number(v))}>
                                                            <SelectTrigger className="rounded-xl">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {formOptions.map((_, i) => (
                                                                    <SelectItem key={i} value={String(i)}>
                                                                        Choice {String.fromCharCode(65 + i)}
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

                                                    <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border mt-0 sm:mt-6">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium">{getPublishStatusLabel(formActive)}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {formActive ? "Visible in published list" : "Saved as draft until published"}
                                                            </p>
                                                        </div>
                                                        <Switch checked={formActive} onCheckedChange={handleEditorPublishChange} />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {/* <div className="space-y-2">
                                                        <Label>Subject</Label>
                                                        <Input value={formSubject} onChange={(e) => setFormSubject(e.target.value)} className="rounded-xl" placeholder="e.g. Physics" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Topic</Label>
                                                        <Input value={formTopic} onChange={(e) => setFormTopic(e.target.value)} className="rounded-xl" placeholder="e.g. Kinematics" />
                                                    </div> */}
                                                    <div className="space-y-2">
                                                        <Label>Marks</Label>
                                                        <Input value={formMarks} onChange={(e) => setFormMarks(e.target.value)} className="rounded-xl" placeholder="e.g. 5" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Negative Marks</Label>
                                                        <Input value={formNegMarks} onChange={(e) => setFormNegMarks(e.target.value)} className="rounded-xl" placeholder="e.g. -1" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-border bg-muted/20 p-3">
                                            <p className="text-xs font-medium text-muted-foreground mb-2">Question Preview</p>
                                            {hasPreviewContent(formQuestion) ? (
                                                <div className="space-y-3">
                                                    <div className="rounded-lg border border-border/60 bg-background p-3" onClick={handleQuestionPreviewImageClick}>
                                                        <HtmlView html={formQuestion} className="text-sm break-words [&_img]:cursor-pointer" />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <p className="text-xs font-medium text-muted-foreground">Options Preview</p>
                                                        {previewOptions.length ? (
                                                            previewOptions.map(({ index, option }) => (
                                                                <div key={index} className="rounded-lg border border-border/60 bg-background p-3" onClick={(event) => handleOptionPreviewImageClick(index, option, event)}>
                                                                    <div className="flex items-start gap-2">
                                                                        <span className="text-xs font-semibold text-muted-foreground mt-1">
                                                                            {String.fromCharCode(65 + index)}.
                                                                        </span>
                                                                        <HtmlView html={option} className="text-sm break-words flex-1 [&_img]:cursor-pointer" />
                                                                        {formCorrect === index ? (
                                                                            <Badge className="rounded-full text-[10px]">Correct</Badge>
                                                                        ) : null}
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <p className="text-sm text-muted-foreground">Add options to preview formatted answers.</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-muted-foreground">Start typing to preview question content.</p>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-end">
                                            <Button className="rounded-xl min-w-[160px]" disabled={saving} onClick={saveQuestion}>
                                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? "Update Question" : "Save Question"}
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="order-2 w-full md:w-[380px] min-h-0 border-t md:border-t-0 md:border-l flex flex-col bg-muted/10 shrink-0">


                        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain p-4 space-y-3">
                            <div className="p-4 border-b space-y-3 ">
                                <div>
                                    <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Questions List</p>
                                </div>
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
                            <div className="flex items-center justify-between text-xs text-muted-foreground pb-1">
                                <span>{dndEnabled ? "Drag with handle to reorder" : "Clear search to reorder questions"}</span>
                                {reordering ? (
                                    <span className="inline-flex items-center gap-1">
                                        <Loader2 className="h-3 w-3 animate-spin" /> Saving order...
                                    </span>
                                ) : null}
                            </div>
                            {loading ? (
                                <div className="flex justify-center py-6">
                                    <Loader2 className="animate-spin text-muted-foreground" />
                                </div>
                            ) : filteredQuestions.length === 0 ? (
                                <p className="text-center text-sm text-muted-foreground py-10">No questions yet.</p>
                            ) : dndEnabled ? (
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                    <SortableContext items={filteredQuestions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                                        {filteredQuestions.map((q) => (
                                            <SortableQuestionListItem
                                                key={q.id}
                                                q={q}
                                                displayOrder={questionNumberById.get(q.id) ?? 0}
                                                dragDisabled={!dndEnabled || reordering}
                                                onOpenEdit={openEdit}
                                                onDuplicate={duplicateQuestion}
                                                onDelete={deleteQuestion}
                                                onToggleActive={toggleActive}
                                            />
                                        ))}
                                    </SortableContext>
                                </DndContext>
                            ) : (
                                filteredQuestions.map((q) => (
                                    <SortableQuestionListItem
                                        key={q.id}
                                        q={q}
                                        displayOrder={questionNumberById.get(q.id) ?? 0}
                                        dragDisabled={true}
                                        onOpenEdit={openEdit}
                                        onDuplicate={duplicateQuestion}
                                        onDelete={deleteQuestion}
                                        onToggleActive={toggleActive}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* <div className="p-3 border-t bg-muted/20 text-xs text-muted-foreground flex items-center justify-end">
                    <span className="flex items-center gap-2">
                        <FileUp className="h-4 w-4" />
                        Manual + AI PDF Import
                    </span>
                </div> */}

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
                    onItemEdit={updateImportItemContent}
                    onSelectAll={selectAllImportItems}
                    onSelectOnlyReady={selectOnlyReadyImportItems}
                    onSelectOnlyPartial={selectOnlyPartialImportItems}
                    onSelectOnlyRejected={selectOnlyRejectedImportItems}
                    onSaveSelected={saveImportedQuestions}
                />

                <Dialog
                    open={previewCropOpen}
                    onOpenChange={(open) => {
                        if (!open && !previewCropping) closePreviewCrop();
                    }}
                >
                    <DialogContent className="sm:max-w-3xl rounded-2xl">
                        <DialogHeader>
                            <DialogTitle>Crop Preview Image</DialogTitle>
                            <DialogDescription>
                                Click on an image in preview and crop the exact region to keep.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="rounded-xl border bg-black/70 p-2 max-h-[68vh] overflow-auto">
                            {previewCropTargetUrl ? (
                                <ReactCrop
                                    crop={previewCropSelection}
                                    onChange={(_px: PixelCrop, percentCrop: PercentCrop) =>
                                        setPreviewCropSelection(percentCrop)
                                    }
                                    onComplete={(pixelCrop) => setPreviewCropPixels(pixelCrop)}
                                    keepSelection
                                    minWidth={20}
                                    minHeight={20}
                                >
                                    <img
                                        ref={previewCropImageRef}
                                        src={previewCropTargetUrl}
                                        alt="Preview crop"
                                        crossOrigin="anonymous"
                                        className="max-h-[60vh] w-auto mx-auto"
                                    />
                                </ReactCrop>
                            ) : (
                                <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                                    No image selected
                                </div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={closePreviewCrop}
                                disabled={previewCropping}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={applyPreviewCrop}
                                disabled={previewCropping || !previewCropPixels || previewCropPixels.width < 2 || previewCropPixels.height < 2}
                            >
                                {previewCropping ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply Crop"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={unsavedConfirmOpen}
                    onOpenChange={(open) => {
                        if (!open) {
                            setUnsavedConfirmOpen(false);
                            setPendingEditorAction(null);
                        }
                    }}
                >
                    <DialogContent className="rounded-2xl">
                        <DialogHeader>
                            <DialogTitle>Save Question Changes?</DialogTitle>
                            <DialogDescription>
                                You made changes in this question. Do you want to save and update before exiting?
                            </DialogDescription>
                        </DialogHeader>

                        <DialogFooter>
                            <Button variant="outline" onClick={handleExitWithoutSaving}>
                                No, Exit
                            </Button>
                            <Button onClick={handleSaveAndContinue} disabled={saving}>
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, Save Changes"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

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