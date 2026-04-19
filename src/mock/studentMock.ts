// Student Mock Data for UNIV.LIVE
// This file can be replaced with Firebase/Supabase calls later

export interface StudentProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  batch: string;
  avatar: string;
  joinedAt: string;
  coachingName: string;
}

export interface Test {
  id: string;
  title: string;
  subject: string;
  duration: number; // minutes
  questionsCount: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  isLocked: boolean;
  price: number;
  windowExpiresAt?: number | null;
  attemptsAllowed: number;
  attemptsUsed: number;
  sections: TestSection[];
  syllabus: string[];
  markingScheme: {
    correct: number;
    incorrect: number;
    unanswered: number;
  };
}

export interface TestSection {
  id: string;
  name: string;
  questionsCount: number;
  duration?: number;
}

export interface Question {
  id: string;
  sectionId: string;
  type: 'mcq' | 'integer' | 'passage';
  passageId?: string;
  stem: string;
  options?: { id: string; text: string }[];
  correctAnswer: string;
  explanation: string;
  marks: { correct: number; incorrect: number };
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topic: string;
}

export interface Passage {
  id: string;
  title: string;
  content: string;
  questionIds: string[];
}

export interface Attempt {
  id: string;
  testId: string;
  testTitle: string;
  subject: string;
  score: number;
  maxScore: number;
  accuracy: number;
  timeSpent: number; // seconds
  rank: number;
  totalParticipants: number;
  status: 'completed' | 'in-progress' | 'expired';
  createdAt: string;
  completedAt?: string;
  sectionScores: { sectionName: string; score: number; maxScore: number }[];
  aiReviewStatus: 'queued' | 'in-progress' | 'completed' | 'failed';
  aiReview?: AIReview;
}

export interface AIReview {
  strengths: string[];
  weakAreas: string[];
  suggestions: string[];
  nextTestRecommendations: string[];
  overallAnalysis: string;
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  name: string;
  avatar: string;
  score: number;
  accuracy: number;
  timeTaken: number;
  rankChange: number; // positive = up, negative = down
  isCurrentUser: boolean;
}

export interface Message {
  id: string;
  from: 'student' | 'support' | 'coaching';
  senderName: string;
  content: string;
  timestamp: string;
  read: boolean;
}

export interface Thread {
  id: string;
  subject: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  status: 'open' | 'resolved' | 'in-progress';
}

// Student Profile
export const studentProfile: StudentProfile = {
  id: "std_001",
  name: "Rahul Kumar",
  email: "rahul.kumar@example.com",
  phone: "+91 98765 43210",
  batch: "CUET 2025 - Batch A",
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=rahul",
  joinedAt: "2024-08-15",
  coachingName: "Sharma Academy"
};

// Available Tests
export const availableTests: Test[] = [
  {
    id: "test_001",
    title: "CUET General Test - Full Mock 1",
    subject: "General Test",
    duration: 60,
    questionsCount: 75,
    difficulty: "Medium",
    isLocked: false,
    price: 0,
    attemptsAllowed: 3,
    attemptsUsed: 1,
    sections: [
      { id: "sec_1", name: "General Knowledge", questionsCount: 25 },
      { id: "sec_2", name: "Current Affairs", questionsCount: 25 },
      { id: "sec_3", name: "General Mental Ability", questionsCount: 25 }
    ],
    syllabus: ["Indian History", "Geography", "Polity", "Economics", "Science", "Current Events 2024"],
    markingScheme: { correct: 5, incorrect: -1, unanswered: 0 }
  },
  {
    id: "test_002",
    title: "CUET English Language - Mock Test 2",
    subject: "English",
    duration: 45,
    questionsCount: 50,
    difficulty: "Easy",
    isLocked: false,
    price: 0,
    attemptsAllowed: 3,
    attemptsUsed: 0,
    sections: [
      { id: "sec_1", name: "Reading Comprehension", questionsCount: 20 },
      { id: "sec_2", name: "Verbal Ability", questionsCount: 15 },
      { id: "sec_3", name: "Grammar", questionsCount: 15 }
    ],
    syllabus: ["Comprehension Passages", "Vocabulary", "Grammar Rules", "Sentence Correction"],
    markingScheme: { correct: 5, incorrect: -1, unanswered: 0 }
  },
  {
    id: "test_003",
    title: "CUET Mathematics - Chapter-wise: Calculus",
    subject: "Mathematics",
    duration: 30,
    questionsCount: 25,
    difficulty: "Hard",
    isLocked: true,
    price: 99,
    attemptsAllowed: 2,
    attemptsUsed: 0,
    sections: [
      { id: "sec_1", name: "Differentiation", questionsCount: 12 },
      { id: "sec_2", name: "Integration", questionsCount: 13 }
    ],
    syllabus: ["Limits", "Derivatives", "Integrals", "Applications"],
    markingScheme: { correct: 4, incorrect: -1, unanswered: 0 }
  },
  {
    id: "test_004",
    title: "CUET Physics - Full Syllabus Mock",
    subject: "Physics",
    duration: 60,
    questionsCount: 50,
    difficulty: "Medium",
    isLocked: true,
    price: 149,
    attemptsAllowed: 3,
    attemptsUsed: 0,
    sections: [
      { id: "sec_1", name: "Mechanics", questionsCount: 15 },
      { id: "sec_2", name: "Electromagnetism", questionsCount: 15 },
      { id: "sec_3", name: "Modern Physics", questionsCount: 10 },
      { id: "sec_4", name: "Thermodynamics", questionsCount: 10 }
    ],
    syllabus: ["Newton's Laws", "Electrostatics", "Magnetism", "Waves", "Optics", "Quantum Physics"],
    markingScheme: { correct: 4, incorrect: -1, unanswered: 0 }
  },
  {
    id: "test_005",
    title: "CUET Chemistry - Organic Chemistry",
    subject: "Chemistry",
    duration: 45,
    questionsCount: 35,
    difficulty: "Medium",
    isLocked: false,
    price: 0,
    attemptsAllowed: 2,
    attemptsUsed: 2,
    sections: [
      { id: "sec_1", name: "Hydrocarbons", questionsCount: 12 },
      { id: "sec_2", name: "Alcohols & Ethers", questionsCount: 12 },
      { id: "sec_3", name: "Carbonyl Compounds", questionsCount: 11 }
    ],
    syllabus: ["IUPAC Nomenclature", "Reaction Mechanisms", "Named Reactions", "Biomolecules"],
    markingScheme: { correct: 4, incorrect: -1, unanswered: 0 }
  },
  {
    id: "test_006",
    title: "CUET Biology - NCERT Based",
    subject: "Biology",
    duration: 50,
    questionsCount: 40,
    difficulty: "Easy",
    isLocked: true,
    price: 79,
    attemptsAllowed: 3,
    attemptsUsed: 0,
    sections: [
      { id: "sec_1", name: "Botany", questionsCount: 20 },
      { id: "sec_2", name: "Zoology", questionsCount: 20 }
    ],
    syllabus: ["Cell Biology", "Genetics", "Ecology", "Human Physiology", "Plant Physiology"],
    markingScheme: { correct: 5, incorrect: -1, unanswered: 0 }
  }
];

// Sample Questions for CBT
export const sampleQuestions: Question[] = [
  {
    id: "q_001",
    sectionId: "sec_1",
    type: "mcq",
    stem: "The Battle of Plassey was fought in which year?",
    options: [
      { id: "a", text: "1757" },
      { id: "b", text: "1764" },
      { id: "c", text: "1857" },
      { id: "d", text: "1947" }
    ],
    correctAnswer: "a",
    explanation: "The Battle of Plassey was fought on 23 June 1757 between the British East India Company and the Nawab of Bengal, Siraj ud-Daulah.",
    marks: { correct: 5, incorrect: -1 },
    difficulty: "Easy",
    topic: "Indian History"
  },
  {
    id: "q_002",
    sectionId: "sec_1",
    type: "mcq",
    stem: "Which of the following is NOT a fundamental right in the Indian Constitution?",
    options: [
      { id: "a", text: "Right to Equality" },
      { id: "b", text: "Right to Property" },
      { id: "c", text: "Right to Freedom" },
      { id: "d", text: "Right against Exploitation" }
    ],
    correctAnswer: "b",
    explanation: "Right to Property was removed from the list of Fundamental Rights by the 44th Constitutional Amendment Act, 1978.",
    marks: { correct: 5, incorrect: -1 },
    difficulty: "Medium",
    topic: "Indian Polity"
  },
  {
    id: "q_003",
    sectionId: "sec_2",
    type: "mcq",
    stem: "Who was appointed as the new Chief Justice of India in 2024?",
    options: [
      { id: "a", text: "Justice D.Y. Chandrachud" },
      { id: "b", text: "Justice N.V. Ramana" },
      { id: "c", text: "Justice Sanjiv Khanna" },
      { id: "d", text: "Justice B.R. Gavai" }
    ],
    correctAnswer: "c",
    explanation: "Justice Sanjiv Khanna was appointed as the 51st Chief Justice of India in November 2024.",
    marks: { correct: 5, incorrect: -1 },
    difficulty: "Easy",
    topic: "Current Affairs"
  },
  {
    id: "q_004",
    sectionId: "sec_3",
    type: "integer",
    stem: "If the sum of the first n natural numbers is 210, what is the value of n?",
    correctAnswer: "20",
    explanation: "Using the formula n(n+1)/2 = 210, we get n² + n - 420 = 0. Solving this quadratic equation: (n+21)(n-20) = 0. Since n must be positive, n = 20.",
    marks: { correct: 5, incorrect: -1 },
    difficulty: "Medium",
    topic: "Mental Ability"
  },
  {
    id: "q_005",
    sectionId: "sec_3",
    type: "mcq",
    stem: "Find the next number in the series: 2, 6, 12, 20, 30, ?",
    options: [
      { id: "a", text: "40" },
      { id: "b", text: "42" },
      { id: "c", text: "44" },
      { id: "d", text: "46" }
    ],
    correctAnswer: "b",
    explanation: "The differences are 4, 6, 8, 10, 12... (increasing by 2). So next difference is 12, making the answer 30 + 12 = 42.",
    marks: { correct: 5, incorrect: -1 },
    difficulty: "Easy",
    topic: "Number Series"
  },
  {
    id: "q_006",
    sectionId: "sec_1",
    type: "passage",
    passageId: "p_001",
    stem: "According to the passage, what was the primary reason for the decline of the Indus Valley Civilization?",
    options: [
      { id: "a", text: "Foreign invasion" },
      { id: "b", text: "Climate change and drought" },
      { id: "c", text: "Epidemic disease" },
      { id: "d", text: "Internal civil war" }
    ],
    correctAnswer: "b",
    explanation: "The passage mentions climate change leading to the drying up of rivers as the primary factor.",
    marks: { correct: 5, incorrect: -1 },
    difficulty: "Medium",
    topic: "Ancient History"
  },
  {
    id: "q_007",
    sectionId: "sec_1",
    type: "mcq",
    stem: "The Tropic of Cancer passes through how many Indian states?",
    options: [
      { id: "a", text: "6" },
      { id: "b", text: "7" },
      { id: "c", text: "8" },
      { id: "d", text: "9" }
    ],
    correctAnswer: "c",
    explanation: "The Tropic of Cancer passes through 8 Indian states: Gujarat, Rajasthan, Madhya Pradesh, Chhattisgarh, Jharkhand, West Bengal, Tripura, and Mizoram.",
    marks: { correct: 5, incorrect: -1 },
    difficulty: "Medium",
    topic: "Geography"
  },
  {
    id: "q_008",
    sectionId: "sec_2",
    type: "mcq",
    stem: "Which country hosted the G20 Summit in 2024?",
    options: [
      { id: "a", text: "India" },
      { id: "b", text: "Brazil" },
      { id: "c", text: "South Africa" },
      { id: "d", text: "Indonesia" }
    ],
    correctAnswer: "b",
    explanation: "Brazil hosted the G20 Summit in 2024, following India's presidency in 2023.",
    marks: { correct: 5, incorrect: -1 },
    difficulty: "Easy",
    topic: "Current Affairs"
  }
];

// Passages for passage-based questions
export const passages: Passage[] = [
  {
    id: "p_001",
    title: "The Decline of Indus Valley Civilization",
    content: `The Indus Valley Civilization, one of the world's earliest urban civilizations, flourished between 2600 BCE and 1900 BCE. Recent archaeological and geological studies suggest that climate change played a crucial role in its decline.

The civilization depended heavily on the seasonal monsoons and the Ghaggar-Hakra river system. Around 2000 BCE, significant climate shifts led to weakening monsoons and the gradual drying of rivers. This resulted in decreased agricultural productivity, forcing populations to migrate eastward toward the Ganges basin.

While earlier theories emphasized Aryan invasion as the cause, modern research points to a more gradual decline driven by environmental factors. The cities were not destroyed suddenly but were slowly abandoned as water resources became scarce.`,
    questionIds: ["q_006"]
  }
];

// Student Attempts
export const attempts: Attempt[] = [
  {
    id: "att_001",
    testId: "test_001",
    testTitle: "CUET General Test - Full Mock 1",
    subject: "General Test",
    score: 285,
    maxScore: 375,
    accuracy: 76,
    timeSpent: 3420,
    rank: 12,
    totalParticipants: 156,
    status: "completed",
    createdAt: "2024-12-20T10:30:00Z",
    completedAt: "2024-12-20T11:27:00Z",
    sectionScores: [
      { sectionName: "General Knowledge", score: 95, maxScore: 125 },
      { sectionName: "Current Affairs", score: 105, maxScore: 125 },
      { sectionName: "General Mental Ability", score: 85, maxScore: 125 }
    ],
    aiReviewStatus: "completed",
    aiReview: {
      strengths: [
        "Excellent grasp of Current Affairs - scored above 80%",
        "Strong performance in General Knowledge section",
        "Good time management - completed with 3 minutes to spare"
      ],
      weakAreas: [
        "Mental Ability section needs improvement",
        "Logical reasoning questions took more time",
        "Number series patterns were challenging"
      ],
      suggestions: [
        "Practice 10 mental ability questions daily",
        "Focus on number series and pattern recognition",
        "Review logical reasoning techniques",
        "Take sectional tests for Mental Ability"
      ],
      nextTestRecommendations: [
        "CUET General Test - Mock 2",
        "Mental Ability Chapter Test",
        "Current Affairs Weekly Quiz"
      ],
      overallAnalysis: "Good performance with room for improvement in Mental Ability. Your Current Affairs preparation is strong. Focus on logical reasoning to boost overall score."
    }
  },
  {
    id: "att_002",
    testId: "test_005",
    testTitle: "CUET Chemistry - Organic Chemistry",
    subject: "Chemistry",
    score: 98,
    maxScore: 140,
    accuracy: 70,
    timeSpent: 2580,
    rank: 25,
    totalParticipants: 89,
    status: "completed",
    createdAt: "2024-12-18T14:00:00Z",
    completedAt: "2024-12-18T14:43:00Z",
    sectionScores: [
      { sectionName: "Hydrocarbons", score: 36, maxScore: 48 },
      { sectionName: "Alcohols & Ethers", score: 32, maxScore: 48 },
      { sectionName: "Carbonyl Compounds", score: 30, maxScore: 44 }
    ],
    aiReviewStatus: "completed",
    aiReview: {
      strengths: [
        "Good understanding of Hydrocarbons",
        "IUPAC nomenclature is well practiced",
        "Completed within time limit"
      ],
      weakAreas: [
        "Carbonyl compounds reactions need work",
        "Named reactions recall was weak",
        "Some mechanism steps were missed"
      ],
      suggestions: [
        "Revise named reactions with flash cards",
        "Practice mechanism-based questions",
        "Focus on carbonyl compound conversions"
      ],
      nextTestRecommendations: [
        "CUET Chemistry - Inorganic Chemistry",
        "Organic Chemistry - Named Reactions Quiz"
      ],
      overallAnalysis: "Solid foundation in organic chemistry. Named reactions and mechanisms need more practice for higher accuracy."
    }
  },
  {
    id: "att_003",
    testId: "test_005",
    testTitle: "CUET Chemistry - Organic Chemistry",
    subject: "Chemistry",
    score: 112,
    maxScore: 140,
    accuracy: 80,
    timeSpent: 2700,
    rank: 8,
    totalParticipants: 92,
    status: "completed",
    createdAt: "2024-12-15T09:30:00Z",
    completedAt: "2024-12-15T10:15:00Z",
    sectionScores: [
      { sectionName: "Hydrocarbons", score: 40, maxScore: 48 },
      { sectionName: "Alcohols & Ethers", score: 38, maxScore: 48 },
      { sectionName: "Carbonyl Compounds", score: 34, maxScore: 44 }
    ],
    aiReviewStatus: "completed",
    aiReview: {
      strengths: [
        "Significant improvement from previous attempt",
        "Hydrocarbons section mastered",
        "Better time distribution across sections"
      ],
      weakAreas: [
        "Still some gaps in carbonyl chemistry",
        "Few careless mistakes in alcohols section"
      ],
      suggestions: [
        "Focus on error analysis to reduce careless mistakes",
        "Complete remaining carbonyl compound topics"
      ],
      nextTestRecommendations: [
        "CUET Chemistry - Full Syllabus Mock"
      ],
      overallAnalysis: "Excellent improvement! 10% accuracy increase from previous attempt. Ready for full syllabus tests."
    }
  },
  {
    id: "att_004",
    testId: "test_002",
    testTitle: "CUET English Language - Mock Test 2",
    subject: "English",
    score: 0,
    maxScore: 250,
    accuracy: 0,
    timeSpent: 1200,
    rank: 0,
    totalParticipants: 0,
    status: "in-progress",
    createdAt: "2024-12-22T16:00:00Z",
    sectionScores: [],
    aiReviewStatus: "queued"
  }
];

// Analytics Data
export const scoreTrend = [
  { attempt: 1, score: 62, date: "Dec 1" },
  { attempt: 2, score: 68, date: "Dec 5" },
  { attempt: 3, score: 65, date: "Dec 8" },
  { attempt: 4, score: 72, date: "Dec 12" },
  { attempt: 5, score: 70, date: "Dec 15" },
  { attempt: 6, score: 80, date: "Dec 18" },
  { attempt: 7, score: 76, date: "Dec 20" },
  { attempt: 8, score: 78, date: "Dec 21" },
  { attempt: 9, score: 82, date: "Dec 22" },
  { attempt: 10, score: 85, date: "Dec 23" }
];

export const subjectPerformance = [
  { subject: "General Test", score: 76, attempts: 3 },
  { subject: "English", score: 82, attempts: 2 },
  { subject: "Mathematics", score: 68, attempts: 4 },
  { subject: "Physics", score: 72, attempts: 3 },
  { subject: "Chemistry", score: 75, attempts: 5 },
  { subject: "Biology", score: 80, attempts: 2 }
];

export const timeOfDayData = [
  { hour: "6 AM", attempts: 2 },
  { hour: "8 AM", attempts: 5 },
  { hour: "10 AM", attempts: 8 },
  { hour: "12 PM", attempts: 3 },
  { hour: "2 PM", attempts: 6 },
  { hour: "4 PM", attempts: 7 },
  { hour: "6 PM", attempts: 9 },
  { hour: "8 PM", attempts: 4 },
  { hour: "10 PM", attempts: 2 }
];

export const weeklyFocusPlan = [
  { task: "Complete 2 General Test mocks", done: true },
  { task: "Revise Mental Ability - Number Series", done: true },
  { task: "Practice English Reading Comprehension", done: false },
  { task: "Complete Chemistry Named Reactions", done: false },
  { task: "Take 1 Physics sectional test", done: false }
];

// Leaderboard
export const leaderboard: LeaderboardEntry[] = [
  { rank: 1, studentId: "std_010", name: "Priya Sharma", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=priya", score: 345, accuracy: 92, timeTaken: 3200, rankChange: 0, isCurrentUser: false },
  { rank: 2, studentId: "std_015", name: "Amit Patel", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=amit", score: 332, accuracy: 89, timeTaken: 3100, rankChange: 2, isCurrentUser: false },
  { rank: 3, studentId: "std_008", name: "Sneha Reddy", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sneha", score: 328, accuracy: 87, timeTaken: 3400, rankChange: -1, isCurrentUser: false },
  { rank: 4, studentId: "std_022", name: "Rohan Gupta", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=rohan", score: 320, accuracy: 85, timeTaken: 3300, rankChange: 1, isCurrentUser: false },
  { rank: 5, studentId: "std_019", name: "Ananya Singh", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=ananya", score: 315, accuracy: 84, timeTaken: 3250, rankChange: -2, isCurrentUser: false },
  { rank: 6, studentId: "std_003", name: "Vikash Kumar", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=vikash", score: 308, accuracy: 82, timeTaken: 3100, rankChange: 3, isCurrentUser: false },
  { rank: 7, studentId: "std_011", name: "Meera Joshi", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=meera", score: 302, accuracy: 80, timeTaken: 3450, rankChange: 0, isCurrentUser: false },
  { rank: 8, studentId: "std_025", name: "Arjun Nair", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=arjun", score: 298, accuracy: 79, timeTaken: 3200, rankChange: 1, isCurrentUser: false },
  { rank: 9, studentId: "std_007", name: "Kavya Menon", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=kavya", score: 292, accuracy: 78, timeTaken: 3380, rankChange: -1, isCurrentUser: false },
  { rank: 10, studentId: "std_014", name: "Sanjay Verma", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sanjay", score: 288, accuracy: 77, timeTaken: 3420, rankChange: 2, isCurrentUser: false },
  { rank: 11, studentId: "std_020", name: "Divya Rao", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=divya", score: 286, accuracy: 76, timeTaken: 3400, rankChange: -1, isCurrentUser: false },
  { rank: 12, studentId: "std_001", name: "Rahul Kumar", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=rahul", score: 285, accuracy: 76, timeTaken: 3420, rankChange: 2, isCurrentUser: true },
  { rank: 13, studentId: "std_018", name: "Neha Agarwal", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=neha", score: 280, accuracy: 75, timeTaken: 3500, rankChange: -2, isCurrentUser: false },
  { rank: 14, studentId: "std_005", name: "Karan Malhotra", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=karan", score: 275, accuracy: 73, timeTaken: 3480, rankChange: 0, isCurrentUser: false },
  { rank: 15, studentId: "std_012", name: "Pooja Bhatt", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=pooja", score: 270, accuracy: 72, timeTaken: 3550, rankChange: 1, isCurrentUser: false }
];

// Messages
export const messages: Message[] = [
  { id: "msg_001", from: "support", senderName: "Support Team", content: "Welcome to UNIV.LIVE! Feel free to reach out if you need any help.", timestamp: "2024-12-20T10:00:00Z", read: true },
  { id: "msg_002", from: "coaching", senderName: "Sharma Academy", content: "New test series uploaded: CUET Physics Full Mock. Check it out!", timestamp: "2024-12-21T14:30:00Z", read: true },
  { id: "msg_003", from: "student", senderName: "You", content: "I'm facing an issue with the test timer. It seems to run faster than expected.", timestamp: "2024-12-22T09:15:00Z", read: true },
  { id: "msg_004", from: "support", senderName: "Support Team", content: "We've looked into your timer issue. Could you please clear your browser cache and try again? Let us know if the problem persists.", timestamp: "2024-12-22T11:30:00Z", read: false }
];

export const threads: Thread[] = [
  { id: "thread_001", subject: "Timer Issue Report", lastMessage: "We've looked into your timer issue...", timestamp: "2024-12-22T11:30:00Z", unreadCount: 1, status: "in-progress" },
  { id: "thread_002", subject: "Welcome to UNIV.LIVE", lastMessage: "Welcome to UNIV.LIVE! Feel free...", timestamp: "2024-12-20T10:00:00Z", unreadCount: 0, status: "resolved" },
  { id: "thread_003", subject: "New Test Series Alert", lastMessage: "New test series uploaded: CUET Physics...", timestamp: "2024-12-21T14:30:00Z", unreadCount: 0, status: "resolved" }
];

// Helper function to get attempt by ID
export const getAttemptById = (id: string): Attempt | undefined => {
  return attempts.find(a => a.id === id);
};

// Helper function to get test by ID
export const getTestById = (id: string): Test | undefined => {
  return availableTests.find(t => t.id === id);
};

// Helper to generate question responses state
export const generateEmptyResponses = (questions: Question[]) => {
  return questions.reduce((acc, q) => {
    acc[q.id] = {
      answer: null,
      markedForReview: false,
      visited: false,
      timeSpent: 0
    };
    return acc;
  }, {} as Record<string, { answer: string | null; markedForReview: boolean; visited: boolean; timeSpent: number }>);
};
