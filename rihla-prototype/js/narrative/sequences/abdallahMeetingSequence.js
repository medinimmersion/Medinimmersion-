// Document 038 (dossier Abdallah) + Document 040 (Le Caire) : première
// rencontre avec Abdallah sur la place centrale du Caire. Il oriente
// l'étudiant vers la Rue des Lettres pour la première leçon.
export function playAbdallahMeetingSequence({ dialogue, quests, passport }, abdallahNpc) {
  abdallahNpc.playGreet();

  passport.unlockCountry('egypte');

  quests.startQuest({
    id: 'egypte-arrivee',
    title: 'Arrivée au Caire',
    objectives: [
      { id: 'meet-abdallah', label: 'Rencontrer Abdallah sur la place' },
      { id: 'reach-chez-alif', label: 'Rejoindre la boutique « Chez Alif » dans la Rue des Lettres' },
    ],
  });

  dialogue.play(
    [
      {
        speaker: 'Abdallah',
        arabic: 'أهلاً وسهلاً بك في القاهرة',
        text: "Ah, te voilà ! Bienvenue au Caire, mon ami. Abou Adam m'a annoncé ton arrivée.",
      },
      {
        speaker: 'Abdallah',
        text: "Je suis Abdallah, ton enseignant pour tout le parcours d'Égypte. C'est ici que ton voyage dans la langue arabe commence vraiment.",
      },
      {
        speaker: 'Abdallah',
        arabic: 'حروف الهجاء',
        text: "Vois-tu cette rue derrière la fontaine ? C'est la Rue des Lettres. Chaque boutique y porte le nom d'une lettre de l'alphabet.",
      },
      {
        speaker: 'Abdallah',
        text: "Nous commencerons par la première : Alif. Retrouve-moi dans la boutique « Chez Alif » — j'y serai avant toi, je connais un raccourci !",
      },
    ],
    {
      onComplete: () => {
        quests.completeObjective('meet-abdallah');
      },
    },
  );
}
