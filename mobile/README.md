# MédinImmersion RIHLA - Mobile App

**RIHLA** (The Journey) is a narrative-driven Arabic learning mobile application built with React Native and Expo, featuring AI-powered speech practice with Kalam integration.

## 🎯 Project Status

**Phase 1: Foundation ✅ COMPLETE**
- React Native app scaffold with Expo
- Bottom tab navigation system
- State management with Zustand
- TypeScript type safety
- 28 Arabic letters database
- Screen components (Home, Journey, Lessons, Settings)

**Phase 2: Content Extraction (CURRENT)**
- Extract Levels 1-2 (Foundation) - ✅ DONE
- Extract Level 3 (Intermediate I) - 🔄 IN PROGRESS
- Extract Levels 4-6 (Intermediate II-III)
- Extract Levels 7-11 (Advanced & Master)

**Phase 3: Firebase Backend (NEXT)**
- Setup Firestore database
- Authentication (email, Google, Apple)
- Cloud Storage for audio files

**Phase 4: Kalam AI Integration**
- Microphone recording
- Real-time feedback
- Pronunciation accuracy scoring

## 📦 Installation & Setup

### Prerequisites
- Node.js 16+
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- iOS simulator (Xcode) or Android emulator (Android Studio)

### Setup Steps

```bash
# Navigate to mobile app directory
cd mobile

# Install dependencies
npm install

# Start development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Or use Expo Go on physical device
# Scan QR code with Expo Go app
```

## 📱 App Structure

```
mobile/
├── src/
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces
│   ├── hooks/
│   │   └── useGameState.ts        # Zustand state management
│   ├── screens/
│   │   ├── HomeScreen.tsx         # Dashboard
│   │   ├── JourneyMapScreen.tsx   # Level selector
│   │   ├── LetterLessonScreen.tsx # Lesson interface
│   │   ├── PronunciationPracticeScreen.tsx
│   │   ├── SettingsScreen.tsx
│   │   └── SplashLoadingScreen.tsx
│   ├── data/
│   │   ├── letters_database.json  # 28 Arabic letters
│   │   └── levels/
│   │       ├── LEVEL_3_TEMPLATE.json
│   │       ├── level_1.json
│   │       ├── level_2.json
│   │       └── (Levels 3-11 to be extracted)
│   └── App.tsx                    # Main app entry
├── app.json                       # Expo configuration
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
└── README.md                      # This file
```

## 🎮 App Features

### Current Features (Phase 1)
- ✅ User progress tracking (XP, streaks, mastered letters)
- ✅ 28 Arabic letter lessons with 5-step progression
- ✅ Anatomical pronunciation guides
- ✅ Letter forms in different positions
- ✅ Example words for each letter
- ✅ Knowledge check quizzes
- ✅ Achievement system
- ✅ Bottom tab navigation (Home, Journey, Practice, Settings)

### Planned Features (Phase 2-4)
- 🔄 Level 3+ vocabulary and grammar lessons
- 🔄 Grammar topic explanations
- 🔄 Dialogue scenarios
- 🔄 Kalam AI pronunciation practice
- 🔄 Real-time speech accuracy feedback
- 🔄 Spaced repetition algorithm
- 🔄 Character animations (Oustaz walking)
- 🔄 Word-building games
- 🔄 Firebase backend sync

## 🎯 11-Level Structure

### Act 1: Foundations (Levels 1-2)
- LEVEL 1: INITIATION - First steps in Arabic
- LEVEL 2: PREPARATORY - Letters and vowel marks

### Act 2: Intermediate Journey (Levels 3-6)
- LEVEL 3: INTERMEDIATE I - Vocabulary building (80 words)
- LEVEL 4: INTERMEDIATE II - Simple sentences
- LEVEL 5: INTERMEDIATE III - Real conversations
- LEVEL 6: INTERMEDIATE-ADVANCED - Grammar mastery

### Act 3: Advanced Mastery (Levels 7-10)
- LEVEL 7-10: Advanced texts, poetry, specialized vocabulary

### Act 4: Legacy (Level 11)
- LEVEL 11: MASTERY - Student becomes teacher

## 🌍 6-Country Journey

Learning follows a narrative journey through:
1. 🕌 **Medina** - LEVEL 1 (Foundation)
2. 🌙 **Mecca** - LEVEL 2 (Preparatory)
3. 🦁 **Egypt** - LEVELS 3-4 (Intermediate)
4. 🏜️ **Morocco** - LEVELS 5-6 (Advanced Intermediate)
5. 🏙️ **Dubai** - LEVELS 7-8 (Advanced)
6. 🏛️ **Jerusalem** - LEVELS 9-11 (Mastery)

## 📊 Gamification System

### XP Rewards
- Level 1-2: 200-250 XP each
- Levels 3-6: 300 XP each
- Levels 7-10: 400 XP each
- Level 11: 500 XP

### Achievements
- Beginner: First Words, Alphabet Master
- Intermediate: Conversationalist, Grammar Guardian
- Advanced: Text Master, Expert Scholar
- Master: Master of Arabic 🏆

## 🔄 Content Extraction

### Level 3 Extraction Plan (Template Ready)

**What needs to be extracted from Level 3 PDF:**

1. **80 Vocabulary Items**
   - Arabic word, transliteration, English, difficulty
   - Example sentences and usage context

2. **3-4 Grammar Topics**
   - Rule explanations
   - 5-10 examples per topic

3. **8 Dialogues**
   - Arabic text with English translation
   - Phonetic pronunciation guide
   - Cultural context

4. **Cultural Insights**
   - 2-3 cultural topics from the level
   - Relevance to vocabulary/grammar

**Template Location:** `src/data/levels/LEVEL_3_TEMPLATE.json`

### Extraction Process
```bash
# 1. Read Level 3 PDF
# 2. Extract vocabulary using template
# 3. Extract grammar topics
# 4. Extract dialogues
# 5. Run validation
# 6. Load into app

# Timeline: ~3 hours per level
# Levels 3-6: ~12 hours
# Levels 7-11: ~15 hours
# Total: ~27 hours of extraction
```

## 🎤 Kalam AI Integration

### Speech Practice Features
- Record pronunciation for any word/phrase
- Real-time accuracy feedback
- Phoneme-by-phoneme analysis
- Personalized suggestions for improvement

### Setup Steps
1. Get Kalam AI API credentials
2. Configure in Firebase environment
3. Implement recording interface
4. Test with sample audio

## 🔥 Technology Stack

| Component | Technology | Status |
|-----------|-----------|---------|
| Framework | React Native 0.74 | ✅ Ready |
| Runtime | Expo 50 | ✅ Ready |
| Language | TypeScript | ✅ Ready |
| State | Zustand | ✅ Ready |
| Navigation | React Navigation 6 | ✅ Ready |
| Styling | NativeWind | ✅ Ready |
| Audio | Expo AV | ✅ Ready |
| Database | Firebase Firestore | 📝 Setup needed |
| Auth | Firebase Auth | 📝 Setup needed |
| Speech API | Kalam AI | 📝 Credentials needed |

## 📝 Development Guide

### Adding a New Level

1. **Create Level JSON**
   ```bash
   cp src/data/levels/LEVEL_3_TEMPLATE.json src/data/levels/level_X.json
   ```

2. **Extract Content** from PDF following the template

3. **Validate JSON**
   ```bash
   npm run validate-levels
   ```

4. **Test in App**
   - Load level in JourneyMapScreen
   - Test lesson progression
   - Verify XP calculation

### Adding a Screen Component

1. Create file in `src/screens/`
2. Use TypeScript interfaces from `src/types/`
3. Connect to Zustand store via `useGameState()`
4. Add to navigation in `App.tsx`

### State Management

```typescript
// Using Zustand store
const { userProgress, addXP, masterLesson } = useGameState();

// Update progress
useGameState.setState(state => ({
  userProgress: { ...state.userProgress, totalXP: newXP }
}));

// Subscribe to changes
useGameState.subscribe(state => console.log(state));
```

## 🧪 Testing

```bash
# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format
```

## 📚 API Endpoints (Firebase)

### Firestore Collections
- `users/{userId}` - User profiles and progress
- `levels/{levelId}` - Level content
- `vocabulary/{vocabId}` - Vocabulary items
- `achievements/{achievementId}` - Achievement definitions

### Cloud Storage
- `/audio/pronunciations/{levelId}/{vocabId}.mp3`
- `/audio/dialogues/{levelId}/{dialogueId}.mp3`

## 🐛 Troubleshooting

### App won't start
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
npm start
```

### Type errors
```bash
# Check TypeScript
npm run type-check

# Update types
npm install --save-dev @types/react@latest
```

### Expo Go issues
```bash
# Clear Expo cache
expo web --clear

# Tunnel mode
expo start --tunnel
```

## 📖 Documentation Files

- `MASTER_PROJECT_GUIDE.md` - Overall project overview
- `OPTIMAL_PATH_LEVEL3.md` - Level 3 extraction strategy
- `RIHLA_11_LEVELS_COMPLETE.md` - Full 11-level curriculum
- `PDF_EXTRACTION_PIPELINE.md` - Content extraction process
- `QUICKSTART.md` - Quick setup guide

## 🚀 Deployment

### iOS & Android App Store

1. **Build APK/IPA**
   ```bash
   eas build --platform android
   eas build --platform ios
   ```

2. **Upload to Stores**
   - Google Play Console (Android)
   - App Store Connect (iOS)

3. **Monitor Performance**
   - Firebase Crashlytics
   - Performance monitoring
   - User analytics

## 📞 Support

For questions or issues:
- Email: support@medinimmersion.com
- GitHub Issues: [repository]/issues
- Documentation: /docs/README.md

## 📄 License

MédinImmersion RIHLA © 2024 - All Rights Reserved

---

**Ready to start the journey? Let's build something amazing!** 🚀
