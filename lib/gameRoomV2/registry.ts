import type { GameEngine } from './domain'

// GameRoom V2's own engine registry -- entirely separate from
// lib/gameRoom/registry.ts (legacy GameRoom's GAME_MODULES/
// INTERACTIVE_GAME_MODULES). Adding an entry here has zero effect on
// production GameRoom: it isn't read by any legacy route, page, or
// component, and nothing here can appear in the legacy teacher host's
// game-type dropdown (GET /api/game-room/games only ever reads the
// legacy registry).
//
// Every entry today is metadata only -- declaring an engine here does
// NOT mean it's playable. `status` says how far along it is; per this
// phase's explicit scope, no engine is implemented yet (all are
// COMING_SOON), and Classic Quiz -- the only one with real gameplay
// planned first -- stays COMING_SOON until its actual session/scoring
// logic exists. This registry exists now so the compatibility-matching
// design (a GameRoomQuestionSet -> which engines can play it) has real
// data to be built and eyeballed against before the first engine is
// implemented.
export const GAME_ENGINES_V2: GameEngine[] = [
  {
    id: 'classic-quiz',
    name: 'Classic Quiz',
    tamilName: 'வினாடி வினா',
    description: 'A straightforward question-by-question quiz, closest in spirit to legacy GameRoom\'s quiz games.',
    icon: null,
    thumbnail: null,
    compatibility: {
      supportedQuestionTypes: ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'IMAGE_CHOICE', 'TEXT_INPUT', 'AUDIO_CHOICE'],
      soloSupport: true,
      multiplayerSupport: true,
      liveClassroomSupport: true,
      homeworkSupport: true,
      minPlayers: 1,
      maxPlayers: 60,
    },
    recommendedLevel: null,
    estimatedDurationMinutes: 10,
    status: 'COMING_SOON',
    version: '0.0.0',
  },
  {
    id: 'tower-defense',
    name: 'Tower Defense',
    tamilName: null,
    description: 'Answer correctly to build/upgrade defenses against waves of enemies.',
    icon: null,
    thumbnail: null,
    compatibility: {
      supportedQuestionTypes: ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'CATEGORIZE'],
      soloSupport: true,
      multiplayerSupport: false,
      liveClassroomSupport: false,
      homeworkSupport: true,
      minPlayers: 1,
      maxPlayers: 1,
    },
    recommendedLevel: null,
    estimatedDurationMinutes: 15,
    status: 'COMING_SOON',
    version: '0.0.0',
  },
  {
    id: 'boss-battle',
    name: 'Boss Battle',
    tamilName: null,
    description: 'Chip away at a boss\'s health bar by answering correctly under time pressure.',
    icon: null,
    thumbnail: null,
    compatibility: {
      supportedQuestionTypes: ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'TEXT_INPUT'],
      soloSupport: true,
      multiplayerSupport: true,
      liveClassroomSupport: true,
      homeworkSupport: false,
      minPlayers: 1,
      maxPlayers: 4,
    },
    recommendedLevel: null,
    estimatedDurationMinutes: 8,
    status: 'COMING_SOON',
    version: '0.0.0',
  },
  {
    id: 'racing',
    name: 'Racing',
    tamilName: null,
    description: 'Correct answers move a racer forward -- first to the finish line wins.',
    icon: null,
    thumbnail: null,
    compatibility: {
      supportedQuestionTypes: ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'ORDER_WORDS', 'ORDER_LETTERS'],
      soloSupport: false,
      multiplayerSupport: true,
      liveClassroomSupport: true,
      homeworkSupport: false,
      minPlayers: 2,
      maxPlayers: 8,
    },
    recommendedLevel: null,
    estimatedDurationMinutes: 5,
    status: 'COMING_SOON',
    version: '0.0.0',
  },
  {
    id: 'treasure-quest',
    name: 'Treasure Quest',
    tamilName: null,
    description: 'Explore a map, unlocking chests by answering questions correctly along the way.',
    icon: null,
    thumbnail: null,
    compatibility: {
      supportedQuestionTypes: ['MULTIPLE_CHOICE', 'MATCH', 'FILL_BLANK', 'CATEGORIZE'],
      soloSupport: true,
      multiplayerSupport: false,
      liveClassroomSupport: false,
      homeworkSupport: true,
      minPlayers: 1,
      maxPlayers: 1,
    },
    recommendedLevel: null,
    estimatedDurationMinutes: 12,
    status: 'COMING_SOON',
    version: '0.0.0',
  },
  {
    id: 'word-ninja',
    name: 'Word Ninja',
    tamilName: null,
    description: 'Slice the correct word or letter as it flies past before time runs out.',
    icon: null,
    thumbnail: null,
    compatibility: {
      supportedQuestionTypes: ['MULTIPLE_CHOICE', 'ORDER_LETTERS', 'ORDER_WORDS'],
      soloSupport: true,
      multiplayerSupport: false,
      liveClassroomSupport: false,
      homeworkSupport: true,
      minPlayers: 1,
      maxPlayers: 1,
    },
    recommendedLevel: null,
    estimatedDurationMinutes: 6,
    status: 'COMING_SOON',
    version: '0.0.0',
  },
  {
    id: 'space-mission',
    name: 'Space Mission',
    tamilName: null,
    description: 'Pilot a ship between planets, solving questions to refuel and reach the next system.',
    icon: null,
    thumbnail: null,
    compatibility: {
      supportedQuestionTypes: ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK'],
      soloSupport: true,
      multiplayerSupport: false,
      liveClassroomSupport: false,
      homeworkSupport: true,
      minPlayers: 1,
      maxPlayers: 1,
    },
    recommendedLevel: null,
    estimatedDurationMinutes: 10,
    status: 'COMING_SOON',
    version: '0.0.0',
  },
  {
    id: 'kingdom-builder',
    name: 'Kingdom Builder',
    tamilName: null,
    description: 'Earn resources by answering correctly and grow your own kingdom over time.',
    icon: null,
    thumbnail: null,
    compatibility: {
      supportedQuestionTypes: ['MULTIPLE_CHOICE', 'CATEGORIZE', 'MATCH'],
      soloSupport: true,
      multiplayerSupport: false,
      liveClassroomSupport: false,
      homeworkSupport: true,
      minPlayers: 1,
      maxPlayers: 1,
    },
    recommendedLevel: null,
    estimatedDurationMinutes: 15,
    status: 'COMING_SOON',
    version: '0.0.0',
  },
  {
    id: 'mystery-mansion',
    name: 'Mystery Mansion',
    tamilName: null,
    description: 'Search room to room for clues, answering questions correctly to unlock the next door.',
    icon: null,
    thumbnail: null,
    compatibility: {
      supportedQuestionTypes: ['MULTIPLE_CHOICE', 'TEXT_INPUT', 'FILL_BLANK'],
      soloSupport: true,
      multiplayerSupport: false,
      liveClassroomSupport: false,
      homeworkSupport: true,
      minPlayers: 1,
      maxPlayers: 1,
    },
    recommendedLevel: null,
    estimatedDurationMinutes: 12,
    status: 'COMING_SOON',
    version: '0.0.0',
  },
  // Lightweight/legacy-style activities -- the same familiar shapes
  // legacy GameRoom already has (crossword: tamilWordFormation;
  // matching: inaEzhuthukkalMatchingModule/pairMatchGame; memory: the
  // *MemoryModule interactive games), represented here as V2 engines in
  // their own right so a question set author isn't limited to the
  // bigger arcade-style engines above. These reuse none of legacy
  // GameRoom's code -- see lib/gameRoomV2/README.md's isolation
  // requirement -- they're new V2 engines with a deliberately familiar
  // shape.
  {
    id: 'crossword',
    name: 'Crossword',
    tamilName: null,
    description: 'Fill in a crossword grid using clues drawn from the question set.',
    icon: null,
    thumbnail: null,
    compatibility: {
      supportedQuestionTypes: ['FILL_BLANK', 'TEXT_INPUT'],
      soloSupport: true,
      multiplayerSupport: false,
      liveClassroomSupport: false,
      homeworkSupport: true,
      minPlayers: 1,
      maxPlayers: 1,
    },
    recommendedLevel: null,
    estimatedDurationMinutes: 10,
    status: 'COMING_SOON',
    version: '0.0.0',
  },
  {
    id: 'matching',
    name: 'Matching',
    tamilName: null,
    description: 'Pair up related items -- letters, words, or meanings -- as fast as you can.',
    icon: null,
    thumbnail: null,
    compatibility: {
      supportedQuestionTypes: ['MATCH'],
      soloSupport: true,
      multiplayerSupport: false,
      liveClassroomSupport: false,
      homeworkSupport: true,
      minPlayers: 1,
      maxPlayers: 1,
    },
    recommendedLevel: null,
    estimatedDurationMinutes: 5,
    status: 'COMING_SOON',
    version: '0.0.0',
  },
  {
    id: 'memory',
    name: 'Memory',
    tamilName: null,
    description: 'Flip cards to find matching pairs and train your recall.',
    icon: null,
    thumbnail: null,
    compatibility: {
      supportedQuestionTypes: ['MATCH', 'IMAGE_CHOICE'],
      soloSupport: true,
      multiplayerSupport: false,
      liveClassroomSupport: false,
      homeworkSupport: true,
      minPlayers: 1,
      maxPlayers: 1,
    },
    recommendedLevel: null,
    estimatedDurationMinutes: 5,
    status: 'COMING_SOON',
    version: '0.0.0',
  },
]

export function getGameEngineV2(id: string): GameEngine | undefined {
  return GAME_ENGINES_V2.find((e) => e.id === id)
}

// Engines whose declared compatibility.supportedQuestionTypes fully
// covers every question type actually present in a question set --
// i.e. every question in the set can be rendered by the engine. This
// is the concrete mechanism behind "a Question Set may later be played
// through multiple compatible game engines": nothing hardcodes which
// engines go with which sets, it's derived from these two
// declarations every time.
export function compatibleEnginesForQuestionTypes(questionTypes: string[]) {
  return GAME_ENGINES_V2.filter((engine) =>
    questionTypes.every((t) => engine.compatibility.supportedQuestionTypes.includes(t as never))
  )
}
