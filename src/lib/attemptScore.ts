const CORRECT_MARKS = 5;
const INCORRECT_MARKS = 1;

export function resolveAttemptScore(data: {
  score?: any;
  maxScore?: any;
  correctCount?: any;
  incorrectCount?: any;
  unansweredCount?: any;
}): { score: number; maxScore: number } {
  const correctCount = Number(data.correctCount ?? 0);
  const incorrectCount = Number(data.incorrectCount ?? 0);
  const unansweredCount = Number(data.unansweredCount ?? 0);
  const hasCountData = correctCount > 0 || incorrectCount > 0 || unansweredCount > 0;

  if (hasCountData) {
    const totalQuestions = correctCount + incorrectCount + unansweredCount;
    return {
      score: correctCount * CORRECT_MARKS - incorrectCount * INCORRECT_MARKS,
      maxScore: totalQuestions * CORRECT_MARKS,
    };
  }

  return {
    score: Number(data.score ?? 0),
    maxScore: Number(data.maxScore ?? 0),
  };
}
