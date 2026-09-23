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
    // The one engine with real gameplay today -- a thin reference
    // implementation that mounts components/gameRoomV2/gameplay's
    // GameSessionRuntime directly with no extra visual layer of its
    // own, since a plain question-by-question quiz IS exactly what the
    // shared runtime already provides. Exists specifically to prove
    // the gameplay framework end-to-end (session lifecycle, scoring,
    // XP/coins, results) with a real, playable engine, while every
    // other engine (Tower Defense included) stays COMING_SOON
    // untouched per this phase's explicit scope.
    status: 'ACTIVE',
    version: '0.1.0',
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
    // The second real, playable engine (after Classic Quiz) -- a full
    // battlefield built around QuestionOverlay/the shared session
    // routes rather than GameSessionRuntime directly, per that
    // component's own documented extension point for engines that want
    // their own visual frame. See components/gameRoomV2/towerDefense/
    // TowerDefenseGame.tsx.
    status: 'ACTIVE',
    version: '0.1.0',
  },
  {
    id: 'boss-battle',
    name: 'Boss Battle',
    tamilName: null,
    description: 'Chip away at a multi-phase boss\'s health with correct answers and abilities.',
    icon: null,
    thumbnail: null,
    compatibility: {
      supportedQuestionTypes: ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'TEXT_INPUT'],
      soloSupport: true,
      // Ships solo today (one student vs. a phased boss) with the
      // battle simulation already shaped for multiple attackers sharing
      // one boss's health pool (see lib/gameRoomV2/bossBattle/battle.ts's
      // AttackerState/applyCorrectAnswerDamage) -- multiplayerSupport
      // stays declared as a real target capability ("architecture ready
      // for classroom co-op"), but no SHARED-boss-health-across-students
      // real-time sync exists yet -- that's still architecture, not a
      // shipped co-op mode. liveClassroomSupport is a DIFFERENT,
      // narrower claim that IS now genuinely shipped: a teacher can host
      // a Boss Battle live session, and every joined student plays their
      // own independent boss fight simultaneously, with the host seeing
      // a real-time leaderboard aggregated server-side from each
      // student's own sms_gamev2_sessions row (app/gameroom-v2/live/
      // play/[id]/LivePlayClient.tsx branches to BossBattleGame; see
      // scripts/verify-gameroom-v2-live-classroom.ts). Multiple students
      // fighting the SAME shared boss together is the multiplayerSupport
      // gap above, not this one.
      multiplayerSupport: true,
      liveClassroomSupport: true,
      homeworkSupport: true,
      minPlayers: 1,
      maxPlayers: 4,
    },
    recommendedLevel: null,
    estimatedDurationMinutes: 8,
    // The fourth real, playable engine (after Classic Quiz, Tower
    // Defense, and Racing) -- built around QuestionOverlay/the shared
    // session routes the same way. See
    // components/gameRoomV2/bossBattle/BossBattleGame.tsx.
    status: 'ACTIVE',
    version: '0.1.0',
  },
  {
    id: 'racing',
    name: 'Racing',
    tamilName: null,
    description: 'Correct answers boost your racer forward -- accuracy wins the race, not button speed.',
    icon: null,
    thumbnail: null,
    compatibility: {
      supportedQuestionTypes: ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'ORDER_WORDS', 'ORDER_LETTERS'],
      // Solo mode: a student races a scripted rival, ticked locally at
      // 100ms resolution (components/gameRoomV2/racing/RacingGame.tsx's
      // SoloRacingGame).
      //
      // Multiplayer (Live Classroom only, since it needs a shared
      // question_order + a shared race_difficulty every racer runs
      // identically -- see migration 081): genuinely shipped. Every
      // joined participant IS one racer on the SAME shared track, and
      // every viewer (each racer's own screen, plus the teacher's
      // RaceTrackOverview) sees every OTHER racer's live, server-
      // authoritative position -- not a solo-vs-rival simulation per
      // student. Racer distance is never client-reported; it's replayed
      // server-side from each participant's own answer history (see
      // lib/gameRoomV2/racing/race.ts's replayRacerFromAnswers) and
      // polled at a deliberately coarse ~1.5s HTTP cadence
      // (MultiplayerRacingGame), not pushed over Realtime on every
      // physics tick -- meaningful gameplay state is synchronized;
      // animation between polls is smoothed locally. This IS real
      // multiplayer racing, just polled rather than push-synced at
      // sub-second resolution -- see
      // scripts/verify-gameroom-v2-racing-multiplayer.ts.
      soloSupport: true,
      multiplayerSupport: true,
      liveClassroomSupport: true,
      homeworkSupport: true,
      minPlayers: 1,
      maxPlayers: 8,
    },
    recommendedLevel: null,
    estimatedDurationMinutes: 5,
    // The third real, playable engine (after Classic Quiz and Tower
    // Defense) -- built around QuestionOverlay/the shared session
    // routes the same way Tower Defense is. See
    // components/gameRoomV2/racing/RacingGame.tsx.
    status: 'ACTIVE',
    version: '0.1.0',
  },
  {
    id: 'treasure-quest',
    name: 'Treasure Quest',
    tamilName: null,
    description: 'Explore rooms, earn keys from correct answers, and unlock your way to the treasure.',
    icon: null,
    thumbnail: null,
    compatibility: {
      // TEXT_INPUT and TRUE_FALSE added alongside MULTIPLE_CHOICE/
      // FILL_BLANK/MATCH/CATEGORIZE specifically for reading-
      // comprehension-style content (a passage prompt with a
      // free-response or true/false check) -- the room/key/clue
      // exploration layer itself has no opinion on question type, this
      // only widens which Question Sets are compatible.
      supportedQuestionTypes: ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'TEXT_INPUT', 'MATCH', 'FILL_BLANK', 'CATEGORIZE'],
      soloSupport: true,
      multiplayerSupport: false,
      liveClassroomSupport: false,
      homeworkSupport: true,
      minPlayers: 1,
      maxPlayers: 1,
    },
    recommendedLevel: null,
    estimatedDurationMinutes: 12,
    // The fifth real, playable engine (after Classic Quiz, Tower
    // Defense, Racing, and Boss Battle) -- built around QuestionOverlay/
    // the shared session routes the same way. See
    // components/gameRoomV2/treasureQuest/TreasureQuestGame.tsx.
    status: 'ACTIVE',
    version: '0.1.0',
  },
  {
    id: 'word-ninja',
    name: 'Word Ninja',
    tamilName: null,
    description: 'Slash flying words into the correct category lane before time runs out.',
    icon: null,
    thumbnail: null,
    compatibility: {
      // CATEGORIZE only -- Word Ninja's mechanic (N lanes, one per
      // category, words slashed into the lane the player believes fits)
      // is a reusable renderer for ANY CATEGORIZE question, generic over
      // category count. This is deliberately the ONLY supported type:
      // the 5 grammar categories the request names (பெயர்ச்சொல்/
      // வினைச்சொல், ஒருமை/பன்மை, உயர்திணை/அஃறிணை,
      // வல்லினம்/மெல்லினம்/இடையினம்) are teacher-authored CATEGORIZE
      // Question Sets, not anything hardcoded in this engine -- see
      // lib/gameRoomV2/wordNinja/lanes.ts's header comment.
      supportedQuestionTypes: ['CATEGORIZE'],
      soloSupport: true,
      multiplayerSupport: false,
      liveClassroomSupport: false,
      homeworkSupport: true,
      minPlayers: 1,
      maxPlayers: 1,
    },
    recommendedLevel: null,
    estimatedDurationMinutes: 6,
    // The sixth real, playable engine (after Classic Quiz, Tower
    // Defense, Racing, Boss Battle, and Treasure Quest) -- built around
    // the shared session routes (not QuestionOverlay/QuestionInput
    // directly, since the lane-slashing interaction is a genuinely
    // different UI than CategorizeInput's dropdown form -- both submit
    // the identical Record<item, category> shape to the same /answer
    // route). See components/gameRoomV2/wordNinja/WordNinjaGame.tsx.
    status: 'ACTIVE',
    version: '0.1.0',
  },
  {
    id: 'space-mission',
    name: 'Space Mission',
    tamilName: null,
    description: 'Pilot a ship between planets, solving questions to power thrusters and recharge shields on the way to the next system.',
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
    // The seventh real, playable engine (after Classic Quiz, Tower
    // Defense, Racing, Boss Battle, Treasure Quest, and Word Ninja) --
    // built around QuestionOverlay/GameHUD/the shared session routes the
    // same way. Promoted from BETA to ACTIVE only after
    // scripts/verify-gameroom-v2-space-mission.ts and the full
    // verify-gameroom-v2-*.ts suite, tsc, lint, and build all passed. See
    // lib/gameRoomV2/spaceMission/* and
    // components/gameRoomV2/spaceMission/SpaceMissionGame.tsx.
    status: 'ACTIVE',
    version: '0.1.0',
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
    // The eighth real, playable engine (after Classic Quiz, Tower
    // Defense, Racing, Boss Battle, Treasure Quest, Word Ninja, and
    // Space Mission) -- built around QuestionOverlay/GameHUD/the shared
    // session routes the same way. Promoted from BETA to ACTIVE only
    // after scripts/verify-gameroom-v2-kingdom-builder.ts and the full
    // verify-gameroom-v2-*.ts suite, tsc, lint, and build all passed. See
    // lib/gameRoomV2/kingdomBuilder/* and
    // components/gameRoomV2/kingdomBuilder/KingdomBuilderGame.tsx.
    status: 'ACTIVE',
    version: '0.1.0',
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
    // The ninth real, playable engine (after Classic Quiz, Tower
    // Defense, Racing, Boss Battle, Treasure Quest, Word Ninja, Space
    // Mission, and Kingdom Builder) -- built around
    // QuestionOverlay/GameHUD/the shared session routes the same way.
    // Promoted from BETA to ACTIVE only after
    // scripts/verify-gameroom-v2-mystery-mansion.ts and the full
    // verify-gameroom-v2-*.ts suite, tsc, lint, and build all passed. See
    // lib/gameRoomV2/mysteryMansion/* and
    // components/gameRoomV2/mysteryMansion/MysteryMansionGame.tsx.
    status: 'ACTIVE',
    version: '0.1.0',
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
    // The tenth real, playable engine -- a reusable shared card/grid
    // layer (lib/gameRoomV2/cardGrid + components/gameRoomV2/cardGrid,
    // shared with Memory below) with Matching's own tap-to-pair round
    // logic on top. Promoted from BETA to ACTIVE only after
    // scripts/verify-gameroom-v2-matching.ts and the full
    // verify-gameroom-v2-*.ts suite, tsc, lint, and build all passed. See
    // lib/gameRoomV2/matching/* and
    // components/gameRoomV2/matching/MatchingGame.tsx.
    status: 'ACTIVE',
    version: '0.1.0',
  },
  {
    id: 'memory',
    name: 'Memory',
    tamilName: null,
    description: 'Flip cards to find matching pairs and train your recall.',
    icon: null,
    thumbnail: null,
    compatibility: {
      // MATCH only, not IMAGE_CHOICE -- a classic memory pairing needs
      // two items with an actual RELATIONSHIP (pairs.left/right), which
      // is exactly what MATCH's payload provides and IMAGE_CHOICE (a
      // single-answer image select, no pair structure) does not. Declaring
      // IMAGE_CHOICE support here would overstate what the engine
      // actually does, per this registry's own "shipped, not
      // aspirational" convention.
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
    // The eleventh real, playable engine -- built on the same shared
    // card/grid layer as Matching, with Memory's own flip-and-remember
    // round logic on top. Promoted from BETA to ACTIVE only after
    // scripts/verify-gameroom-v2-memory.ts and the full
    // verify-gameroom-v2-*.ts suite, tsc, lint, and build all passed. See
    // lib/gameRoomV2/memory/* and components/gameRoomV2/memory/MemoryGame.tsx.
    status: 'ACTIVE',
    version: '0.1.0',
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
