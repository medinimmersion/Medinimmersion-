import { miniGameRegistry } from '../../systems/MiniGameRegistry.js';
import { Events } from '../../systems/events.js';

// Document 013 (parcours pédagogique) + 040 : la première leçon — la lettre
// Alif — enseignée par Abdallah, immédiatement suivie du mini-jeu du panier
// d'Alif. La réussite du mini-jeu donne le premier tampon du passeport.
export function playAlifLessonSequence(ctx, abdallahNpc) {
  const { dialogue, quests, passport, bus } = ctx;

  abdallahNpc.playTeach();
  quests.completeObjective('reach-chez-alif');

  quests.startQuest({
    id: 'egypte-lecon-alif',
    title: "La leçon d'Alif",
    objectives: [
      { id: 'listen-lesson', label: "Écouter la leçon d'Abdallah" },
      { id: 'win-panier', label: "Réussir le panier d'Alif" },
    ],
  });

  dialogue.play(
    [
      {
        speaker: 'Abdallah',
        arabic: 'ا',
        text: "Te voilà ! Assieds-toi. Voici la toute première lettre de l'alphabet arabe : Alif.",
      },
      {
        speaker: 'Abdallah',
        arabic: 'أ',
        text: "Alif est une lettre simple et droite, comme un trait vertical. Elle porte souvent la hamza et se prononce « a », comme dans « Adam ».",
      },
      {
        speaker: 'Abdallah',
        arabic: 'أَسَد — أَرْنَب — أُمّ',
        text: "Écoute bien : asad (le lion), arnab (le lapin), oumm (la maman). Tu entends ce « a » au début ? C'est Alif.",
      },
      {
        speaker: 'Abdallah',
        text: "Maintenant, à toi de jouer ! Prends ce panier : attrape uniquement les mots qui contiennent la lettre Alif. Prêt ?",
      },
    ],
    {
      onComplete: () => {
        quests.completeObjective('listen-lesson');
        const game = miniGameRegistry.create('panier-alif', ctx);
        game.start();

        const offWon = bus.on(Events.MINIGAME_WON, ({ gameId }) => {
          if (gameId !== 'panier-alif') return;
          offWon();
          abdallahNpc.playGreet();
          passport.awardStamp({ id: 'stamp-alif', countryId: 'egypte', label: 'Lettre Alif — Le Caire' });
          quests.completeObjective('win-panier');
          dialogue.play([
            {
              speaker: 'Abdallah',
              arabic: 'ممتاز',
              text: 'Moumtaz ! Excellent ! Tu viens de gagner ton tout premier tampon MédinImmersion. Ouvre ton passeport (P) pour le voir.',
            },
            {
              speaker: 'Abdallah',
              text: 'Repose-toi un instant, puis nous continuerons avec la lettre suivante : Ba. La rue entière nous attend !',
            },
          ]);
        });
      },
    },
  );
}
