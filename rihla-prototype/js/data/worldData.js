// Single source of truth for the journey structure described in
// "Document 001 – Vision & Fondations" (§4, Progression des pays) and
// "Document 003 – Personnages" (progression des enseignants, niveaux 1-11).
//
// This exists so the prototype is *shaped* for all 11 levels/countries from
// day one, even though today only "preparatoire" (the academy) and the
// beginning of "egypte" have actual scenes. Adding a new country later means
// adding one entry here + its scene modules — nothing in SceneManager,
// PassportSystem or QuestSystem needs to change.
//
// `sceneIds` lists the scenes intended for that level; `implemented: false`
// scenes are simply absent from the SceneRegistry until built, and the
// SceneManager degrades gracefully (see SceneManager.hasScene()).

export const worldData = {
  levels: [
    {
      id: 'preparatoire',
      order: 0,
      name: 'Préparatoire',
      location: "Académie MédinImmersion",
      teacher: 'abou_adam',
      sceneIds: ['academy-exterior', 'hall', 'abou-adam-office', 'student-desk'],
    },
    {
      id: 'egypte',
      order: 1,
      name: 'Égypte',
      location: 'Le Caire',
      teacher: 'abdallah',
      sceneIds: ['cairo-square', 'rue-des-lettres', 'chez-alif-exterior', 'chez-alif-interior'],
    },
    { id: 'libye', order: 2, name: 'Libye', location: 'Libye', teacher: 'abdallah', sceneIds: [] },
    { id: 'tunisie', order: 3, name: 'Tunisie', location: 'Tunisie', teacher: 'abdallah', sceneIds: [] },
    { id: 'algerie', order: 4, name: 'Algérie', location: 'Algérie', teacher: 'abdallah', sceneIds: [] },
    { id: 'maroc', order: 5, name: 'Maroc', location: 'Maroc', teacher: 'abou_adam', sceneIds: [] },
    { id: 'mauritanie', order: 6, name: 'Mauritanie', location: 'Mauritanie', teacher: 'abou_adam', sceneIds: [] },
    { id: 'senegal', order: 7, name: 'Sénégal', location: 'Dakar', teacher: 'abou_adam', sceneIds: [] },
    { id: 'ksa-riyad', order: 8, name: 'Arabie saoudite — Riyad', location: 'Riyad', teacher: 'abdel_wadoud', sceneIds: [] },
    { id: 'ksa-mecque', order: 9, name: 'Arabie saoudite — La Mecque', location: 'La Mecque', teacher: 'abdel_wadoud', sceneIds: [] },
    { id: 'ksa-medine', order: 10, name: 'Arabie saoudite — Médine', location: 'Médine', teacher: 'abdel_wadoud', sceneIds: [] },
    { id: 'academie-medine', order: 11, name: 'Académie MédinImmersion à Médine', location: 'Médine', teacher: 'abdel_wadoud', sceneIds: [] },
  ],

  // Countries as they appear in the Passeport MédinImmersion (Document 009):
  // the home academy ("preparatoire") isn't a country being visited, so it's
  // excluded here.
  get countries() {
    return this.levels
      .filter((l) => l.order >= 1)
      .map((l) => ({ id: l.id, name: l.name, unlockedByDefault: l.order === 1 }));
  },
};
