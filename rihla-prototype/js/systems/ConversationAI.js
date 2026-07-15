// Stand-in for "Document 019 – IA Conversationnelle (Gemini / Kalam AI Live)".
// Everything that needs the AI teacher voice talks to this interface only.
// Swapping MockConversationAI for a real Gemini/Kalam AI Live client later
// means implementing the same two methods — nothing else in the codebase
// needs to know the difference.
export class ConversationAI {
  // eslint-disable-next-line no-unused-vars
  async converse({ speakerKey, context, studentInput }) {
    throw new Error('ConversationAI.converse must be implemented by a subclass');
  }
}

const ENCOURAGEMENTS = [
  'Très bien, continue ainsi.',
  'Barak Allahu fik, tu progresses.',
  "Ce n'est pas grave, essayons encore une fois.",
  'Prends ton temps, il n\'y a pas de course.',
];

// Deterministic-enough placeholder so the prototype is fully usable offline
// and without any API key, while keeping the exact call shape the real
// integration will use.
export class MockConversationAI extends ConversationAI {
  async converse({ speakerKey, context, studentInput }) {
    await new Promise((resolve) => setTimeout(resolve, 250 + Math.random() * 250));
    if (context?.expectedKeyword && studentInput) {
      const matched = studentInput.trim().length > 0;
      return {
        text: matched
          ? ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]
          : "Je n'ai pas bien entendu, peux-tu répéter ?",
        arabic: matched ? 'أحسنت' : '',
      };
    }
    return { text: ENCOURAGEMENTS[0], arabic: '' };
  }
}
