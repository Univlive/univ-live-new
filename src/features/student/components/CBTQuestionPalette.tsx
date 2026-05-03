import { cn } from "@shared/lib/utils";

interface QuestionStatus {
  answered: boolean;
  markedForReview: boolean;
  visited: boolean;
}

interface CBTQuestionPaletteProps {
  questions: { id: string; sectionId: string }[];
  responses: Record<string, QuestionStatus>;
  currentQuestionIndex: number;
  onQuestionClick: (index: number) => void;
  sections?: { id: string; name: string }[];
  currentSectionId?: string;
}

export function CBTQuestionPalette({
  questions,
  responses,
  currentQuestionIndex,
  onQuestionClick,
  sections,
  currentSectionId,
}: CBTQuestionPaletteProps) {
  const filteredQuestions = currentSectionId
    ? questions.filter((q) => q.sectionId === currentSectionId)
    : questions;

  const getQuestionIndex = (questionId: string) => {
    return questions.findIndex((q) => q.id === questionId);
  };

  const getStatusClass = (questionId: string, globalIndex: number) => {
    const status = responses[questionId];
    const isCurrent = globalIndex === currentQuestionIndex;

    if (isCurrent) {
      return "ring-2 ring-primary ring-offset-2";
    }

    if (status?.answered && status?.markedForReview) {
      return "bg-purple-500 text-white"; // Answered + Marked
    }
    if (status?.markedForReview) {
      return "bg-purple-500/50 text-white"; // Marked only
    }
    if (status?.answered) {
      return "bg-green-500 text-white"; // Answered
    }
    if (status?.visited) {
      return "bg-red-400 text-white"; // Visited but not answered
    }
    return "bg-muted text-muted-foreground"; // Not visited
  };

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-muted" />
          <span>Not Visited</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-400" />
          <span>Not Answered</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-500" />
          <span>Answered</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-purple-500" />
          <span>Marked for Review</span>
        </div>
      </div>

      {/* Section Label */}
      {sections && currentSectionId && (
        <div className="text-sm font-medium text-muted-foreground">
          {sections.find((s) => s.id === currentSectionId)?.name}
        </div>
      )}

      {/* Question Grid */}
      <div className="grid grid-cols-5 gap-2">
        {filteredQuestions.map((question, localIndex) => {
          const globalIndex = getQuestionIndex(question.id);
          return (
            <button
              key={question.id}
              onClick={() => onQuestionClick(globalIndex)}
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-all hover:scale-105",
                getStatusClass(question.id, globalIndex)
              )}
            >
              {localIndex + 1}
            </button>
          );
        })}
      </div>

      {/* Summary */}
      <div className="pt-4 border-t border-border space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Answered</span>
          <span className="font-medium">
            {Object.values(responses).filter((r) => r.answered).length}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Not Answered</span>
          <span className="font-medium">
            {Object.values(responses).filter((r) => r.visited && !r.answered).length}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Marked for Review</span>
          <span className="font-medium">
            {Object.values(responses).filter((r) => r.markedForReview).length}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Not Visited</span>
          <span className="font-medium">
            {Object.values(responses).filter((r) => !r.visited).length}
          </span>
        </div>
      </div>
    </div>
  );
}
