import { create } from 'zustand';
import { ArabicLetter, UserProgress, Level, VocabularyItem, Achievement } from '../types';
import lettersDatabase from '../data/letters_database.json';

interface GameStore {
  isLoading: boolean;
  currentLevel: number;
  userProgress: UserProgress | null;
  letters: ArabicLetter[];
  currentLetter: ArabicLetter | null;
  selectedVocab: VocabularyItem | null;

  // Actions
  setLoading: (loading: boolean) => void;
  setCurrentLevel: (level: number) => void;
  setUserProgress: (progress: UserProgress) => void;
  setLetters: (letters: ArabicLetter[]) => void;
  setCurrentLetter: (letter: ArabicLetter | null) => void;
  setSelectedVocab: (vocab: VocabularyItem | null) => void;

  // Game logic
  initializeGame: () => void;
  updateUserProgress: (updates: Partial<UserProgress>) => void;
  addXP: (amount: number) => void;
  completeLesson: (letterId: string) => void;
  masterLesson: (letterId: string) => void;
  updateStreak: () => void;
  addAchievement: (achievement: Achievement) => void;
}

export const useGameState = create<GameStore>((set, get) => ({
  // Initial state
  isLoading: true,
  currentLevel: 1,
  userProgress: null,
  letters: [],
  currentLetter: null,
  selectedVocab: null,

  // Basic setters
  setLoading: (loading: boolean) => set({ isLoading: loading }),

  setCurrentLevel: (level: number) => set({ currentLevel: level }),

  setUserProgress: (progress: UserProgress) => set({ userProgress: progress }),

  setLetters: (letters: ArabicLetter[]) => set({ letters }),

  setCurrentLetter: (letter: ArabicLetter | null) => set({ currentLetter: letter }),

  setSelectedVocab: (vocab: VocabularyItem | null) => set({ selectedVocab: vocab }),

  // Initialize game with default data
  initializeGame: () => {
    const defaultProgress: UserProgress = {
      userId: 'user_' + Math.random().toString(36).substr(2, 9),
      currentLevel: 1,
      completedLetters: [],
      masteredLetters: [],
      totalXP: 0,
      streakDays: 0,
      lastPracticeDate: new Date(),
      achievements: [],
    };

    set({
      userProgress: defaultProgress,
      letters: lettersDatabase as ArabicLetter[],
      isLoading: false,
    });
  },

  // Update user progress with partial updates
  updateUserProgress: (updates: Partial<UserProgress>) => {
    set((state) => ({
      userProgress: state.userProgress
        ? { ...state.userProgress, ...updates }
        : null,
    }));
  },

  // Add XP and update progress
  addXP: (amount: number) => {
    set((state) => ({
      userProgress: state.userProgress
        ? { ...state.userProgress, totalXP: state.userProgress.totalXP + amount }
        : null,
    }));
  },

  // Mark a lesson as completed (not yet mastered)
  completeLesson: (letterId: string) => {
    set((state) => {
      if (!state.userProgress) return state;
      const completed = state.userProgress.completedLetters || [];
      if (!completed.includes(letterId)) {
        completed.push(letterId);
      }
      return {
        userProgress: {
          ...state.userProgress,
          completedLetters: completed,
        },
      };
    });
  },

  // Mark a lesson as mastered (85%+ accuracy)
  masterLesson: (letterId: string) => {
    set((state) => {
      if (!state.userProgress) return state;
      const mastered = state.userProgress.masteredLetters || [];
      if (!mastered.includes(letterId)) {
        mastered.push(letterId);
      }
      // Also add to completed if not already there
      const completed = state.userProgress.completedLetters || [];
      if (!completed.includes(letterId)) {
        completed.push(letterId);
      }
      return {
        userProgress: {
          ...state.userProgress,
          completedLetters: completed,
          masteredLetters: mastered,
        },
      };
    });
  },

  // Update streak (called on daily practice)
  updateStreak: () => {
    set((state) => {
      if (!state.userProgress) return state;

      const now = new Date();
      const lastPractice = new Date(state.userProgress.lastPracticeDate);
      const dayDifference = Math.floor(
        (now.getTime() - lastPractice.getTime()) / (1000 * 60 * 60 * 24)
      );

      let newStreak = state.userProgress.streakDays;

      // If practiced today, keep streak
      if (dayDifference === 0) {
        newStreak = state.userProgress.streakDays;
      }
      // If practiced yesterday, increment streak
      else if (dayDifference === 1) {
        newStreak = state.userProgress.streakDays + 1;
      }
      // If more than 1 day has passed, reset streak
      else {
        newStreak = 1;
      }

      return {
        userProgress: {
          ...state.userProgress,
          streakDays: newStreak,
          lastPracticeDate: now,
        },
      };
    });
  },

  // Add achievement
  addAchievement: (achievement: Achievement) => {
    set((state) => {
      if (!state.userProgress) return state;

      const exists = state.userProgress.achievements.some(
        (a) => a.id === achievement.id
      );

      if (exists) return state;

      return {
        userProgress: {
          ...state.userProgress,
          achievements: [...state.userProgress.achievements, achievement],
        },
      };
    });
  },
}));
