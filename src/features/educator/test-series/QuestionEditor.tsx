import type { Dispatch, MouseEvent, SetStateAction } from "react";
import { Plus, Trash2, Loader2, CheckCircle2 } from "lucide-react";

import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { Badge } from "@shared/ui/badge";
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Switch } from "@shared/ui/switch";

import ImageTextarea from "@features/educator/components/ImageTextarea";
import { HtmlView } from "@shared/lib/safeHtml";

type QuestionEditorSection = {
    id: string;
    name: string;
};

type PreviewOption = {
    index: number;
    option: string;
};

type QuestionEditorProps = {
    editingId: string | null;
    readOnly: boolean;
    editorOpen: boolean;
    inlineMode?: boolean;
    openNew: () => void;
    requestCloseEditor: () => void;
    formQuestion: string;
    setFormQuestion: (value: string) => void;
    formOptions: string[];
    setFormOptions: Dispatch<SetStateAction<string[]>>;
    formCorrect: number;
    setFormCorrect: (value: number) => void;
    formDifficulty: string;
    setFormDifficulty: (value: string) => void;
    formSectionId: string;
    setFormSectionId: (value: string) => void;
    managedSections: QuestionEditorSection[];
    formMarks: string;
    setFormMarks: (value: string) => void;
    formNegMarks: string;
    setFormNegMarks: (value: string) => void;
    formActive: boolean;
    handleEditorPublishChange: (value: boolean) => void;
    removeOptionField: (index: number) => void;
    addOptionField: () => void;
    handleQuestionPreviewImageClick: (event: MouseEvent<HTMLDivElement>) => void;
    previewOptions: PreviewOption[];
    handleOptionPreviewImageClick: (optionIndex: number, optionRaw: string, event: MouseEvent<HTMLDivElement>) => void;
    saving: boolean;
    saveQuestion: () => void;
};

function hasPreviewContent(raw: string) {
    if (!raw) return false;
    const imageRegex = /<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*\/?>/gi;
    if (imageRegex.test(raw)) return true;
    return raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().length > 0;
}

function getPublishStatusLabel(isActive?: boolean) {
    return isActive !== false ? "Published" : "Draft";
}

const QuestionEditor = ({
    editingId,
    readOnly,
    editorOpen,
    inlineMode = false,
    openNew,
    requestCloseEditor,
    formQuestion,
    setFormQuestion,
    formOptions,
    setFormOptions,
    formCorrect,
    setFormCorrect,
    formDifficulty,
    setFormDifficulty,
    formSectionId,
    setFormSectionId,
    managedSections,
    formMarks,
    setFormMarks,
    formNegMarks,
    setFormNegMarks,
    formActive,
    handleEditorPublishChange,
    removeOptionField,
    addOptionField,
    handleQuestionPreviewImageClick,
    previewOptions,
    handleOptionPreviewImageClick,
    saving,
    saveQuestion,
}: QuestionEditorProps) => {
    if (inlineMode && !editorOpen) return null;

    return (
        <div className={inlineMode ? "rounded-2xl border bg-background p-4" : "order-1 flex-1 min-h-0 overflow-y-auto overscroll-y-contain"}>
            <div className={inlineMode ? "" : "p-6 lg:p-8"}>
                <div className={inlineMode ? "space-y-5" : "max-w-4xl mx-auto space-y-5"}>
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <h3 className="text-lg font-semibold">
                                {editingId ? (readOnly ? "Question Preview" : "Edit Question") : "Add Question"}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                {readOnly ? "Preview only. Changes are not allowed." : "Basic text editor for quick question entry."}
                            </p>
                        </div>

                        {!readOnly && !inlineMode ? (
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
                        ) : null}

                        {!readOnly && inlineMode ? (
                            <Button
                                variant="outline"
                                className="rounded-xl"
                                onClick={requestCloseEditor}
                            >
                                Cancel
                            </Button>
                        ) : null}
                    </div>

                    {!editorOpen && !inlineMode ? (
                        <div className="rounded-2xl border border-dashed border-border bg-muted/15 px-6 py-12 text-center">
                            <p className="text-base font-medium">{readOnly ? "Select a question from the list" : "Select a question from the list or create a new one"}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {readOnly ? "You can view imported admin questions here." : "Compose questions with plain text and keep editing simple."}
                            </p>
                            {!readOnly ? (
                                <Button className="rounded-xl mt-4" onClick={openNew}>
                                    <Plus className="h-4 w-4 mr-2" /> Start Writing
                                </Button>
                            ) : null}
                        </div>
                    ) : readOnly ? (
                        /* ── Read-only view for admin-imported tests ── */
                        <div className="space-y-5">
                            {/* Read-only banner */}
                            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Admin-imported test — View only</p>
                                    <p className="text-xs text-muted-foreground">This question was imported from admin and cannot be edited.</p>
                                </div>
                            </div>

                            {/* Question content */}
                            <div className="space-y-2">
                                <Label className="text-muted-foreground">Question</Label>
                                <div className="rounded-xl border border-border bg-muted/10 p-4">
                                    {hasPreviewContent(formQuestion) ? (
                                        <HtmlView html={formQuestion} className="text-sm break-words" />
                                    ) : (
                                        <p className="text-sm text-muted-foreground italic">(No question content)</p>
                                    )}
                                </div>
                            </div>

                            {/* Options */}
                            <div className="space-y-3">
                                <Label className="text-muted-foreground">Answer Choices</Label>
                                <div className="space-y-2">
                                    {formOptions.map((opt, idx) => {
                                        const isCorrect = formCorrect === idx;
                                        const hasContent = hasPreviewContent(opt || "");
                                        if (!hasContent && !opt?.trim()) return null;
                                        return (
                                            <div
                                                key={idx}
                                                className={`rounded-xl border p-3 flex items-start gap-3 ${isCorrect
                                                    ? "border-green-500/40 bg-green-500/5"
                                                    : "border-border bg-muted/10"
                                                    }`}
                                            >
                                                <span className={`text-xs font-bold mt-0.5 shrink-0 ${isCorrect ? "text-green-600" : "text-muted-foreground"}`}>
                                                    {String.fromCharCode(65 + idx)}.
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    {hasContent ? (
                                                        <HtmlView html={opt} className="text-sm break-words" />
                                                    ) : (
                                                        <span className="text-sm">{opt}</span>
                                                    )}
                                                </div>
                                                {isCorrect ? (
                                                    <Badge className="rounded-full text-[10px] bg-green-600 shrink-0">
                                                        <CheckCircle2 className="h-3 w-3 mr-1" /> Correct
                                                    </Badge>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Settings summary */}
                            <div className="rounded-xl border border-border bg-muted/15 p-4 space-y-3">
                                <p className="text-sm font-semibold text-muted-foreground">Question Details</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="rounded-lg border border-border bg-background p-3 text-center">
                                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Difficulty</p>
                                        <p className="text-sm font-semibold mt-1 capitalize">{formDifficulty || "medium"}</p>
                                    </div>
                                    <div className="rounded-lg border border-border bg-background p-3 text-center">
                                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Marks</p>
                                        <p className="text-sm font-semibold mt-1">{formMarks || "—"}</p>
                                    </div>
                                    <div className="rounded-lg border border-border bg-background p-3 text-center">
                                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Negative</p>
                                        <p className="text-sm font-semibold mt-1">{formNegMarks || "—"}</p>
                                    </div>
                                    <div className="rounded-lg border border-border bg-background p-3 text-center">
                                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status</p>
                                        <p className={`text-sm font-semibold mt-1 ${formActive ? "text-green-600" : "text-amber-600"}`}>
                                            {getPublishStatusLabel(formActive)}
                                        </p>
                                    </div>
                                </div>
                            </div>
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
                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
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
                                            <Select value={formDifficulty} onValueChange={setFormDifficulty}>
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

                                        <div className="space-y-2">
                                            <Label>Section</Label>
                                            <Select value={formSectionId} onValueChange={setFormSectionId}>
                                                <SelectTrigger className="rounded-xl">
                                                    <SelectValue placeholder="Select section" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {managedSections.map((section) => (
                                                        <SelectItem key={section.id} value={section.id}>
                                                            {section.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium">{getPublishStatusLabel(formActive)}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {formActive ? "Visible in published list" : "Saved as draft until published"}
                                            </p>
                                        </div>
                                        <Switch checked={formActive} onCheckedChange={handleEditorPublishChange} />
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

                            {!readOnly ? (
                                <div className="flex items-center justify-end">
                                    <Button className="rounded-xl min-w-[160px]" disabled={saving} onClick={saveQuestion}>
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? "Update Question" : "Save Question"}
                                    </Button>
                                </div>
                            ) : null}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export default QuestionEditor