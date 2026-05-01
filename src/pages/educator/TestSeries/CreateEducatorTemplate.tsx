import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Loader2, Save, FileText } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthProvider";
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

type Section = {
  id: string;
  name: string;
  questionsCount: number;
  attemptlimit?: number | null;
  durationMinutes?: number | null;
  markingScheme?: {
    correct: number;
    incorrect: number;
    unanswered: number;
  } | null;
};

type CreateEducatorTemplateProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function CreateEducatorTemplate({ open: controlledOpen, onOpenChange: controlledOnOpenChange }: CreateEducatorTemplateProps = {}) {
  const { firebaseUser: currentUser } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Support both controlled and uncontrolled
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [difficultyLevel, setDifficultyLevel] = useState<number>(0.5);
  const [durationMinutes, setDurationMinutes] = useState<string>("60");
  const [syllabusTags, setSyllabusTags] = useState<string[]>([]);

  const [markingScheme, setMarkingScheme] = useState({
    correct: 4,
    incorrect: -1,
    unanswered: 0,
  });

  const [sections, setSections] = useState<Section[]>([
    { id: "sec_1", name: "Section 1", questionsCount: 0, attemptlimit: null }
  ]);

  const handleAddSection = () => {
    setSections([...sections, { id: `sec_${Date.now()}`, name: `Section ${sections.length + 1}`, questionsCount: 0, attemptlimit: null }]);
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
    if (!currentUser) return;

    if (!label.trim()) {
      toast.error("Template Label is required");
      return;
    }

    if (sections.length === 0) {
      toast.error("At least one section is required");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        label: label.trim(),
        description: description.trim(),
        subject: subject.trim(),
        level: getDifficultyLabel(difficultyLevel),
        difficultyLevel,
        durationMinutes: Number(durationMinutes) || 0,
        syllabus: syllabusTags,
        markingScheme: {
          correct: Number(markingScheme.correct),
          incorrect: Number(markingScheme.incorrect),
          unanswered: Number(markingScheme.unanswered),
        },
        sections: sections.map(s => {
          const totalQ = Number(s.questionsCount) || 0;
          const attemptLimit =
            s.attemptlimit == null
              ? totalQ
              : Math.min(Number(s.attemptlimit), totalQ);

          return {
            name: s.name.trim(),
            questionsCount: totalQ,
            attemptlimit: attemptLimit,
            durationMinutes: s.durationMinutes ? Number(s.durationMinutes) : null,
            markingScheme: s.markingScheme ? {
              correct: Number(s.markingScheme.correct),
              incorrect: Number(s.markingScheme.incorrect),
              unanswered: Number(s.markingScheme.unanswered),
            } : null,
          };
        }),
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "educators", currentUser.uid, "templates"), payload);
      toast.success("Custom template created successfully");

      // Reset form
      setLabel("");
      setDescription("");
      setSubject("");
      setDifficultyLevel(0.5);
      setDurationMinutes("60");
      setSyllabusTags([]);
      setSections([{ id: "sec_1", name: "Section 1", questionsCount: 0, attemptlimit: null }]);

      setOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save template");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant="outline" className="shadow-sm">
            <FileText className="mr-2 h-4 w-4" /> Create Template
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-3xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Custom Template</DialogTitle>
          <DialogDescription>
            Build a reusable blueprint. You can quickly generate new custom tests from this template in the future.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="space-y-2 p-4 bg-primary/5 border border-primary/20 rounded-xl">
            <Label className="text-primary font-bold">Template Label *</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. My Weekly Exam Blueprint" className="border-primary/30" />
            <p className="text-xs text-muted-foreground">This is how the template will appear in the dropdown menu.</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label>Subject (Optional)</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Physics" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Template description..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div className="space-y-3 p-4 bg-muted/30 rounded-xl border">
            <h3 className="font-semibold text-sm">Global Marking Scheme</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Correct (+)</Label>
                <Input type="number" value={markingScheme.correct} onChange={(e) => setMarkingScheme({ ...markingScheme, correct: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Incorrect (-)</Label>
                <Input type="number" value={markingScheme.incorrect} onChange={(e) => setMarkingScheme({ ...markingScheme, incorrect: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Unanswered</Label>
                <Input type="number" value={markingScheme.unanswered} onChange={(e) => setMarkingScheme({ ...markingScheme, unanswered: Number(e.target.value) })} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Sections *</h3>
              <Button size="sm" variant="outline" onClick={handleAddSection}><Plus className="h-4 w-4 mr-2" /> Add Section</Button>
            </div>

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
                    <Label>Attempt Limit</Label>
                    <Input type="number" value={sec.attemptlimit ?? ""} onChange={(e) => handleSectionChange(index, 'attemptlimit', e.target.value ? Number(e.target.value) : null)} min={0} placeholder="All" />
                  </div>
                  <div className="w-24 space-y-2">
                    <Label>Time (opt)</Label>
                    <Input type="number" value={sec.durationMinutes || ""} onChange={(e) => handleSectionChange(index, 'durationMinutes', e.target.value ? Number(e.target.value) : null)} placeholder="min" />
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
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
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
