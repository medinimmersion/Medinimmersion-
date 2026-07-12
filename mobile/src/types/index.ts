// Phase types for the 6-country journey
export type Phase = 'MEDINA' | 'MECCA' | 'EGYPT' | 'MOROCCO' | 'DUBAI' | 'JERUSALEM';

// Difficulty level for letters and vocabulary
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

// Arabic letter forms in different positions
export interface LetterForms {
  isolated: string;      // الخاء alone
  beginning: string;     // ـخ at beginning
  middle: string;        // ـخـ in middle
  end: string;          // ـخ at end
}

// Single Arabic letter with all its properties
export interface ArabicLetter {
  id: string;
  arabicName: string;    // e.g., "الخاء"
  transliteration: string; // e.g., "Kha"
  pronunciation: string;   // Description of sound
  phase: Phase;
  forms: LetterForms;
  anatomicalNotes: string; // Description of mouth position
  exampleWords: string[]; // Words containing this letter
  difficultyLevel: DifficultyLevel;
  audioUrl?: string;     // Optional: URL to pronunciation audio
}

// Single vocabulary word
export interface VocabularyItem {
  id: string;
  arabic: string;
  transliteration: string;
  english: string;
  level: number;
  difficulty: 'easy' | 'medium' | 'hard';
  context?: string;
  example?: string;
  audioUrl?: string;
}

// Grammar topic for a level
export interface GrammarTopic {
  id: string;
  title: string;
  description: string;
  rule: string;
  examples: Array<{
    arabic: string;
    english: string;
    explanation: string;
  }>;
  exercises?: number;
}

// Single dialogue
export interface Dialogue {
  id: string;
  title: string;
  situation: string;
  speakers: string[];
  script: Array<{
    speaker: string;
    arabic: string;
    english: string;
    phonetic?: string;
  }>;
  vocabulary?: string[];
  audioUrl?: string;
}

// Complete level content
export interface Level {
  level: number;
  title: string;
  arabicTitle: string;
  order: number;
  duration_weeks: number;
  total_vocabulary: number;
  total_dialogues: number;
  grammar_topics: number;
  xp_reward: number;
  character_focus?: string;
  narrative_milestone?: string;

  vocabulary: VocabularyItem[];
  grammar_topics: GrammarTopic[];
  dialogues: Dialogue[];
  cultural_insights?: Array<{
    title: string;
    description: string;
    relevance?: string;
  }>;

  exercises?: Array<{
    id: string;
    type: string;
    question: string;
    options: string[];
    correct_answer: number;
    explanation?: string;
  }>;

  milestone_celebration?: {
    title: string;
    description: string;
    reward_xp: number;
    character_scene?: string;
    next_milestone?: string;
  };
}

// User achievement
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon?: string;
  unlockedDate?: Date;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

// User progress tracking
export interface UserProgress {
  userId: string;
  currentLevel: number;
  completedLetters: string[];
  masteredLetters: string[];
  totalXP: number;
  streakDays: number;
  lastPracticeDate: Date;
  achievements: Achievement[];
  practiceHistory?: Array<{
    date: Date;
    duration: number;
    xpEarned: number;
  }>;
}

// Kalam pronunciation feedback
export interface PronunciationFeedback {
  word: string;
  accuracy: number; // 0-100
  feedbackText: string;
  phonemes?: Array<{
    phoneme: string;
    correct: boolean;
  }>;
  suggestions?: string[];
}

// Lesson step for learning progression
export interface LessonStep {
  id: string;
  type: 'introduction' | 'pronunciation' | 'forms' | 'examples' | 'quiz' | 'dialogue';
  title: string;
  content: string;
  audioUrl?: string;
  quiz?: {
    question: string;
    options: string[];
    correctIndex: number;
  };
}

// Game state interface
export interface GameState {
  isLoading: boolean;
  currentLevel: number;
  userProgress: UserProgress | null;
  levels: Level[];
  currentLetter: ArabicLetter | null;
  selectedVocab: VocabularyItem | null;
}

// Spaced repetition item for learning optimization
export interface SpacedRepetitionItem {
  itemId: string;
  itemType: 'letter' | 'vocabulary' | 'grammar';
  level: number;
  interval: number; // days until next review
  easeFactor: number;
  repetitions: number;
  nextReviewDate: Date;
  lastReviewDate?: Date;
  quality?: number; // 0-5 for quality of last answer
}

// Kalam session tracking
export interface KalamSession {
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  recordings: Array<{
    wordAttempted: string;
    accuracy: number;
    audioUrl?: string;
    timestamp: Date;
  }>;
  totalAccuracy: number;
  xpEarned: number;
}
