# MédinImmersion Curriculum Data

## Overview

This directory contains the complete curriculum structure for the MédinImmersion mobile app, spanning 11 levels of Arabic language learning from absolute beginner to mastery.

**Generated**: 2026-07-12
**Total Levels**: 11 (Niveau 1-11)
**Total Content**:
- 795 vocabulary items
- 43 grammar topics
- 81 dialogues
- 43 cultural insights
- 105 exercises
- 3,850 XP available

## File Structure

### Main Curriculum Files

Each level is stored as a separate JSON file following the naming convention:
```
level_1.json
level_2.json
level_3.json
...
level_11.json
```

### Index and Documentation

- **INDEX.json** - Master index of all levels with metadata and learning paths
- **README.md** - This documentation file

## JSON Schema

Each level file follows this structure:

```json
{
  "id": "level_2",
  "title": "Niveau 2",
  "level_number": 2,
  "difficulty": "beginner",
  "description": "Description of the level",
  "vocabulary": [...],
  "grammar_topics": [...],
  "dialogues": [...],
  "cultural_insights": [...],
  "exercises": [...],
  "milestone": {
    "xp_reward": 150
  }
}
```

### Vocabulary Items

Each vocabulary item contains:
```json
{
  "id": "vocab_1",
  "arabic": "السلام",
  "transliteration": "assalam",
  "english": "greeting",
  "difficulty": "beginner",
  "context": "Common greeting",
  "example_sentence": "السلام عليكم",
  "example_translation": "Peace be upon you"
}
```

**Fields**:
- `id`: Unique identifier for the vocabulary item
- `arabic`: The Arabic word or phrase
- `transliteration`: Latin-alphabet pronunciation guide (Romanization)
- `english`: English translation or meaning
- `difficulty`: Difficulty level (beginner, intermediate, advanced)
- `context`: Context in which the word is typically used
- `example_sentence`: Complete sentence using the vocabulary
- `example_translation`: Translation of the example sentence

### Grammar Topics

Each grammar topic contains:
```json
{
  "id": "grammar_1",
  "title": "Personal Pronouns",
  "description": "Introduction to Arabic pronouns (ana, anta, huwa, hiya, nahnu, antum, hum)",
  "rule": "Pronouns indicate the person performing or receiving the action",
  "examples": [
    "أنا طالب",
    "أنت معلم",
    "هو صديق"
  ]
}
```

**Fields**:
- `id`: Unique identifier for the grammar topic
- `title`: Topic name
- `description`: Detailed explanation of the grammar concept
- `rule`: The grammatical rule or pattern
- `examples`: Array of example sentences demonstrating the rule

### Dialogues

Each dialogue contains:
```json
{
  "id": "dialogue_1",
  "title": "First Meeting",
  "situation": "Two people meeting for the first time",
  "speakers": ["Person A", "Person B"],
  "script": [
    {
      "speaker": "Person A",
      "text": "السلام عليكم",
      "translation": "Greetings"
    },
    {
      "speaker": "Person B",
      "text": "وعليكم السلام ورحمة الله",
      "translation": "And upon you be peace"
    }
  ],
  "vocabulary_introduced": ["السلام", "مرحبا"],
  "difficulty": "beginner"
}
```

**Fields**:
- `id`: Unique identifier for the dialogue
- `title`: Dialogue name/topic
- `situation`: Context or scenario of the dialogue
- `speakers`: Array of speaker names
- `script`: Array of dialogue exchanges with:
  - `speaker`: Who is speaking
  - `text`: The Arabic text
  - `translation`: English translation
- `vocabulary_introduced`: List of key vocabulary words in the dialogue
- `difficulty`: Difficulty level

### Cultural Insights

Each cultural insight contains:
```json
{
  "id": "culture_1",
  "title": "Arabic Greetings",
  "description": "The greeting 'السلام عليكم' (As-salamu alaikum) is the most common formal greeting in the Arab world. The response emphasizes peace, mercy, and blessings."
}
```

**Fields**:
- `id`: Unique identifier for the insight
- `title`: Topic of the cultural insight
- `description`: Detailed explanation of the cultural aspect

### Exercises

Each exercise contains:
```json
{
  "id": "exercise_1",
  "question": "What is the correct response to 'السلام عليكم'?",
  "options": [
    "وعليكم السلام ورحمة الله",
    "شكرا لك",
    "أنا بخير",
    "من فضلك"
  ],
  "correct_answer": 0,
  "explanation": "The correct response acknowledges the greeting and wishes peace, mercy, and blessings."
}
```

**Fields**:
- `id`: Unique identifier for the exercise
- `question`: The quiz question
- `options`: Array of 4 answer choices
- `correct_answer`: Index (0-3) of the correct answer
- `explanation`: Explanation of why the answer is correct

### Milestone

Each level includes milestone information:
```json
{
  "milestone": {
    "xp_reward": 150
  }
}
```

**Fields**:
- `xp_reward`: Experience points awarded for completing the level

## Level Progression

### Difficulty Levels
1. **Absolute Beginner** (Level 1) - Alphabet and pronunciation
2. **Beginner** (Levels 2-3) - Basic greetings, pronouns, simple tenses
3. **Elementary** (Levels 4-5) - Expanded vocabulary, verb conjugations
4. **Intermediate** (Level 6) - Daily activities, subjunctive mood
5. **Upper Intermediate** (Levels 7-8) - Literary texts, complex grammar
6. **Advanced** (Levels 9-10) - Scholarly texts, nuanced language
7. **Mastery** (Level 11) - Complete fluency in MSA

### XP Progression
- Level 1: 100 XP
- Level 2: 150 XP
- Level 3: 200 XP
- Level 4: 250 XP
- Level 5: 300 XP
- Level 6: 350 XP
- Level 7: 400 XP
- Level 8: 450 XP
- Level 9: 500 XP
- Level 10: 550 XP
- Level 11: 600 XP
- **Total**: 3,850 XP

## Transliteration System

The curriculum uses a simplified Latin transcription (Romanization) for Arabic words:

**Key Characters**:
- `'` or `'` = Hamza (glottal stop)
- `aa` = Long 'a' (alif)
- `ii` = Long 'i' (ya)
- `uu` = Long 'u' (waw)
- `kh` = Kha
- `gh` = Ghayn
- `q` = Qaf
- `dh` = Dhal
- `sh` = Shin
- `th` = Thal

## Content Statistics

### Vocabulary
- **Total Words**: 795
- **Per Level**: 80 words (except Level 1: 25 words)
- **Difficulty Distribution**: Progressive increase from beginner to advanced

### Grammar
- **Total Topics**: 43
- **Per Level**: 3-4 topics
- **Coverage**: Comprehensive Arabic grammar progression

### Dialogues
- **Total Dialogues**: 81
- **Per Level**: 8-9 dialogues
- **Scenarios**: Realistic everyday conversations progressing to literary exchanges

### Cultural Content
- **Total Insights**: 43
- **Per Level**: 3-4 insights
- **Focus**: Islamic traditions, Arab customs, social etiquette, regional variations

### Practice Exercises
- **Total Exercises**: 105
- **Per Level**: 5-10 multiple-choice questions
- **Format**: Review and reinforce learned concepts

## Integration with Mobile App

The JSON files are designed for direct integration with the mobile application:

1. **Data Loading**: Parse JSON files on app launch or during level selection
2. **Offline Support**: Store all data locally in the app's database
3. **Progress Tracking**: Track which vocabulary, dialogues, and exercises have been completed
4. **XP System**: Award XP points as users complete levels
5. **Navigation**: Use level IDs and numbers for navigation and progression

## Quality Assurance

All JSON files have been:
- ✓ Validated for proper JSON syntax
- ✓ Verified for complete content structure
- ✓ Checked for required fields in each item
- ✓ Tested for encoding (UTF-8 with Arabic characters)
- ✓ Confirmed to have appropriate difficulty progression

## Updates and Maintenance

When updating curriculum content:

1. Edit the relevant level JSON file
2. Maintain the exact field structure and naming
3. Ensure UTF-8 encoding is preserved for Arabic text
4. Re-validate JSON syntax
5. Update INDEX.json if adding/removing levels
6. Test with the mobile app after updates

## File Locations

**Directory**: `/home/user/Medinimmersion-/mobile/src/data/levels/`

**Files**:
```
/home/user/Medinimmersion-/mobile/src/data/levels/
├── level_1.json
├── level_2.json
├── level_3.json
├── level_4.json
├── level_5.json
├── level_6.json
├── level_7.json
├── level_8.json
├── level_9.json
├── level_10.json
├── level_11.json
├── INDEX.json
└── README.md
```

## License

MédinImmersion Curriculum
All rights reserved
