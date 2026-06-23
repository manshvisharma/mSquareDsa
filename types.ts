
export type Role = 'admin' | 'user';

export interface RevisionData {
  problemId: string;
  sheetId: string;
  sheetName: string;
  topicName: string;
  subPatternName?: string;
  problemTitle: string;
  difficulty?: string;
  platform?: string;
  url?: string;
  isInRevision: boolean;
  revisionStage: number; // 0 for Day 1, 1 for Day 3, ..., 4 for Day 30
  revisionHistory: number[]; // Timestamps
  nextRevisionDate: number | null; // Timestamp
  lastRevisionDate: number | null; // Timestamp
  timesRevised: number;
  timesReset: number;
  missedCount: number;
  revisionCycleCompleted: boolean;
  futureReviewScheduled: boolean;
  futureReviewDate: number | null;
  createdRevisionDate: number; // When added to revision
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  username?: string; // New: Unique username
  photoURL?: string; // Profile picture
  leetcodeHandle?: string;
  githubHandle?: string;
  role: Role;
  createdAt: number;
  lastActive: number;
  completedProblems: Record<string, number>; // problemId -> timestamp
  completedLessons?: Record<string, number>; // lessonId -> timestamp
  revisions?: Record<string, RevisionData>; // problemId -> RevisionData
  bookmarks?: Record<string, boolean>; // problemId -> true
  streakStart: number;
  currentStreak: number;
  maxStreak: number;
  points?: number;
  lastCheckInDate?: string;
  lastSolvedDate: string | null; // YYYY-MM-DD
  followers?: string[];
  following?: string[];
  typingTo?: string | null;
  privacySettings?: {
      hideStats?: boolean;
      hideActivity?: boolean;
  };
  customBadges?: string[];
}

export interface DirectMessage {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  content: string;
  imageUrl?: string;
  timestamp: number;
  read: boolean;
  readAt?: number;
  reactions?: Record<string, string>;
}

export interface Sheet {
  id: string;
  title: string;
  description: string;
  isDeleted: boolean;
  createdAt: number;
}

export interface Topic {
  id: string;
  sheetId: string;
  title: string;
  order: number;
  isDeleted: boolean;
}

export interface SubPattern {
  id: string;
  topicId: string;
  title: string;
  order: number;
  isDeleted: boolean;
}

export interface Problem {
  id: string;
  subPatternId: string;
  title: string;
  url: string;
  platform: 'LeetCode' | 'GFG' | 'Other';
  platformId?: string;
  order: number;
  isDeleted: boolean;
}

export interface Note {
  id: string;
  userId: string;
  problemId: string;
  content: string;
  updatedAt: number;
}

export interface BatchImportData {
  title: string;
  url: string;
  platform: 'LeetCode' | 'GFG' | 'Other';
  platformId?: string;
}

// For Analytics
export interface DailyActivity {
  date: string;
  count: number;
}

// SQL Practice Types
export interface SQLTopicBatch {
  id?: string;
  name: string;
  startRange: number;
  endRange: number;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail: string;
  order: number;
}

export interface LearningTopic {
  id: string;
  course_id: string;
  title: string;
  description: string;
  order: number;
  xp: number;
  estimated_time: number;
}

export type LessonType = 'learn' | 'practice' | 'project' | 'quiz' | 'assessment';

export interface Lesson {
  id: string;
  topic_id: string;
  title: string;
  type: LessonType;
  order: number;
}

export type SlideType = 'theory' | 'quiz' | 'code' | 'fill_blank' | 'project';

export interface SlideConfig {
  editor?: boolean;
  language?: string;
  starterCode?: string;
  solution?: string;
  hint?: string;
  showPreview?: boolean;
  allowAutocomplete?: boolean;
  allowPaste?: boolean;
  options?: string[];
  correctAnswer?: string;
  validationRules?: any[];
  validationRegex?: string;
}

export interface Slide {
  id: string;
  lesson_id: string;
  order: number;
  type: SlideType;
  title: string;
  content: string; // Markdown or plain text
  configuration_json: SlideConfig;
}

export interface SQLProblem {
  id: string; // Document ID
  problemNumber: number;
  title: string;
  slug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: string;
  tags: string[];
  description: string;
  constraints: string[];
  notes: string;
  hints: string[];
  databaseType: 'PostgreSQL' | 'MySQL';
  visibleSetupSql: string;
  sampleTestCases?: string[]; // Array of setup scripts for sample cases
  starterQuery: string;
  sampleExplanation: string;
  expectedOutput: any[]; // Default Expected JSON rows result
  solutionQuery: string; // The correct query, used for dynamic test cases evaluations
  validationQuery?: string; // Query to run after user/solution query to extract results (useful for DDL/DML exercises)
  hiddenSetupSql?: string; // Optional hidden test cases schema and inserts
  hiddenTestCases?: string[]; // Array of setup scripts for hidden cases
  testCases?: {
      id: string;
      setupSql: string; // Additional or overriding SQL to run before query
      expectedOutput: any[]; // Expected rows for this testcase
      isHidden: boolean;
  }[];
  createdAt: number;
  updatedAt: number;
  published: boolean;
  order?: number;
}

export interface SQLSubmission {
  id: string;
  userId: string;
  problemId: string;
  query: string;
  status: 'Accepted' | 'Wrong Answer' | 'Error';
  executionTimeMs: number;
  timestamp: number;
}
