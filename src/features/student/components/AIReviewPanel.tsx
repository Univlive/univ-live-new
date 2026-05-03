import { motion } from "framer-motion";
import { Sparkles, CheckCircle, AlertCircle, Lightbulb, BookOpen, Loader2, TrendingUp, Book, Target, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Badge } from "@shared/ui/badge";
import { Progress } from "@shared/ui/progress";
import { cn } from "@shared/lib/utils";
import { AIReview } from "@features/student/types";

interface Prerequisite {
  topic: string;
  importance: "high" | "medium" | "low";
  relatedQuestions: string[];
  description: string;
}

interface TopicMapping {
  topic: string;
  questionsItCovers: string[];
  estimatedMarksGain: number;
  difficulty: "beginner" | "intermediate" | "advanced";
}

interface MarksProjection {
  currentScore: number;
  potentialScore: number;
  improvementAreas: Array<{
    topic: string;
    possibleMarksGain: number;
    effort: "easy" | "medium" | "hard";
  }>;
}

interface ExtendedAIReview extends AIReview {
  prerequisites?: Prerequisite[];
  topicMapping?: TopicMapping[];
  marksProjection?: MarksProjection;
}

interface AIReviewPanelProps {
  status: "queued" | "in-progress" | "completed" | "failed";
  review?: ExtendedAIReview | AIReview;
  className?: string;
  progress?: string | null;
  error?: string | null;
  onCancel?: () => void;
}

export function AIReviewPanel({ status, review, className, progress, error, onCancel }: AIReviewPanelProps) {
  if (status === "queued") {
    return (
      <Card className={cn("card-soft border-0 bg-pastel-lavender", className)}>
        <CardContent className="p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">AI Review Queued</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your personalized analysis will be ready in approximately 2 minutes.
            </p>
          </div>
          <Progress value={0} className="h-2" />
        </CardContent>
      </Card>
    );
  }

  if (status === "in-progress") {
    return (
      <Card className={cn("card-soft border-0 bg-pastel-yellow", className)}>
        <CardContent className="p-6 space-y-4">
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto"
            >
              <Loader2 className="h-8 w-8 text-primary" />
            </motion.div>
            <div className="mt-4">
              <h3 className="font-semibold text-lg">AI Analyzing Your Performance</h3>
              {progress ? (
                <p className="text-sm text-muted-foreground mt-2">{progress}</p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  Our AI is reviewing your answers and preparing personalized feedback...
                </p>
              )}
            </div>
          </div>
          <Progress value={65} className="h-2" />
          {onCancel && (
            <div className="text-center pt-2">
              <button
                onClick={onCancel}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Cancel
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (status === "failed") {
    return (
      <Card className={cn("card-soft border-0 bg-pastel-peach", className)}>
        <CardContent className="p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Analysis Failed</h3>
            {error ? (
              <p className="text-sm text-destructive mt-2">{error}</p>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">
                Something went wrong. Please try again later.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Completed state
  if (!review) return null;

  const extendedReview = review as ExtendedAIReview;

  return (
    <div className={cn("space-y-6", className)}>
      <Card className="card-soft border-0">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl gradient-bg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">AI Performance Review</CardTitle>
              <Badge variant="secondary" className="mt-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle className="h-3 w-3 mr-1" />
                Completed
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overall Analysis */}
          <div className="p-4 rounded-xl bg-pastel-mint">
            <p className="text-sm text-foreground">{review.overallAnalysis}</p>
          </div>

          {/* Strengths */}
          <div>
            <h4 className="font-semibold flex items-center gap-2 text-green-600 mb-3">
              <CheckCircle className="h-4 w-4" />
              Strengths
            </h4>
            <ul className="space-y-2">
              {review.strengths.map((strength, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-2 text-sm"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                  <span>{strength}</span>
                </motion.li>
              ))}
            </ul>
          </div>

          {/* Weak Areas */}
          <div>
            <h4 className="font-semibold flex items-center gap-2 text-orange-600 mb-3">
              <AlertCircle className="h-4 w-4" />
              Areas to Improve
            </h4>
            <ul className="space-y-2">
              {review.weakAreas.map((area, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 + 0.3 }}
                  className="flex items-start gap-2 text-sm"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2 flex-shrink-0" />
                  <span>{area}</span>
                </motion.li>
              ))}
            </ul>
          </div>

          {/* Suggestions */}
          <div>
            <h4 className="font-semibold flex items-center gap-2 text-primary mb-3">
              <Lightbulb className="h-4 w-4" />
              Suggestions
            </h4>
            <ul className="space-y-2">
              {review.suggestions.map((suggestion, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 + 0.6 }}
                  className="flex items-start gap-2 text-sm"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span>{suggestion}</span>
                </motion.li>
              ))}
            </ul>
          </div>

          {/* Next Test Recommendations */}
          <div>
            <h4 className="font-semibold flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4" />
              Recommended Next Tests
            </h4>
            <div className="flex flex-wrap gap-2">
              {review.nextTestRecommendations.map((test, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="rounded-full bg-pastel-lavender cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  {test}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prerequisites Section */}
      {extendedReview.prerequisites && extendedReview.prerequisites.length > 0 && (
        <Card className="card-soft border-0 bg-gradient-to-br from-pastel-yellow/30 to-pastel-peach/30">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-5 w-5 text-orange-600" />
              Key Prerequisites Missing
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              These foundational concepts caused your incorrect answers:
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {extendedReview.prerequisites.map((prereq, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="p-3 rounded-lg bg-white/50 dark:bg-slate-900/50 border border-orange-200 dark:border-orange-900/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h5 className="font-semibold text-sm">{prereq.topic}</h5>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs rounded-full",
                          prereq.importance === "high"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30"
                            : prereq.importance === "medium"
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30"
                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30"
                        )}
                      >
                        {prereq.importance.charAt(0).toUpperCase() + prereq.importance.slice(1)} Impact
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{prereq.description}</p>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-medium">Related Questions:</span> {prereq.relatedQuestions.join(", ")}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Topic Mapping Section */}
      {extendedReview.topicMapping && extendedReview.topicMapping.length > 0 && (
        <Card className="card-soft border-0 bg-gradient-to-br from-pastel-lavender/30 to-pastel-mint/30">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Book className="h-5 w-5 text-blue-600" />
              Topics to Master
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Topics that directly address your weak areas and their potential mark gains:
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {extendedReview.topicMapping.map((topic, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="p-3 rounded-lg bg-white/50 dark:bg-slate-900/50 border border-blue-200 dark:border-blue-900/30"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="font-semibold text-sm">{topic.topic}</h5>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs rounded-full",
                            topic.difficulty === "beginner"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30"
                              : topic.difficulty === "intermediate"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30"
                              : "bg-purple-100 text-purple-700 dark:bg-purple-900/30"
                          )}
                        >
                          {topic.difficulty.charAt(0).toUpperCase() + topic.difficulty.slice(1)}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                        <span className="font-medium">Covers:</span> {topic.questionsItCovers.join(", ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-green-600">+{topic.estimatedMarksGain} marks</div>
                      <div className="text-xs text-muted-foreground">potential gain</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Marks Projection Section */}
      {extendedReview.marksProjection && (
        <Card className="card-soft border-0 bg-gradient-to-br from-pastel-mint/30 to-pastel-lavender/30">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Your Improvement Potential
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center p-3 rounded-lg bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
              >
                <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">
                  {extendedReview.marksProjection.currentScore}
                </div>
                <div className="text-xs text-muted-foreground">Current Score</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/30"
              >
                <div className="text-2xl font-bold text-green-600">
                  +{extendedReview.marksProjection.potentialScore - extendedReview.marksProjection.currentScore}
                </div>
                <div className="text-xs text-muted-foreground">Possible Gain</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/30"
              >
                <div className="text-2xl font-bold text-blue-600">
                  {extendedReview.marksProjection.potentialScore}
                </div>
                <div className="text-xs text-muted-foreground">Potential Score</div>
              </motion.div>
            </div>

            <div className="space-y-3">
              <h5 className="font-semibold text-sm">How to Improve:</h5>
              {extendedReview.marksProjection.improvementAreas.map((area, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="p-3 rounded-lg bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{area.topic}</span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs rounded-full",
                          area.effort === "easy"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30"
                            : area.effort === "medium"
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30"
                        )}
                      >
                        {area.effort === "easy" ? (
                          <>
                            <Zap className="h-3 w-3 mr-1" /> Easy
                          </>
                        ) : (
                          area.effort.charAt(0).toUpperCase() + area.effort.slice(1)
                        )}
                      </Badge>
                    </div>
                    <div className="text-sm font-semibold text-green-600">+{area.possibleMarksGain}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
