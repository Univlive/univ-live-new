import { FormEvent, useEffect, useMemo, useState } from "react";

import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Clock, BookOpen, ListChecks, Sparkles, Trash2 } from "lucide-react";

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
        questionsToAttempt?: number | null;
        durationMinutes?: number | null;
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
    const [formLevel, setFormLevel] = useState("");
    const [formDuration, setFormDuration] = useState("60");
    const [formSections, setFormSections] = useState<any[]>([]);
    const [formMarkingScheme, setFormMarkingScheme] = useState<any>({ correct: 4, incorrect: -1, unanswered: 0 });

    // Reset form & template selection when dialog opens
    useEffect(() => {
        if (createOpen) {
            setFormTitle("");
            setFormDescription("");
            setFormSubject("");
            setFormLevel("");
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
                setFormLevel("");
                setFormDuration("60");
                setFormSections([]);
                setFormMarkingScheme({ correct: 4, incorrect: -1, unanswered: 0 });
            }
            return;
        }
        setFormDescription(String(resolvedTemplate.description || ""));
        setFormSubject(String(resolvedTemplate.subject || ""));
        setFormLevel(String(resolvedTemplate.level || ""));
        setFormDuration(String(safeNum(resolvedTemplate.durationMinutes ?? resolvedTemplate.duration, 60)));
        setFormSections(resolvedTemplate.sections ? JSON.parse(JSON.stringify(resolvedTemplate.sections)) : []);
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
        const values: Record<string, any> = {
            title: formTitle.trim(),
            description: formDescription.trim(),
            subject: formSubject.trim(),
            level: formLevel.trim() || "General",
            durationMinutes: Number(formDuration) || 60,
            sections: formSections.map(s => ({
                name: s.name?.trim() || "Section",
                questionsCount: Number(s.questionsCount) || 0,
                questionsToAttempt: Number(s.questionsToAttempt) || 0,
                durationMinutes: s.durationMinutes ? Number(s.durationMinutes) : null,
                markingScheme: s.markingScheme ? {
                    correct: Number(s.markingScheme.correct),
                    incorrect: Number(s.markingScheme.incorrect),
                    unanswered: Number(s.markingScheme.unanswered),
                } : null,
            })),
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
                                            <SelectItem key={template.id} value={`edu:${template.id.replace("edu:", "")}`}>
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
                        <Label>Level</Label>
                        <Input value={formLevel} onChange={(e) => setFormLevel(e.target.value)} className="rounded-xl" placeholder="e.g. Medium" />
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
                        <Button type="button" size="sm" variant="outline" onClick={() => setFormSections([...formSections, { id: `sec_${Date.now()}`, name: `Section ${formSections.length + 1}`, questionsCount: 0, questionsToAttempt: 0 }])}>
                            <Plus className="h-4 w-4 mr-2" /> Add Section
                        </Button>
                    </div>

                    {formSections.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic text-center py-4 bg-muted/20 rounded-xl border border-dashed">
                            No sections defined. The test will be a single unsectioned list of questions.
                        </p>
                    ) : (
                        formSections.map((sec, index) => (
                            <div key={index} className="flex flex-col gap-3 p-3 bg-muted/10 border rounded-xl">
                                <div className="flex items-end gap-3 flex-wrap">
                                    <div className="flex-1 min-w-[150px] space-y-2">
                                        <Label className="text-xs">Section Name</Label>
                                        <Input className="h-8" value={sec.name} onChange={(e) => {
                                            const newSec = [...formSections];
                                            newSec[index].name = e.target.value;
                                            setFormSections(newSec);
                                        }} />
                                    </div>
                                    <div className="w-16 space-y-2">
                                        <Label className="text-xs">Questions</Label>
                                        <Input type="number" className="h-8" value={sec.questionsCount} onChange={(e) => {
                                            const newSec = [...formSections];
                                            newSec[index].questionsCount = e.target.value;
                                            setFormSections(newSec);
                                        }} min={0} />
                                    </div>
                                    <div className="w-16 space-y-2">
                                        <Label className="text-xs">Attempt</Label>
                                        <Input type="number" className="h-8" value={sec.questionsToAttempt ?? ""} onChange={(e) => {
                                            const newSec = [...formSections];
                                            newSec[index].questionsToAttempt = e.target.value;
                                            setFormSections(newSec);
                                        }} min={0} placeholder="All" />
                                    </div>
                                    <div className="w-16 space-y-2">
                                        <Label className="text-xs">Time (opt)</Label>
                                        <Input type="number" className="h-8" value={sec.durationMinutes || ""} onChange={(e) => {
                                            const newSec = [...formSections];
                                            newSec[index].durationMinutes = e.target.value;
                                            setFormSections(newSec);
                                        }} placeholder="min" />
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive mb-0.5" onClick={() => {
                                        setFormSections(formSections.filter((_, i) => i !== index));
                                    }}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="flex items-center gap-4 bg-background p-2 rounded-lg border text-xs">
                                    <div className="flex items-center gap-2">
                                        <Switch
                                            checked={!!sec.markingScheme}
                                            onCheckedChange={(checked) => {
                                                const newSec = [...formSections];
                                                newSec[index].markingScheme = checked ? { ...formMarkingScheme } : null;
                                                setFormSections(newSec);
                                            }}
                                        />
                                        <Label className="text-xs">Custom Marks</Label>
                                    </div>

                                    {sec.markingScheme && (
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1.5">
                                                <Label className="text-[10px] text-green-600">Correct (+)</Label>
                                                <Input type="number" className="h-6 w-14 text-[10px]" value={sec.markingScheme.correct} onChange={(e) => {
                                                    const newSec = [...formSections];
                                                    newSec[index].markingScheme.correct = e.target.value;
                                                    setFormSections(newSec);
                                                }} />
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Label className="text-[10px] text-red-500">Incorrect (-)</Label>
                                                <Input type="number" className="h-6 w-14 text-[10px]" value={sec.markingScheme.incorrect} onChange={(e) => {
                                                    const newSec = [...formSections];
                                                    newSec[index].markingScheme.incorrect = e.target.value;
                                                    setFormSections(newSec);
                                                }} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
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