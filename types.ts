
export type Role = 'admin' | 'user';

export interface RevisionData {
  problemId: string;
  sheetId: string;
  sheetName: string;
  topicName: string;
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
  role: Role;
  createdAt: number;
  lastActive: number;
  completedProblems: Record<string, number>; // problemId -> timestamp
  revisions?: Record<string, RevisionData>; // problemId -> RevisionData
  streakStart: number;
  currentStreak: number;
  maxStreak: number;
  lastSolvedDate: string | null; // YYYY-MM-DD
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
