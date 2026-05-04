import { useState, KeyboardEvent } from "react";
import { Card } from "@shared/ui/card";
import { Edit, Trash2, X } from "lucide-react";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@shared/ui/dialog";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Slider } from "@shared/ui/slider";
import { Switch } from "@shared/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { TopicMultiSelect } from "@shared/ui/topic-multi-select";

type MarkingScheme = {
  correct: number;
  incorrect: number;
  unanswered: number;
} | null;

const QUESTION_FORMATS = [
  { value: "single_correct_mcq", label: "Single Correct MCQ" },
  { value: "multicorrect_mcq", label: "Multi-Correct MCQ" },
  { value: "subjective", label: "Subjective (Short)" },
  { value: "subjective_long", label: "Subjective (Long)" },
];

type SectionCardProps = {
  sectionId: string;
  sectionName: string;
  questionCount: number;
  attemptLimit?: number;
  durationMinutes?: number;
  sectionDifficulty?: number;
  sectionTopics?: string[];
  sectionSubject?: string;
  sectionTags?: string[];
  sectionFormat?: string;
  availableSubjects?: { id: string; name: string }[];
  defaultMarkingScheme?: {
    correct: number;
    incorrect: number;
    unanswered: number;
  };
  markingScheme?: MarkingScheme;
  onEdit?: (payload: {
    name: string;
    questionsCount: number;
    attemptLimit?: number | null;
    durationMinutes?: number | null;
    difficultyLevel: number;
    topics: string[];
    markingScheme: MarkingScheme;
    subject: string;
    tags: string[];
    format: string;
  }) => void;
  onRemove: () => void;
};

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

function clampDifficulty(level?: number) {
    if (!Number.isFinite(Number(level))) return 0.5;
    return Math.min(1, Math.max(0, Number(level)));
}

const SectionCard = ({ sectionId, sectionName, questionCount, attemptLimit, durationMinutes, sectionDifficulty, sectionTopics, sectionSubject, sectionTags, sectionFormat, availableSubjects, defaultMarkingScheme, markingScheme, onEdit, onRemove }: SectionCardProps
) => {
        const [editOpen, setEditOpen] = useState(false);
        const [draftName, setDraftName] = useState(sectionName);
        const [draftQuestionsCount, setDraftQuestionsCount] = useState(String(questionCount));
        const [draftAttemptLimit, setDraftAttemptLimit] = useState(
                attemptLimit == null ? "" : String(attemptLimit)
        );
        const [draftDurationMinutes, setDraftDurationMinutes] = useState(
                durationMinutes == null ? "" : String(durationMinutes)
        );
        const [draftDifficultyLevel, setDraftDifficultyLevel] = useState(
                clampDifficulty(sectionDifficulty)
        );
        const [draftTopics, setDraftTopics] = useState<string[]>(sectionTopics || []);
        const [draftSubject, setDraftSubject] = useState(sectionSubject || "");
        const [draftTags, setDraftTags] = useState<string[]>(sectionTags || []);
        const [draftTagInput, setDraftTagInput] = useState("");
        const [draftFormat, setDraftFormat] = useState(sectionFormat || "");
        const [draftMarkingEnabled, setDraftMarkingEnabled] = useState(!!markingScheme);
        const fallbackScheme = defaultMarkingScheme || { correct: 4, incorrect: -1, unanswered: 0 };
        const [draftMarkingScheme, setDraftMarkingScheme] = useState({
                correct: markingScheme?.correct ?? fallbackScheme.correct,
                incorrect: markingScheme?.incorrect ?? fallbackScheme.incorrect,
                unanswered: markingScheme?.unanswered ?? fallbackScheme.unanswered,
        });

        const openEdit = () => {
                setDraftName(sectionName);
                setDraftQuestionsCount(String(questionCount));
                setDraftAttemptLimit(attemptLimit == null ? "" : String(attemptLimit));
                setDraftDurationMinutes(durationMinutes == null ? "" : String(durationMinutes));
                setDraftDifficultyLevel(clampDifficulty(sectionDifficulty));
                setDraftTopics(sectionTopics || []);
                setDraftSubject(sectionSubject || "");
                setDraftTags(sectionTags || []);
                setDraftTagInput("");
                setDraftFormat(sectionFormat || "");
                setDraftMarkingEnabled(!!markingScheme);
                setDraftMarkingScheme({
                        correct: markingScheme?.correct ?? fallbackScheme.correct,
                        incorrect: markingScheme?.incorrect ?? fallbackScheme.incorrect,
                        unanswered: markingScheme?.unanswered ?? fallbackScheme.unanswered,
                });
                setEditOpen(true);
        };

        const addTag = (raw: string) => {
          const tag = raw.trim();
          if (tag && !draftTags.includes(tag)) setDraftTags(prev => [...prev, tag]);
          setDraftTagInput("");
        };

        const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTag(draftTagInput);
          }
        };

    const onRemoveConfirmation = () => {
        if (confirm("Are you sure you want to remove this section? This action cannot be undone.")) {
            // Call the onRemove function passed as a prop to actually remove the section
            onRemove();
        } else {
            // User cancelled the action, do nothing
            return;
        }
    }

    return (
        <Card>
            <div className="p-4">
                <div className="flex items-center justify-between">
                    <div className="flex gap-5" >
                        <h4 className="font-semibold">
                            {sectionName}
                        </h4>
                        <div className="flex gap-2 flex-wrap">
                            <Badge variant="outline">Questions: {questionCount}</Badge>
                            {attemptLimit !== undefined && (
                                <Badge variant="outline">Attempt Limit: {attemptLimit}</Badge>
                            )}
                            {durationMinutes > 0 && (
                                    <Badge variant="outline">Duration: {durationMinutes} mins</Badge>
                            )}
                            {sectionDifficulty != null && (
                                <Badge variant="outline">
                                    Difficulty: {getDifficultyLabel(clampDifficulty(sectionDifficulty))}
                                </Badge>
                            )}
                            {sectionSubject && (
                                <Badge variant="secondary">{sectionSubject}</Badge>
                            )}
                            {sectionFormat && (
                                <Badge variant="secondary" className="capitalize">{sectionFormat.replace(/_/g, " ")}</Badge>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2 ">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={openEdit} 
                            className="mb-0.5 rounded-xl shrink-0" 
                        >
                            <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                            variant="ghost" size="icon" 
                            className="text-destructive mb-0.5 rounded-xl shrink-0" 
                            onClick={onRemoveConfirmation}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                {markingScheme && (
                    <div className="flex gap-2 items-center">
                        <h6 className="text-sm font-medium">Marking Scheme:</h6>
                        <div className="flex gap-4 mt-1">
                            <Badge variant="secondary">Correct: {markingScheme.correct} pts</Badge>
                            <Badge variant="secondary">Incorrect: {markingScheme.incorrect} pts</Badge>
                            <Badge variant="secondary">Unanswered: {markingScheme.unanswered} pts</Badge>
                        </div>
                    </div>
                )}
                <div>
                    <h6 className="text-sm font-medium mt-2">
                        Section Topics:
                        <div className="border flex gap-2 p-2 mt-1 rounded-lg flex-wrap">
                            {(sectionTopics || []).length === 0 ? (
                                <span className="text-xs text-muted-foreground">No topics selected</span>
                            ) : (
                                (sectionTopics || []).map((topic) => (
                                    <Badge key={`${sectionId}-${topic}`} variant="secondary">
                                        {topic}
                                    </Badge>
                                ))
                            )}
                        </div>
                    </h6>
                </div>
            </div>
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Section</DialogTitle>
                        <DialogDescription>
                            Update section details, difficulty, and topic mapping.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Section Name</Label>
                                <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Question Count</Label>
                                <Input
                                    type="number"
                                    value={draftQuestionsCount}
                                    onChange={(e) => setDraftQuestionsCount(e.target.value)}
                                    min={0}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Attempt Limit</Label>
                                <Input
                                    type="number"
                                    value={draftAttemptLimit}
                                    onChange={(e) => setDraftAttemptLimit(e.target.value)}
                                    min={0}
                                    placeholder="All"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Time Limit (minutes)</Label>
                                <Input
                                    type="number"
                                    value={draftDurationMinutes}
                                    onChange={(e) => setDraftDurationMinutes(e.target.value)}
                                    min={0}
                                    placeholder="Optional"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Difficulty</Label>
                            <div className="flex items-center gap-3">
                                <Slider
                                    value={[draftDifficultyLevel]}
                                    onValueChange={(v) => setDraftDifficultyLevel(clampDifficulty(v[0]))}
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    className="flex-1"
                                />
                                <span className={`text-xs font-semibold min-w-[70px] text-right ${getDifficultyColor(draftDifficultyLevel)}`}>
                                    {draftDifficultyLevel.toFixed(2)} — {getDifficultyLabel(draftDifficultyLevel)}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Topics</Label>
                            <TopicMultiSelect
                                selectedTopics={draftTopics}
                                setSelectedTopics={setDraftTopics}
                                placeholder="Search and select topics for this section..."
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Subject</Label>
                                {availableSubjects && availableSubjects.length > 0 ? (
                                    <Select value={draftSubject} onValueChange={setDraftSubject}>
                                        <SelectTrigger><SelectValue placeholder="Any subject" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">Any subject</SelectItem>
                                            {availableSubjects.map((s) => (
                                                <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Input value={draftSubject} onChange={(e) => setDraftSubject(e.target.value)} placeholder="e.g. Physics" />
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label>Question Format</Label>
                                <Select value={draftFormat} onValueChange={setDraftFormat}>
                                    <SelectTrigger><SelectValue placeholder="Any format" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">Any format</SelectItem>
                                        {QUESTION_FORMATS.map((f) => (
                                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Tags</Label>
                            <div className="flex flex-wrap gap-1 mb-1">
                                {draftTags.map((tag) => (
                                    <Badge key={tag} variant="secondary" className="gap-1">
                                        {tag}
                                        <button onClick={() => setDraftTags(prev => prev.filter(t => t !== tag))}>
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                            <Input
                                value={draftTagInput}
                                onChange={(e) => setDraftTagInput(e.target.value)}
                                onKeyDown={handleTagKeyDown}
                                onBlur={() => draftTagInput.trim() && addTag(draftTagInput)}
                                placeholder="Type a tag and press Enter or comma"
                            />
                        </div>

                        <div className="space-y-3 rounded-xl border p-3">
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={draftMarkingEnabled}
                                    onCheckedChange={(checked) => setDraftMarkingEnabled(checked)}
                                />
                                <Label className="text-sm">Custom Marking Scheme</Label>
                            </div>
                            {draftMarkingEnabled && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Correct</Label>
                                        <Input
                                            type="number"
                                            value={draftMarkingScheme.correct}
                                            onChange={(e) =>
                                                setDraftMarkingScheme((prev) => ({
                                                    ...prev,
                                                    correct: Number(e.target.value),
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Incorrect</Label>
                                        <Input
                                            type="number"
                                            value={draftMarkingScheme.incorrect}
                                            onChange={(e) =>
                                                setDraftMarkingScheme((prev) => ({
                                                    ...prev,
                                                    incorrect: Number(e.target.value),
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Unanswered</Label>
                                        <Input
                                            type="number"
                                            value={draftMarkingScheme.unanswered}
                                            onChange={(e) =>
                                                setDraftMarkingScheme((prev) => ({
                                                    ...prev,
                                                    unanswered: Number(e.target.value),
                                                }))
                                            }
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                            <Button
                                className="gradient-bg text-white"
                                onClick={() => {
                                    const normalizedQuestions = Math.max(0, Number(draftQuestionsCount) || 0);
                                    const attemptLimitValue = draftAttemptLimit.trim() === ""
                                        ? null
                                        : Math.max(0, Number(draftAttemptLimit) || 0);
                                    const durationValue = draftDurationMinutes.trim() === ""
                                        ? null
                                        : Math.max(0, Number(draftDurationMinutes) || 0);
                                    const nextMarking = draftMarkingEnabled
                                        ? {
                                            correct: Number(draftMarkingScheme.correct) || 0,
                                            incorrect: Number(draftMarkingScheme.incorrect) || 0,
                                            unanswered: Number(draftMarkingScheme.unanswered) || 0,
                                        }
                                        : null;

                                    onEdit?.({
                                        name: draftName.trim() || sectionName,
                                        questionsCount: normalizedQuestions,
                                        attemptLimit: attemptLimitValue,
                                        durationMinutes: durationValue,
                                        difficultyLevel: clampDifficulty(draftDifficultyLevel),
                                        topics: draftTopics,
                                        markingScheme: nextMarking,
                                        subject: draftSubject,
                                        tags: draftTags,
                                        format: draftFormat,
                                    });
                                    setEditOpen(false);
                                }}
                            >
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    )
}

export default SectionCard