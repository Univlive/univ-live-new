import { Clock, FileText, Lock, Unlock, Play, Eye } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Test } from "@/mock/studentMock";
import { useTenant } from "@/contexts/TenantProvider";

interface TestCardProps {
  test: Test;
  attemptsUsed?: number;
  onView: (testId: string) => void;
  onStart: (testId: string) => void;
  onUnlock: (testId: string) => void;
}

const difficultyColors = {
  Easy: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  Hard: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const subjectColors: Record<string, string> = {
  "General Test": "bg-pastel-mint",
  "English": "bg-pastel-lavender",
  "Mathematics": "bg-pastel-yellow",
  "Physics": "bg-pastel-peach",
  "Chemistry": "bg-pastel-pink",
  "Biology": "bg-pastel-cream",
};

export function TestCard({ test, attemptsUsed = 0, onView, onStart, onUnlock }: TestCardProps) {
  const { tenant } = useTenant();
  const parseNum = (value: unknown, fallback: number) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  // Firestore docs may miss attempts fields on some tests; use safe defaults.
  const attemptsAllowed = Math.max(
    1,
    parseNum((test as any).attemptsAllowed ?? (test as any).maxAttempts, tenant?.testDefaults?.attemptsAllowed ?? 3)
  );
  const attemptsUsedSafe = Math.max(0, parseNum(attemptsUsed, 0));
  const attemptsRemaining = Math.max(0, attemptsAllowed - attemptsUsedSafe);

  return (
    <Card className={cn(
      "card-soft card-hover border-0 overflow-hidden",
      subjectColors[test.subject] || "bg-pastel-cream"
    )}>
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground line-clamp-2">{test.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{test.subject}</p>
          </div>
          {test.isLocked ? (
            <div className="p-2 rounded-lg bg-destructive/10">
              <Lock className="h-4 w-4 text-destructive" />
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-green-500/10">
              <Unlock className="h-4 w-4 text-green-600" />
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="rounded-full bg-background/60">
            <Clock className="h-3 w-3 mr-1" />
            {test.duration} min
          </Badge>
          <Badge variant="secondary" className="rounded-full bg-background/60">
            <FileText className="h-3 w-3 mr-1" />
            {test.questionsCount} Q
          </Badge>
          <Badge className={cn("rounded-full", difficultyColors[test.difficulty])}>
            {test.difficulty}
          </Badge>
        </div>

        {/* Attempts Info */}
        {!test.isLocked && (
          <div className="text-xs text-muted-foreground">
            {attemptsRemaining > 0 ? (
              <span>{attemptsRemaining} attempt{attemptsRemaining > 1 ? 's' : ''} remaining</span>
            ) : (
              <span className="text-destructive">No attempts remaining</span>
            )}
          </div>
        )}

        {/* Price */}
        {test.isLocked && test.price > 0 && (
          <div className="text-sm font-semibold text-primary">₹{test.price}</div>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-0 gap-2">
        {test.isLocked ? (
          <Button 
            className="w-full rounded-xl gradient-bg" 
            onClick={() => onUnlock(test.id)}
          >
            <Lock className="h-4 w-4 mr-2" />
            Unlock
          </Button>
        ) : (
          <>
            <Button 
              variant="outline" 
              className="flex-1 rounded-xl bg-background/60"
              onClick={() => onView(test.id)}
            >
              <Eye className="h-4 w-4 mr-2" />
              View
            </Button>
            <Button 
              className="flex-1 rounded-xl gradient-bg"
              onClick={() => onStart(test.id)}
              disabled={attemptsRemaining <= 0}
            >
              <Play className="h-4 w-4 mr-2" />
              Start
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
