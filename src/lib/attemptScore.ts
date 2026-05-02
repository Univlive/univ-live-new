const CORRECT_MARKS = 5;
const INCORRECT_MARKS = 1;

export function resolveAttemptScore(data: {
  score?: any;
  maxScore?: any;
  correctCount?: any;
  incorrectCount?: any;
  unansweredCount?: any;
  accuracy?: any;
}): { score: number; maxScore: number; accuracy: number } {
  const correctCount = Number(data.correctCount ?? 0);
  const incorrectCount = Number(data.incorrectCount ?? 0);
  const unansweredCount = Number(data.unansweredCount ?? 0);
  const hasCountData = correctCount > 0 || incorrectCount > 0 || unansweredCount > 0;

  if (hasCountData) {
    const totalQuestions = correctCount + incorrectCount + unansweredCount;
    const score = correctCount * CORRECT_MARKS - incorrectCount * INCORRECT_MARKS;
    const maxScore = totalQuestions * CORRECT_MARKS;
    const accuracy = Math.round((correctCount / Math.max(1, totalQuestions)) * 100);
    return { score, maxScore, accuracy };
  }

  const score = Number(data.score ?? 0);
  const maxScore = Number(data.maxScore ?? 0);

  let accuracy = 0;
  if (data.accuracy != null) {
    const n = Number(data.accuracy);
    if (Number.isFinite(n)) {
      accuracy = Math.max(0, Math.min(100, Math.round(n <= 1.01 ? n * 100 : n)));
    }
  }
  if (!accuracy && maxScore > 0) {
    accuracy = Math.max(0, Math.min(100, Math.round((score / maxScore) * 100)));
  }

  return { score, maxScore, accuracy };
}
