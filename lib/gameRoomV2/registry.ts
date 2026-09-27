import type { GameEngine, GameRoomQuestionType } from './domain'

// Every single-question shape the shared QuestionOverlay/QuestionInput
// renders as one self-contained checkpoint question. CATEGORIZE and MATCH
// are left out on purpose: their overlay forms are a fallback, and the
// games built for them (Word Ninja, Matching, Memory) play them properly.
export const CHECKPOINT_QUESTION_TYPES: GameRoomQuestionType[] = [
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'IMAGE_CHOICE',
  'AUDIO_CHOICE',
  'TEXT_INPUT',
  'FILL_BLANK',
  'ORDER_LETTERS',
  'ORDER_WORDS',
]

const CHECKPOINT_REQUIREMENT = {
  en: 'Requires quiz-style questions (choice, true/false, short answer, fill-in or ordering)',
  ta: 'வினாடி வினா வகை வினாக்கள் தேவை',
}

// THE authoritative GameRoom V2 game registry. Every GameRoom surface
// (Choose a Game, Library cards, Builder, Import, student home, Learning
// Boards/topics, Quick Play, Host Live, the session/live launch routes)
// derives which games exist, which are playable, and which can play a
// given question set from THIS list -- through the pure helpers in
// lib/gameRoomV2/gameAvailability.ts. No screen keeps its own list of
// game ids or compares statuses itself;
// scripts/verify-gameroom-v2-game-registry.ts fails the build if one does.
//
// Entirely separate from lib/gameRoom/registry.ts (legacy GameRoom's
// GAME_MODULES) -- nothing here is read by any legacy route or page.
//
// Order here is display order everywhere: the seven ACTIVE games first
// (Classic Quiz, Tower Defense, Racing, Boss Battle, Word Ninja,
// Matching, Memory), then COMING_SOON concepts, then HIDDEN ones.
//
// `id` is also the game's URL slug (?game=<id>) and the engine_id stored
// on session rows -- it never changes once shipped.
//
// supportedQuestionTypes must describe what the engine ACTUALLY renders.
// Tower Defense, Racing, Boss Battle and Classic Quiz ask every question
// through the shared QuestionOverlay -> QuestionInput, which renders (and
// gradeAnswer grades) every CHECKPOINT_QUESTION_TYPES shape -- so they
// declare all of them. Under-declaring here is exactly what used to make
// Tower Defense and Racing vanish from Choose a Game for teacher-made
// short-answer sets.
export const GAME_ENGINES_V2: GameEngine[] = [
  {
    id: 'classic-quiz',
    name: 'Classic Quiz',
    tamilName: 'வினாடி வினா',
    description: 'A straightforward question-by-question quiz -- read each question and pick the right answer.',
    icon: null,
    thumbnail: null,
    compatibility: {
      // Classic Quiz IS the shared runtime (GameSessionRuntime ->
      // QuestionInput): every quiz-style question. Matching-pair and
      // sorting sets belong to Matching/Memory/Word Ninja instead.
      supportedQuestionTypes: [...CHECKPOINT_QUESTION_TYPES],
      soloSupport: true,
      multiplayerSupport: true,
      liveClassroomSupport: true,
      homeworkSupport: true,
      minPlayers: 1,
      maxPlayers: 60,
    },
    recommendedLevel: null,
    estimatedDurationMinutes: 10,
    // A thin reference engine that mounts components/gameRoomV2/
    // gameplay's GameSessionRuntime directly with no extra visual layer
    // of its own -- a plain question-by-question quiz IS exactly what
    // the shared runtime already provides.
    requirement: CHECKPOINT_REQUIREMENT,
    recommendedQuestionTypes: ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'TEXT_INPUT'],
    status: 'ACTIVE',
    version: '0.1.0',
  },
  {
    id: 'tower-defense',
    name: 'Tower Defense',
    tamilName: 'கோட்டை காப்போம்',
    description: 'Answer correctly to build/upgrade defenses against waves of enemies.',
    icon: null,
    thumbnail: null,
    compatibility: {
      // Build-phase questions go through QuestionOverlay (see the header).
      supportedQuestionTypes: [...CHECKPOINT_QUESTION_TYPES, 'CATEGORIZE'],
      soloSupport: true,
      multiplayerSupport: false,
      // Live Classroom: each student plays their own game on a session the
      // shared live system creates (same question order for the class,
      // server grading) -- see LivePlayClient.tsx and engineBranch.ts.
      liveClassroomSupport: true,
      homeworkSupport: true,
      minPlayers: 1,
      maxPlayers: 1,
    },
    requirement: CHECKPOINT_REQUIREMENT,
    recommendedQuestionTypes: ['MULTIPLE_CHOICE', 'TRUE_FALSE'],
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
    id: 'racing',
    name: 'Racing',
    tamilName: 'தமிழ்ப் பந்தயம்',
    description: 'Correct answers boost your racer forward -- accuracy wins the race, not button speed.',
    icon: null,
    thumbnail: null,
    compatibility: {
      // Checkpoint questions go through QuestionOverlay (see the header).
      supportedQuestionTypes: [...CHECKPOINT_QUESTION_TYPES],
      // ONE user-facing Racing game. engine id 'racing' is rendered by
      // components/gameRoomV2/racing/RacingGame.tsx, which mounts the
      // pseudo-3D racing3d implementation (RaceGame3D solo, LiveRace3D in
      // Live Classroom); the old top-down racer no longer exists.
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
    requirement: CHECKPOINT_REQUIREMENT,
    recommendedQuestionTypes: ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'ORDER_LETTERS', 'ORDER_WORDS'],
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
    id: 'boss-battle',
    name: 'Boss Battle',
    tamilName: 'இருள் அரசனுடன் போர்',
    description: 'Battle waves of shadow creatures in a real-time arena, level up your hero, and defeat the Irul King. Tamil checkpoints heal you and unlock golden upgrades.',
    icon: null,
    thumbnail: null,
    compatibility: {
      // Checkpoint questions go through QuestionOverlay (see the header).
      supportedQuestionTypes: [...CHECKPOINT_QUESTION_TYPES],
      soloSupport: true,
      // Solo mode: a real-time top-down arena brawler -- the student
      // moves a hero through four waves and two bosses; Tamil questions
      // are asked at checkpoints (components/gameRoomV2/bossBattle/brawl,
      // lib/gameRoomV2/bossBattle/brawl).
      //
      // Cooperative multiplayer (Live Classroom only, since it needs a
      // shared boss + difficulty every attacker fights identically --
      // see migration 082): genuinely shipped, and deliberately a
      // DIFFERENT mechanic from solo, not just a multiplayer wrapper
      // around it. The whole class shares ONE boss health pool; there is
      // NO individual player health, NO boss counterattack, and NO
      // defeat state in cooperative mode -- a wrong answer has no public
      // consequence at all, so a student can always recover fully on the
      // next question (see lib/gameRoomV2/bossBattle/coopBattle.ts's
      // header comment for the full "no naming/shaming" rationale). Boss
      // HP is never client-reported; it's derived server-side from the
      // sum of every participant's already-persisted correct-answer
      // count (buildCoopBattleState), polled at a deliberately coarse
      // ~1.5s HTTP cadence (CoopBossBattleGame), not pushed over Realtime
      // on every tick. Streaks trigger celebratory, PUBLIC-but-never-
      // negative "team attack" bonus damage bursts -- see
      // scripts/verify-gameroom-v2-boss-battle-multiplayer.ts.
      multiplayerSupport: true,
      liveClassroomSupport: true,
      homeworkSupport: true,
      minPlayers: 1,
      maxPlayers: 4,
    },
    requirement: CHECKPOINT_REQUIREMENT,
    recommendedQuestionTypes: ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'TEXT_INPUT'],
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
    id: 'word-ninja',
    name: 'Word Ninja',
    tamilName: 'சொல் வீரன்',
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
      // Live Classroom: each student plays their own game on a session the
      // shared live system creates (same question order for the class,
      // server grading) -- see LivePlayClient.tsx and engineBranch.ts.
      liveClassroomSupport: true,
      homeworkSupport: true,
      minPlayers: 1,
      maxPlayers: 1,
    },
    requirement: { en: 'Requires sorting (categorize) questions', ta: 'வகைப்படுத்தும் வினாக்கள் தேவை' },
    recommendedQuestionTypes: ['CATEGORIZE'],
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
    id: 'matching',
    name: 'Matching',
    tamilName: 'பொருத்துக',
    description: 'Pair up related items -- letters, words, or meanings -- as fast as you can.',
    icon: null,
    thumbnail: null,
    compatibility: {
      supportedQuestionTypes: ['MATCH'],
      soloSupport: true,
      multiplayerSupport: false,
      // Live Classroom: each student plays their own game on a session the
      // shared live system creates (same question order for the class,
      // server grading) -- see LivePlayClient.tsx and engineBranch.ts.
      liveClassroomSupport: true,
      homeworkSupport: true,
      minPlayers: 1,
      maxPlayers: 1,
    },
    requirement: { en: 'Requires matching-pair questions', ta: 'பொருத்தும் இணை வினாக்கள் தேவை' },
    recommendedQuestionTypes: ['MATCH'],
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
    tamilName: 'நினைவுப் பெட்டகம்',
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
      // Live Classroom: each student plays their own game on a session the
      // shared live system creates (same question order for the class,
      // server grading) -- see LivePlayClient.tsx and engineBranch.ts.
      liveClassroomSupport: true,
      homeworkSupport: true,
      minPlayers: 1,
      maxPlayers: 1,
    },
    requirement: { en: 'Requires matching-pair questions', ta: 'பொருத்தும் இணை வினாக்கள் தேவை' },
    recommendedQuestionTypes: ['MATCH'],
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
  // --- Not playable: listed only in a separate "Coming Soon" section ---
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
    // Hidden in the gameplay overhaul: its play loop is still a quiz
    // with a light theme, not yet a real game. Code kept for a rebuild.
    status: 'COMING_SOON',
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
    // Hidden in the gameplay overhaul: its play loop is still a quiz
    // with a light theme, not yet a real game. Code kept for a rebuild.
    status: 'COMING_SOON',
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
    // Hidden in the gameplay overhaul: its play loop is still a quiz
    // with a light theme, not yet a real game. Code kept for a rebuild.
    status: 'COMING_SOON',
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
    // Hidden in the gameplay overhaul: its play loop is still a quiz
    // with a light theme, not yet a real game. Code kept for a rebuild.
    status: 'COMING_SOON',
    version: '0.1.0',
  },
  // --- HIDDEN: on no GameRoom surface at all ---
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
    // Never built -- no gameplay exists at all, so it is not even
    // advertised as Coming Soon.
    status: 'HIDDEN',
    version: '0.0.0',
  },
]

export function getGameEngineV2(id: string): GameEngine | undefined {
  return GAME_ENGINES_V2.find((e) => e.id === id)
}

// Raw type-coverage check, ignoring status. Screens should use
// lib/gameRoomV2/gameAvailability.ts instead, which also applies status.
export function compatibleEnginesForQuestionTypes(questionTypes: string[]) {
  return GAME_ENGINES_V2.filter((engine) =>
    questionTypes.every((t) => engine.compatibility.supportedQuestionTypes.includes(t as never))
  )
}
