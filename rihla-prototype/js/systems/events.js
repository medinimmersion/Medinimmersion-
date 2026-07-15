// Central vocabulary of event names carried over the EventBus. Systems
// import names from here instead of typing string literals, so a rename
// is a one-file change instead of a grep-and-pray.
export const Events = {
  // Dialogue system
  DIALOGUE_LINE_SHOWN: 'dialogue/line-shown',
  DIALOGUE_ADVANCE_REQUESTED: 'dialogue/advance-requested',
  DIALOGUE_INPUT_SUBMITTED: 'dialogue/input-submitted',
  DIALOGUE_SEQUENCE_ENDED: 'dialogue/sequence-ended',

  // Conversation AI (Gemini / Kalam AI Live stand-in)
  AI_REQUEST: 'ai/request',
  AI_RESPONSE: 'ai/response',

  // Quest system
  QUEST_STARTED: 'quest/started',
  QUEST_OBJECTIVE_COMPLETED: 'quest/objective-completed',
  QUEST_COMPLETED: 'quest/completed',

  // Passport
  PASSPORT_STAMP_AWARDED: 'passport/stamp-awarded',
  PASSPORT_COUNTRY_UNLOCKED: 'passport/country-unlocked',
  PASSPORT_UPDATED: 'passport/updated',
  PASSPORT_TOGGLE_UI: 'passport/toggle-ui',

  // Inventory
  INVENTORY_ITEM_ADDED: 'inventory/item-added',
  INVENTORY_UPDATED: 'inventory/updated',

  // Mini-games
  MINIGAME_STARTED: 'minigame/started',
  MINIGAME_WON: 'minigame/won',
  MINIGAME_RETRY: 'minigame/retry',

  // Scenes / world
  SCENE_TRANSITION_REQUESTED: 'scene/transition-requested',
  SCENE_READY: 'scene/ready',
  PLAYER_ENTERED_TRIGGER: 'player/entered-trigger',

  // HUD
  HUD_SET_OBJECTIVE: 'hud/set-objective',
  HUD_SET_PROMPT: 'hud/set-prompt',
};
