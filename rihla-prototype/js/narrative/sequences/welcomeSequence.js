// "Document 005 – Hall d'accueil & Onboarding" + "Document 008 – Abou Adam
// (Fondations)": first contact between the student and Abou Adam. A
// sequence is just a plain function that orchestrates independent systems
// (npc animation, dialogue, AI, passport, quest) — it holds no state of its
// own and could be deleted/replaced without any system noticing.
export function playWelcomeSequence({ dialogue, passport, quests, ai }, abouAdamNpc) {
  abouAdamNpc.standUp();
  abouAdamNpc.playGreet();

  quests.startQuest({
    id: 'onboarding-welcome',
    title: "Accueil à l'Académie",
    objectives: [{ id: 'meet-abou-adam', label: 'Rencontrer Abou Adam' }],
  });

  dialogue.play(
    [
      {
        speaker: 'Abou Adam',
        arabic: 'السلام عليكم ورحمة الله وبركاته',
        text: "Bienvenue à l'Académie MédinImmersion. Je suis heureux de t'accueillir ici.",
      },
      {
        speaker: 'Abou Adam',
        text: "Nous allons avancer pas à pas, sans jamais te presser. Avant toute chose, dis-moi : quel est ton prénom ?",
        requiresInput: true,
        inputPlaceholder: 'Ton prénom',
        onInput: async (value) => {
          passport.setStudentProfile({ name: value });
          const reply = await ai.converse({
            speakerKey: 'abou_adam',
            context: { expectedKeyword: 'prenom' },
            studentInput: value,
          });
          dialogue.insertNext({ speaker: 'Abou Adam', arabic: reply.arabic, text: `${reply.text} Bienvenue parmi nous, ${value}.` });
        },
      },
      {
        speaker: 'Abou Adam',
        text: "Je vais te présenter l'académie et créer ton dossier dans mon bureau. Suis-moi lorsque tu seras prêt.",
      },
    ],
    {
      onComplete: () => {
        quests.completeObjective('meet-abou-adam');
      },
    },
  );
}
