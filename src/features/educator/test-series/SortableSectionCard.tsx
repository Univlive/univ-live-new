import { useEffect, useState, type ReactNode } from "react";
import {
    GripVertical,
    Plus,
    Trash2,
    ChevronDown,
    ChevronRight,
} from "lucide-react";

import {
    useDroppable,
} from "@dnd-kit/core";
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { Badge } from "@shared/ui/badge";
import "react-image-crop/dist/ReactCrop.css";

import SortableQuestionListItem from "./SortableQuestionListItem";
import { TestQuestion, TestSection } from "./QuestionManager/QuestionManagerTypes";

type SortableSectionCardProps = {
    section: TestSection;
    index: number;
    questions: TestQuestion[];
    collapsed: boolean;
    readOnly: boolean;
    questionDndEnabled: boolean;
    totalQuestionCount: number;
    questionLimit: number | null;
    editingId: string | null;
    onToggleCollapse: (sectionId: string) => void;
    onRename: (sectionId: string, name: string) => void;
    onDelete: (sectionId: string) => void;
    onAddQuestion: (sectionId: string) => void;
    onImportFromBank: (sectionId: string) => void;
    onAddAfterQuestion: (q: TestQuestion) => void;
    onImportAfterQuestion: (q: TestQuestion) => void;
    onOpenEdit: (q: TestQuestion) => void;
    onDuplicate: (q: TestQuestion) => void;
    onDeleteQuestion: (id: string) => void;
    onToggleActive: (q: TestQuestion, next: boolean) => void;
    onAddSection: (sectionId: string) => void;
    inlineEditor: ReactNode;
    inlineEditorAfterQuestionId: string | null;
    inlineEditorAtEnd: boolean;
};

function SortableSectionCard({
    section,
    index,
    questions,
    collapsed,
    readOnly,
    questionDndEnabled,
    totalQuestionCount,
    questionLimit,
    editingId,
    onToggleCollapse,
    onRename,
    onDelete,
    onAddQuestion,
    onImportFromBank,
    onAddAfterQuestion,
    onImportAfterQuestion,
    onOpenEdit,
    onDuplicate,
    onDeleteQuestion,
    onToggleActive,
    onAddSection,
    inlineEditor,
    inlineEditorAfterQuestionId,
    inlineEditorAtEnd,
}: SortableSectionCardProps) {
    const [draftName, setDraftName] = useState(section.name);

    useEffect(() => {
        setDraftName(section.name);
    }, [section.name]);

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: section.id,
        disabled: readOnly,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };
    const sectionDropId = `section-drop:${section.id}`;
    const { setNodeRef: setDropZoneRef, isOver: isDropZoneOver } = useDroppable({
        id: sectionDropId,
        disabled: !questionDndEnabled,
    });
    const isAtCapacity = questionLimit != null && totalQuestionCount >= questionLimit;

    // Section Card 
    return (
        <>
            <div
                ref={setNodeRef}
                style={style}
                className={`rounded-2xl border bg-background ${isDragging ? "opacity-70" : ""}`}
            >
                <div className="p-4 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                        {readOnly ? (
                            <div className="h-9 w-9 shrink-0" />
                        ) : (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-xl text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
                                onClick={(event) => event.stopPropagation()}
                                aria-label="Drag section"
                                {...attributes}
                                {...listeners}
                            >
                                <GripVertical className="h-4 w-4" />
                            </Button>
                        )}

                        <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <Badge variant="secondary"> {section.name} </Badge>
                                <div className="flex items-center gap-2">
                                    {/* {!readOnly ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="rounded-xl"
                                            onClick={() => onAddQuestion(section.id)}
                                            disabled={isAtCapacity}
                                        >
                                            <Plus className="h-3.5 w-3 mr-1.5" /> Add Question
                                        </Button>
                                    ) : null} */}
                                    <Button type="button" variant="ghost" size="icon" className="rounded-xl" onClick={() => onToggleCollapse(section.id)}>
                                        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </Button>
                                    {!readOnly ? (
                                        <Button type="button" variant="ghost" size="icon" className="rounded-xl text-destructive" onClick={() => onDelete(section.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    ) : null}
                                </div>
                            </div>

                            {readOnly ? (
                                <p className="text-sm font-medium truncate">{section.name || `Section ${index + 1}`}</p>
                            ) : (
                                <Input
                                    value={draftName}
                                    onChange={(event) => setDraftName(event.target.value)}
                                    onBlur={() => {
                                        const nextName = draftName.trim() || `Section ${index + 1}`;
                                        if (nextName !== section.name) {
                                            onRename(section.id, nextName);
                                        }
                                    }}
                                    placeholder={`Section ${index + 1}`}
                                    className="rounded-xl"
                                />
                            )}

                            <p className="text-xs text-muted-foreground">
                                {questionLimit != null
                                    ? `${totalQuestionCount} / ${questionLimit} questions`
                                    : `${totalQuestionCount} question${totalQuestionCount === 1 ? "" : "s"}`}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Questions Inside Section Card */}

                {!collapsed ? (
                    <div
                        ref={setDropZoneRef}
                        className={`p-4 space-y-2 rounded-b-2xl transition-colors ${isDropZoneOver && questionDndEnabled ? "bg-primary/5" : ""
                            }`}
                    >
                        {questions.length === 0 ? (
                            <div className="space-y-2">
                                <div className="rounded-xl border border-dashed border-border bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
                                    <p>No questions in this section yet.</p>
                                    {!readOnly ? (
                                        <div className="flex flex-wrap items-center justify-center gap-3">
                                            <Button
                                                type="button"
                                                className="rounded-xl mt-3"
                                                onClick={() => onAddQuestion(section.id)}
                                                disabled={isAtCapacity}
                                            >
                                                <Plus className="h-4 w-4 mr-2" /> Add first question
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="rounded-xl mt-3"
                                                onClick={() => onImportFromBank(section.id)}
                                                disabled={isAtCapacity}
                                            >
                                                <Plus className="h-4 w-4 mr-2" /> Import from question bank
                                            </Button>
                                        </div>
                                    ) : null}
                                </div>
                                {inlineEditor}
                            </div>
                        ) : (
                            <SortableContext
                                items={questions.map((q) => q.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-2">
                                    {questions.map((question, questionIndex) => (
                                        <div key={question.id} className="space-y-2">
                                            {editingId === question.id ? (
                                                inlineEditor
                                            ) : (
                                                <SortableQuestionListItem
                                                    q={question}
                                                    displayOrder={questionIndex + 1}
                                                    dragDisabled={!questionDndEnabled}
                                                    readOnly={readOnly}
                                                    onOpenEdit={onOpenEdit}
                                                    onAddAfterQuestion={onAddAfterQuestion}
                                                    onImportAfterQuestion={onImportAfterQuestion}
                                                    onDuplicate={onDuplicate}
                                                    onDelete={onDeleteQuestion}
                                                    onToggleActive={onToggleActive}
                                                />
                                            )}
                                            {!(editingId === question.id) && inlineEditorAfterQuestionId === question.id ? inlineEditor : null}
                                        </div>
                                    ))}
                                    {inlineEditorAtEnd ? inlineEditor : null}
                                </div>
                            </SortableContext>
                        )}
                    </div>
                ) : null}
            </div>
            {!readOnly ? (
                <div className="group w-full relative flex items-center">

                    {/* Line */}
                    <div className="w-full h-2  
                  opacity-0 group-hover:opacity-100 rounded-full
                  transition-all duration-200" />

                    {/* Button to add question after question */}
                    <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2
                  opacity-0 group-hover:opacity-100 
                  transition-all duration-200 flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            onClick={() => onAddSection(section.id)}
                            aria-label="Add Section after this"
                        >
                            <Plus className="h-3 w-3" /> Add Section
                        </Button>
                    </div>

                </div>
            ) : null}
        </>
    );
}

export default SortableSectionCard;