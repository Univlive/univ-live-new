import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@shared/lib/firebase";
import { useAuth } from "@app/providers/AuthProvider";
import { toast } from "sonner";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Loader2, Plus, Trash2, GripVertical } from "lucide-react";
import { Textarea } from "@shared/ui/textarea";

type Section = {
  name: string;
  questionCount: number;
  format: "single_correct_mcq" | "multicorrect_mcq" | "subjective" | "subjective_long";
};

const DEFAULT_TEMPLATE = {
  title: "Standard DPP",
  sections: [{ name: "Section A", questionCount: 10, format: "single_correct_mcq" as const }],
  positiveMarks: 4,
  negativeMarks: -1,
  durationMinutes: 30,
  instructions: "Attempt all questions. Each correct MCQ answer carries +4 marks; incorrect answer carries -1 mark.",
};

export default function DppTemplate() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(DEFAULT_TEMPLATE.title);
  const [sections, setSections] = useState<Section[]>(DEFAULT_TEMPLATE.sections);
  const [positiveMarks, setPositiveMarks] = useState(DEFAULT_TEMPLATE.positiveMarks);
  const [negativeMarks, setNegativeMarks] = useState(DEFAULT_TEMPLATE.negativeMarks);
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_TEMPLATE.durationMinutes);
  const [instructions, setInstructions] = useState(DEFAULT_TEMPLATE.instructions);

  useEffect(() => {
    getDoc(doc(db, "dpp_template", "default")).then((snap) => {
      if (snap.exists()) {
        const d = snap.data() as any;
        setTitle(d.title || DEFAULT_TEMPLATE.title);
        setSections(d.sections || DEFAULT_TEMPLATE.sections);
        setPositiveMarks(d.positiveMarks ?? DEFAULT_TEMPLATE.positiveMarks);
        setNegativeMarks(d.negativeMarks ?? DEFAULT_TEMPLATE.negativeMarks);
        setDurationMinutes(d.durationMinutes ?? DEFAULT_TEMPLATE.durationMinutes);
        setInstructions(d.instructions || DEFAULT_TEMPLATE.instructions);
      }
      setLoading(false);
    });
  }, []);

  const addSection = () => {
    setSections((prev) => [
      ...prev,
      { name: `Section ${String.fromCharCode(65 + prev.length)}`, questionCount: 5, format: "single_correct_mcq" },
    ]);
  };

  const removeSection = (i: number) => {
    setSections((prev) => prev.filter((_, idx) => idx !== i));
  };

  const updateSection = (i: number, field: keyof Section, value: any) => {
    setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));
  };

  const handleSave = async () => {
    if (!title.trim()) return toast.error("Title required");
    if (sections.length === 0) return toast.error("At least one section required");
    for (const s of sections) {
      if (!s.name.trim()) return toast.error("All sections must have a name");
      if (s.questionCount < 1) return toast.error("Question count must be at least 1");
    }

    setSaving(true);
    try {
      await setDoc(doc(db, "dpp_template", "default"), {
        title: title.trim(),
        sections,
        positiveMarks: Number(positiveMarks),
        negativeMarks: Number(negativeMarks),
        durationMinutes: Number(durationMinutes),
        instructions: instructions.trim(),
        updatedAt: Timestamp.now(),
        updatedBy: profile?.uid ?? "",
      });
      toast.success("DPP template saved");
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const totalQuestions = sections.reduce((sum, s) => sum + (s.questionCount || 0), 0);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">DPP Template</h1>
        <p className="text-sm text-muted-foreground">Global template used when Gemini generates Daily Practice Problems</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Basic Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Template Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Standard DPP Format" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Duration (min)</Label>
              <Input type="number" min={5} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>+Marks / Question</Label>
              <Input type="number" min={0} value={positiveMarks} onChange={(e) => setPositiveMarks(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>−Marks / Wrong</Label>
              <Input type="number" value={negativeMarks} onChange={(e) => setNegativeMarks(Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Instructions (shown to students)</Label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              placeholder="Instructions for students taking the DPP test"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Sections <span className="text-sm font-normal text-muted-foreground">({totalQuestions} questions total)</span></CardTitle>
            <Button size="sm" variant="outline" onClick={addSection}>
              <Plus className="h-4 w-4 mr-1" /> Add Section
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {sections.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No sections yet. Add one above.</p>
          )}
          {sections.map((section, i) => (
            <div key={i} className="flex items-start gap-3 p-3 border rounded-lg">
              <GripVertical className="h-4 w-4 mt-2.5 text-muted-foreground shrink-0" />
              <div className="flex-1 grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Section Name</Label>
                  <Input
                    value={section.name}
                    onChange={(e) => updateSection(i, "name", e.target.value)}
                    placeholder="e.g. Section A"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Questions</Label>
                  <Input
                    type="number"
                    min={1}
                    value={section.questionCount}
                    onChange={(e) => updateSection(i, "questionCount", Math.max(1, Number(e.target.value)))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Format</Label>
                  <Select value={section.format} onValueChange={(v) => updateSection(i, "format", v)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single_correct_mcq">Single Correct MCQ</SelectItem>
                      <SelectItem value="multicorrect_mcq">Multi-Correct MCQ</SelectItem>
                      <SelectItem value="subjective">Subjective</SelectItem>
                      <SelectItem value="subjective_long">Subjective Long</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button size="icon" variant="ghost" className="shrink-0 mt-1" onClick={() => removeSection(i)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Save Template
      </Button>
    </div>
  );
}
