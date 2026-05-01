import { FormEvent, useEffect, useMemo, useState } from "react";

import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Clock, BookOpen, ListChecks, Sparkles } from "lucide-react";
import SectionCard from "@/components/admin/SectionCard";

function getDifficultyLabel(level: number): string {
    if (level <= 0.3) return "Easy";
    if (level <= 0.7) return "Medium";
    return "Hard";
}

function getDifficultyColor(level: number): string {
    if (level <= 0.3) return "text-green-600";
    if (level <= 0.7) return "text-yellow-600";
    return "text-red-600";
}

function normalizeLegacyDifficulty(level?: string | number): number {
    if (typeof level === "number") return Math.max(0, Math.min(1, level));
    const s = String(level || "").toLowerCase().trim();
    if (s === "easy") return 0.15;
    if (s === "medium" || s === "general") return 0.5;
    if (s === "hard") return 0.85;
    return 0.5;
}

function clampDifficulty(level?: number) {
    if (!Number.isFinite(Number(level))) return 0.5;
    return Math.min(1, Math.max(0, Number(level)));
}

function getAverageDifficulty(sections: Array<{ difficultyLevel?: number }>, fallback = 0.5) {
    if (sections.length === 0) return fallback;
    const total = sections.reduce((acc, s) => acc + clampDifficulty(s.difficultyLevel ?? fallback), 0);
    return total / sections.length;
}

type TemplateOption = {
    id: string;
    label: string;
    group: "admin" | "educator";
};

type FullTemplateData = {
    id: string;
    title?: string;
    description?: string;
    subject?: string;
    level?: string;
    durationMinutes?: number;
    duration?: number;
    attemptsAllowed?: number;
    sections?: Array<{
        id?: string;
        name?: string;
        questionsCount?: number;
        attemptlimit?: number | null;
        durationMinutes?: number | null;
        difficultyLevel?: number;
        difficulty?: string;
        topics?: string[];
        markingScheme?: {
            correct?: number;
            incorrect?: number;
            unanswered?: number;
        } | null;
    }>;
    markingScheme?: {
        correct?: number;
        incorrect?: number;
        unanswered?: number;
    };
    syllabus?: string[];
    requiresUnlock?: boolean;
    price?: number;
    isPublished?: boolean;
    questionsCount?: number;
    questionCount?: number;
    totalQuestions?: number;
    templateName?: string;
    difficultyLevel?: number;
};

type CreateCustomTestProps = {
    createOpen: boolean;
    setCreateOpen: (open: boolean) => void;
    handleCreateCustom: (values: Record<string, any>) => Promise<void> | void;
    creating: boolean;
    selectedTemplateId: string;
    setSelectedTemplateId: (value: string) => void;
    templates: TemplateOption[];
    bankTests: FullTemplateData[];
    educatorTemplates: FullTemplateData[];
    onCreateTemplate?: () => void;
};

function safeNum(v: any, fallback: number) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

const CreateCustomTest = ({
    createOpen,
    setCreateOpen,
    handleCreateCustom,
    creating,
    selectedTemplateId,
    setSelectedTemplateId,
    templates,
    bankTests,
    educatorTemplates,
    onCreateTemplate,
}: CreateCustomTestProps) => {
    const [formTitle, setFormTitle] = useState("");
    const [formDescription, setFormDescription] = useState("");
    const [formSubject, setFormSubject] = useState("");
    const [formDuration, setFormDuration] = useState("60");
    const [formSections, setFormSections] = useState<any[]>([]);
    const [formMarkingScheme, setFormMarkingScheme] = useState<any>({ correct: 4, incorrect: -1, unanswered: 0 });

    // Reset form & template selection when dialog opens
    useEffect(() => {
        if (createOpen) {
            setFormTitle("");
            setFormDescription("");
            setFormSubject("");
            setFormDuration("60");
            setFormSections([]);
            setFormMarkingScheme({ correct: 4, incorrect: -1, unanswered: 0 });
            setSelectedTemplateId("none");
        }
    }, [createOpen]);

    const resolvedTemplate = useMemo((): FullTemplateData | null => {
        if (!selectedTemplateId || selectedTemplateId === "none") return null;
        const [type, id] = selectedTemplateId.split(":");
        if (!id) return null;
        if (type === "admin") return bankTests.find((t) => t.id === id) || null;
        if (type === "edu") return educatorTemplates.find((t) => t.id === id) || null;
        return null;
    }, [selectedTemplateId, bankTests, educatorTemplates]);

    useEffect(() => {
        if (!resolvedTemplate) {
            if (selectedTemplateId === "none" || !selectedTemplateId) {
                setFormDescription("");
                setFormSubject("");
                setFormDuration("60");
                setFormSections([]);
                setFormMarkingScheme({ correct: 4, incorrect: -1, unanswered: 0 });
            }
            return;
        }
        const baseDifficulty = normalizeLegacyDifficulty(resolvedTemplate.difficultyLevel ?? resolvedTemplate.level);
        setFormDescription(String(resolvedTemplate.description || ""));
        setFormSubject(String(resolvedTemplate.subject || ""));
        setFormDuration(String(safeNum(resolvedTemplate.durationMinutes ?? resolvedTemplate.duration, 60)));
        setFormSections(
            resolvedTemplate.sections
                ? JSON.parse(JSON.stringify(resolvedTemplate.sections)).map((s: any) => ({
                    ...s,
                    attemptlimit: s.attemptlimit ?? null,
                    durationMinutes: s.durationMinutes ?? null,
                    difficultyLevel: clampDifficulty(s?.difficultyLevel ?? normalizeLegacyDifficulty(s?.difficulty ?? s?.level ?? baseDifficulty)),
                    topics: Array.isArray(s?.topics) ? s.topics.map(String) : [],
                }))
                : []
        );
        setFormMarkingScheme(resolvedTemplate.markingScheme ? JSON.parse(JSON.stringify(resolvedTemplate.markingScheme)) : { correct: 4, incorrect: -1, unanswered: 0 });
    }, [resolvedTemplate]);

    const handleTemplateChange = (value: string) => {
        if (value === "__create_template__") {
            onCreateTemplate?.();
            return;
        }
        setSelectedTemplateId(value);
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const averagedDifficultyLevel = getAverageDifficulty(formSections, 0.5);
        const values: Record<string, any> = {
            title: formTitle.trim(),
            description: formDescription.trim(),
            subject: formSubject.trim(),
            level: getDifficultyLabel(averagedDifficultyLevel),
            difficultyLevel: averagedDifficultyLevel,
            durationMinutes: Number(formDuration) || 60,
            sections: formSections.map(s => {
                const totalQ = Number(s.questionsCount) || 0;

                const attemptLimit =
                    s.attemptlimit == null
                        ? totalQ
                        : Math.min(Number(s.attemptlimit), totalQ);

                return {
                    name: s.name?.trim() || "Section",
                    questionsCount: totalQ,
                    attemptlimit: attemptLimit,
                    durationMinutes: s.durationMinutes ? Number(s.durationMinutes) : null,
                    difficultyLevel: clampDifficulty(s.difficultyLevel),
                    topics: Array.isArray(s.topics) ? s.topics : [],
                    markingScheme: s.markingScheme ? {
                        correct: Number(s.markingScheme.correct),
                        incorrect: Number(s.markingScheme.incorrect),
                        unanswered: Number(s.markingScheme.unanswered),
                    } : null,
                };
            }),
            markingScheme: {
                correct: Number(formMarkingScheme.correct),
                incorrect: Number(formMarkingScheme.incorrect),
                unanswered: Number(formMarkingScheme.unanswered),
            },
        };
        if (resolvedTemplate) {
            if (resolvedTemplate.syllabus) values.syllabus = resolvedTemplate.syllabus;
            if (resolvedTemplate.requiresUnlock !== undefined) values.requiresUnlock = resolvedTemplate.requiresUnlock;
            if (resolvedTemplate.attemptsAllowed) values.attemptsAllowed = resolvedTemplate.attemptsAllowed;
        }
        await handleCreateCustom(values);
    };

    // Admin templates first, then educator templates
    const adminTemplates = templates.filter((t) => t.group === "admin");
    const educatorTpls = templates.filter((t) => t.group === "educator");

    const totalQuestions = resolvedTemplate
        ? safeNum(
            resolvedTemplate.questionsCount ??
            resolvedTemplate.questionCount ??
            resolvedTemplate.totalQuestions ??
            (resolvedTemplate.sections || []).reduce((acc: number, s: any) => acc + safeNum(s?.questionsCount, 0), 0),
            0
        ) : 0;

    const computedDifficultyLevel = getAverageDifficulty(formSections, 0.5);

    return (
        <DialogContent className="max-w-xl rounded-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>Create New Test</DialogTitle>
                <DialogDescription>
                    Start from an admin template or one of your saved templates, then create a new test with the same settings.
                </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                <div className="space-y-2">
                    <Label>Template</Label>
                    <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                        <SelectTrigger className="rounded-xl">
                            <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Blank test</SelectItem>

                            {/* Admin templates first */}
                            {adminTemplates.length > 0 && (
                                <SelectGroup>
                                    <SelectLabel>Admin Templates</SelectLabel>
                                    {adminTemplates.map((template) => (
                                        <SelectItem key={template.id} value={`admin:${template.id.replace("admin:", "")}`}>
                                            {template.label}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            )}

                            {/* Educator custom templates */}
                            {educatorTpls.length > 0 && (
                                <>
                                    <SelectSeparator />
                                    <SelectGroup>
                                        <SelectLabel>Your Templates</SelectLabel>
                                        {educatorTpls.map((template) => (
                                            <SelectItem
                                                key={template.id}
                                                value={`edu:${template.id.replace("edu:", "")}`}
                                            >
                                                {template.label}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </>
                            )}

                            {/* Create Custom Template option at the end */}
                            <SelectSeparator />
                            <SelectItem value="__create_template__" className="text-primary font-medium">
                                + Create Custom Template
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {resolvedTemplate && (
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <span className="text-sm font-semibold text-primary">Template Preview</span>
                            <Badge variant="secondary" className="rounded-full text-xs ml-auto">Pre-filled</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-xl bg-background/80 p-2.5 text-center">
                                <p className="text-[10px] uppercase font-medium text-muted-foreground">Duration</p>
                                <p className="text-sm font-bold flex items-center justify-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {safeNum(resolvedTemplate.durationMinutes ?? resolvedTemplate.duration, 60)}m
                                </p>
                            </div>
                            <div className="rounded-xl bg-background/80 p-2.5 text-center">
                                <p className="text-[10px] uppercase font-medium text-muted-foreground">Questions</p>
                                <p className="text-sm font-bold flex items-center justify-center gap-1">
                                    <BookOpen className="h-3 w-3" />{totalQuestions}
                                </p>
                            </div>
                            <div className="rounded-xl bg-background/80 p-2.5 text-center">
                                <p className="text-[10px] uppercase font-medium text-muted-foreground">Sections</p>
                                <p className="text-sm font-bold flex items-center justify-center gap-1">
                                    <ListChecks className="h-3 w-3" />{(resolvedTemplate.sections || []).length}
                                </p>
                            </div>
                        </div>
                        {resolvedTemplate.syllabus && resolvedTemplate.syllabus.length > 0 && (
                            <div className="space-y-1 mt-2">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Syllabus ({resolvedTemplate.syllabus.length} topics):
                                </p>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                    {resolvedTemplate.syllabus.slice(0, 5).join(", ")}
                                    {resolvedTemplate.syllabus.length > 5 ? ` +${resolvedTemplate.syllabus.length - 5} more` : ""}
                                </p>
                            </div>
                        )}
                        <p className="text-[11px] text-muted-foreground italic mt-2">
                            Template loaded! You can modify its settings below.
                        </p>
                    </div>
                )}

                <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} required placeholder="e.g. Weekly Biology Mock" className="rounded-xl" />
                </div>

                <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Short instructions / overview..." className="rounded-xl min-h-[90px]" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Subject (Optional)</Label>
                        <Input value={formSubject} onChange={(e) => setFormSubject(e.target.value)} className="rounded-xl" placeholder="e.g. Maths" />
                    </div>
                    <div className="space-y-2">
                        <Label>Test Difficulty (avg of sections)</Label>
                        <span className={`text-xs font-semibold min-w-[60px] text-right ${getDifficultyColor(computedDifficultyLevel)}`}>
                            {computedDifficultyLevel.toFixed(2)} — {getDifficultyLabel(computedDifficultyLevel)}
                        </span>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Duration (minutes)</Label>
                    <Input value={formDuration} onChange={(e) => setFormDuration(e.target.value)} required type="number" min={1} className="rounded-xl" />
                </div>

                <div className="space-y-3 p-4 bg-muted/30 rounded-xl border border-border">
                    <h3 className="font-semibold text-sm">Global Marking Scheme</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs">Correct (+)</Label>
                            <Input type="number" className="h-8" value={formMarkingScheme.correct} onChange={(e) => setFormMarkingScheme({ ...formMarkingScheme, correct: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">Incorrect (-)</Label>
                            <Input type="number" className="h-8" value={formMarkingScheme.incorrect} onChange={(e) => setFormMarkingScheme({ ...formMarkingScheme, incorrect: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">Unanswered</Label>
                            <Input type="number" className="h-8" value={formMarkingScheme.unanswered} onChange={(e) => setFormMarkingScheme({ ...formMarkingScheme, unanswered: e.target.value })} />
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm">Sections</h3>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                                setFormSections([
                                    ...formSections,
                                    {
                                        id: `sec_${Date.now()}`,
                                        name: `Section ${formSections.length + 1}`,
                                        questionsCount: 0,
                                        attemptlimit: null,
                                        durationMinutes: null,
                                        difficultyLevel: computedDifficultyLevel,
                                        topics: [],
                                    },
                                ])
                            }
                        >
                            <Plus className="h-4 w-4 mr-2" /> Add Section
                        </Button>
                    </div>

                    {formSections.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic text-center py-4 bg-muted/20 rounded-xl border border-dashed">
                            No sections defined. The test will be a single unsectioned list of questions.
                        </p>
                    ) : (
                        formSections.map((sec, index) => (
                            <SectionCard
                                key={sec.id || index}
                                sectionId={sec.id || `sec_${index + 1}`}
                                sectionName={sec.name}
                                questionCount={Number(sec.questionsCount) || 0}
                                attemptLimit={sec.attemptlimit ?? undefined}
                                durationMinutes={sec.durationMinutes ?? undefined}
                                sectionDifficulty={sec.difficultyLevel}
                                sectionTopics={sec.topics}
                                markingScheme={sec.markingScheme}
                                defaultMarkingScheme={formMarkingScheme}
                                onEdit={(payload) => {
                                    const updated = [...formSections];
                                    updated[index] = {
                                        ...updated[index],
                                        name: payload.name,
                                        questionsCount: payload.questionsCount,
                                        attemptlimit: payload.attemptLimit ?? null,
                                        durationMinutes: payload.durationMinutes ?? null,
                                        difficultyLevel: clampDifficulty(payload.difficultyLevel),
                                        topics: payload.topics || [],
                                        markingScheme: payload.markingScheme,
                                    };
                                    setFormSections(updated);
                                }}
                                onRemove={() => setFormSections(formSections.filter((_, i) => i !== index))}
                            />
                        ))
                    )}
                </div>

                <Button type="submit" className="w-full rounded-xl mt-6" disabled={creating}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Test"}
                </Button>

                <p className="text-xs text-muted-foreground">
                    Note: Educators cannot import from the global question bank. Add questions manually inside the test.
                </p>
            </form>
        </DialogContent>
    );
}

export default CreateCustomTest;