import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Loader2, Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { addDoc, collection, serverTimestamp, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import FloatingInput from "../ui/FloatingInput";
import { TopicMultiSelect } from "@/components/ui/topic-multi-select";

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

type Section = {
  id: string;
  name: string;
  questionsCount: number;
  attemptConstraints?: {
    min: number;
    max: number;
  } | null;
  selectionRule?: "UPTO" | "EXACT" | null;
  durationMinutes?: number | null;
  markingScheme?: {
    correct: number;
    incorrect: number;
    unanswered: number;
  } | null;
};

type CreateTemplateModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateToEdit?: any | null;
};

export default function CreateTemplateModal({ open, onOpenChange, templateToEdit }: CreateTemplateModalProps) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!templateToEdit;

  const [title, setTitle] = useState(templateToEdit?.title || "");
  const [description, setDescription] = useState(templateToEdit?.description || "");
  const [subject, setSubject] = useState(templateToEdit?.subject || "");
  const [difficultyLevel, setDifficultyLevel] = useState<number>(
    normalizeLegacyDifficulty(templateToEdit?.difficultyLevel ?? templateToEdit?.level)
  );
  const [durationMinutes, setDurationMinutes] = useState<string>(
    templateToEdit?.durationMinutes?.toString() || "60"
  );
  const [attemptsAllowed, setAttemptsAllowed] = useState<string>(
    templateToEdit?.attemptsAllowed?.toString() || "3"
  );
  const [isPublished, setIsPublished] = useState(templateToEdit?.isPublished !== false);

  const [markingScheme, setMarkingScheme] = useState({
    correct: templateToEdit?.markingScheme?.correct ?? 5,
    incorrect: templateToEdit?.markingScheme?.incorrect ?? -1,
    unanswered: templateToEdit?.markingScheme?.unanswered ?? 0,
  });

  const [syllabusTags, setSyllabusTags] = useState<string[]>(
    Array.isArray(templateToEdit?.syllabus) ? templateToEdit.syllabus : []
  );

  const [sections, setSections] = useState<Section[]>(
    templateToEdit?.sections?.length > 0
      ? templateToEdit.sections
      : [{ id: "sec_1", name: "Section 1", questionsCount: 0 }]
  );

  // Sync state when templateToEdit changes (Edit mode)
  useEffect(() => {
    if (!open) return;
    setTitle(templateToEdit?.title || "");
    setDescription(templateToEdit?.description || "");
    setSubject(templateToEdit?.subject || "");
    setDifficultyLevel(normalizeLegacyDifficulty(templateToEdit?.difficultyLevel ?? templateToEdit?.level));
    setDurationMinutes(templateToEdit?.durationMinutes?.toString() || "60");
    setAttemptsAllowed(templateToEdit?.attemptsAllowed?.toString() || "3");
    setIsPublished(templateToEdit?.isPublished !== false);
    setMarkingScheme({
      correct: templateToEdit?.markingScheme?.correct ?? 5,
      incorrect: templateToEdit?.markingScheme?.incorrect ?? -1,
      unanswered: templateToEdit?.markingScheme?.unanswered ?? 0,
    });
    setSyllabusTags(Array.isArray(templateToEdit?.syllabus) ? templateToEdit.syllabus : []);
    setSections(
      templateToEdit?.sections?.length > 0
        ? templateToEdit.sections.map((s: any) => ({
            ...s,
            attemptConstraints: s.attemptConstraints || null,
            selectionRule: s.selectionRule || null,
          }))
        : [{ id: "sec_1", name: "Section 1", questionsCount: 0, attemptConstraints: null, selectionRule: null }]
    );
  }, [open, templateToEdit]);

  const handleAddSection = () => {
    setSections([...sections, { id: `sec_${Date.now()}`, name: `Section ${sections.length + 1}`, questionsCount: 0, attemptConstraints: null, selectionRule: null }]);
  };

  const handleRemoveSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const handleSectionChange = (index: number, field: keyof Section, value: any) => {
    const newSections = [...sections];
    newSections[index] = { ...newSections[index], [field]: value };
    setSections(newSections);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    if (sections.length === 0) {
      toast.error("At least one section is required");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        subject: subject.trim(),
        level: getDifficultyLabel(difficultyLevel),
        difficultyLevel,
        durationMinutes: Number(durationMinutes) || 0,
        attemptsAllowed: Number(attemptsAllowed) || 3,
        isPublished,
        markingScheme: {
          correct: Number(markingScheme.correct),
          incorrect: Number(markingScheme.incorrect),
          unanswered: Number(markingScheme.unanswered),
        },
        syllabus: syllabusTags,
        sections: sections.map(s => {
          const totalQ = Number(s.questionsCount) || 0;
          const ac = s.attemptConstraints;
          // Validate constraints
          let validatedConstraints = ac;
          if (ac) {
            const min = Math.max(0, Math.min(ac.min, totalQ));
            const max = Math.max(min, Math.min(ac.max, totalQ));
            validatedConstraints = { min, max };
          }
          return {
            name: s.name.trim(),
            questionsCount: totalQ,
            attemptConstraints: validatedConstraints || null,
            selectionRule: s.selectionRule || null,
            durationMinutes: s.durationMinutes ? Number(s.durationMinutes) : null,
            markingScheme: s.markingScheme ? {
              correct: Number(s.markingScheme.correct),
              incorrect: Number(s.markingScheme.incorrect),
              unanswered: Number(s.markingScheme.unanswered),
            } : null,
          };
        }),
        questionsCount: sections.reduce((acc, s) => acc + (Number(s.questionsCount) || 0), 0),
        source: "admin",
        updatedAt: serverTimestamp(),
      };

      if (isEdit && templateToEdit?.id) {
        await updateDoc(doc(db, "templates", templateToEdit.id), payload);
        toast.success("Template updated successfully");
      } else {
        await addDoc(collection(db, "templates"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.success("Template created successfully");
      }

      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save template");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Template" : "Create New Template"}</DialogTitle>
          <DialogDescription>
            Define the default settings for this template. Educators can use these settings as a base for their custom tests.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. JEE Mains Mock" />
            </div>
            <div className="space-y-2">
              <Label>Subject (Optional)</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Physics" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Template description..." />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Difficulty Level</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[difficultyLevel]}
                  onValueChange={(v) => setDifficultyLevel(v[0])}
                  min={0}
                  max={1}
                  step={0.05}
                  className="flex-1"
                />
                <span className={`text-sm font-semibold min-w-[70px] text-right ${getDifficultyColor(difficultyLevel)}`}>
                  {difficultyLevel.toFixed(2)} — {getDifficultyLabel(difficultyLevel)}
                </span>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                <span>Easy (0.0)</span>
                <span>Medium (0.5)</span>
                <span>Hard (1.0)</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Duration (min)</Label>
              <Input type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} min={1} />
            </div>
            <div className="space-y-3 col-span-2">
              <h3 className="font-semibold text-sm">Marking Scheme</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                <FloatingInput
                  label="Correct"
                  type="number"
                  value={markingScheme.correct}
                  onChange={(e) =>
                    setMarkingScheme({
                      ...markingScheme,
                      correct: Number(e.target.value),
                    })
                  }
                />

                <FloatingInput
                  label="Incorrect"
                  type="number"
                  value={markingScheme.incorrect}
                  onChange={(e) =>
                    setMarkingScheme({
                      ...markingScheme,
                      incorrect: Number(e.target.value),
                    })
                  }
                />

                <FloatingInput
                  label="Unanswered"
                  type="number"
                  value={markingScheme.unanswered}
                  onChange={(e) =>
                    setMarkingScheme({
                      ...markingScheme,
                      unanswered: Number(e.target.value),
                    })
                  }
                />

              </div>
            </div>
          </div>


          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Sections *</h3>
              <Button size="sm" variant="outline" onClick={handleAddSection}><Plus className="h-4 w-4 mr-2" /> Add Section</Button>
            </div>

            {/* You can add Sections Here... This contains List of Sections added in the template */}
            {sections.map((sec, index) => (
              <div key={index} className="flex flex-col gap-3 p-3 bg-muted/10 border rounded-xl">
                <div className="flex items-end gap-3 flex-wrap">
                  <div className="flex-1 min-w-[150px] space-y-2">
                    <Label>Section Name</Label>
                    <Input value={sec.name} onChange={(e) => handleSectionChange(index, 'name', e.target.value)} />
                  </div>
                  <div className="w-24 space-y-2">
                    <Label>Questions</Label>
                    <Input type="number" value={sec.questionsCount} onChange={(e) => handleSectionChange(index, 'questionsCount', Number(e.target.value))} min={0} />
                  </div>
                  <div className="w-24 space-y-2">
                    <Label>Time (opt)</Label>
                    <Input type="number" value={sec.durationMinutes || ""} onChange={(e) => handleSectionChange(index, 'durationMinutes', e.target.value ? Number(e.target.value) : null)} placeholder="min" />
                  </div>

                {/* Attempt Constraints */}
                <div className="w-full mt-2 flex flex-col gap-2 p-2 bg-background rounded-lg border text-xs">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!!sec.attemptConstraints}
                      onCheckedChange={(checked) => {
                        handleSectionChange(index, 'attemptConstraints', checked ? { min: 0, max: Number(sec.questionsCount) || 0 } : null);
                        if (checked && !sec.selectionRule) {
                          handleSectionChange(index, 'selectionRule', 'UPTO');
                        }
                        if (!checked) {
                          handleSectionChange(index, 'selectionRule', null);
                        }
                      }}
                    />
                    <Label className="text-xs">Attempt Constraints</Label>
                  </div>
                  {sec.attemptConstraints && (
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px]">Min</Label>
                        <Input
                          type="number"
                          className="h-7 w-16 text-xs"
                          value={sec.attemptConstraints.min}
                          onChange={(e) => handleSectionChange(index, 'attemptConstraints', {
                            ...sec.attemptConstraints!,
                            min: Math.max(0, Number(e.target.value) || 0),
                          })}
                          min={0}
                          max={sec.attemptConstraints.max}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px]">Max</Label>
                        <Input
                          type="number"
                          className="h-7 w-16 text-xs"
                          value={sec.attemptConstraints.max}
                          onChange={(e) => handleSectionChange(index, 'attemptConstraints', {
                            ...sec.attemptConstraints!,
                            max: Math.min(Number(sec.questionsCount) || 0, Math.max(sec.attemptConstraints!.min, Number(e.target.value) || 0)),
                          })}
                          min={sec.attemptConstraints.min}
                          max={Number(sec.questionsCount) || 0}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px]">Rule</Label>
                        <Select value={sec.selectionRule || 'UPTO'} onValueChange={(v) => handleSectionChange(index, 'selectionRule', v)}>
                          <SelectTrigger className="h-7 w-24 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="UPTO">Up to</SelectItem>
                            <SelectItem value="EXACT">Exactly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-[10px] text-muted-foreground w-full">
                        Students must attempt {sec.selectionRule === 'EXACT' ? 'exactly' : 'up to'} {sec.attemptConstraints.max} of {Number(sec.questionsCount) || 0} questions
                        {sec.attemptConstraints.min > 0 ? ` (minimum ${sec.attemptConstraints.min})` : ''}
                      </p>
                    </div>
                  )}
                </div>
                  <div className="w-24 space-y-2 flex flex-col">
                    <Label>Custom Marks</Label>
                    <div className="w-full h-full flex items-center justify-center pt-3 pb-2 ">
                      <Switch
                        checked={!!sec.markingScheme}
                        onCheckedChange={(checked) => {
                          handleSectionChange(index, 'markingScheme', checked ? { ...markingScheme } : null)
                        }}
                      />
                    </div>
                  </div>
                  {sections.length > 1 && (
                    <Button variant="ghost" size="icon" className="text-destructive mb-0.5" onClick={() => handleRemoveSection(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Section Marking Scheme Override */}

                {sec.markingScheme && (
                  <div className="flex items-center gap-4 bg-background p-2 rounded-lg border text-xs">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs text-green-600">Correct (+)</Label>
                        <Input
                          type="number"
                          className="h-7 w-16 text-xs"
                          value={sec.markingScheme.correct}
                          onChange={(e) => handleSectionChange(index, 'markingScheme', { ...sec.markingScheme, correct: Number(e.target.value) })}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs text-red-500">Incorrect (-)</Label>
                        <Input
                          type="number"
                          className="h-7 w-16 text-xs"
                          value={sec.markingScheme.incorrect}
                          onChange={(e) => handleSectionChange(index, 'markingScheme', { ...sec.markingScheme, incorrect: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Syllabus Topics</Label>
            <p className="text-xs text-muted-foreground">Select topics from the question bank to associate with this template.</p>
            <TopicMultiSelect
              selectedTopics={syllabusTags}
              setSelectedTopics={setSyllabusTags}
              placeholder="Search and select topics from question bank..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="gradient-bg text-white" onClick={handleSave} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
