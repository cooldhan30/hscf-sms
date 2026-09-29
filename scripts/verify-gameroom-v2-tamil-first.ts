// Tamil-first student UI in the seven active GameRoom games:
//   1. the shared vocabulary (lib/gameRoomV2/i18n/ta.ts) is complete
//      Tamil, with a short English gloss for every entry
//   2. every student-facing surface of every active game shows Tamil in
//      the Tamizhi Tamil font (font-tamil)
//   3. the English-only chrome each screen used to show is gone
//   4. content is never run through the glossary: question prompts,
//      answers, explanations and names are rendered as authored
//
//   npx tsx scripts/verify-gameroom-v2-tamil-first.ts
import { readFileSync } from 'fs'
import { TA, GAME_TAMIL_NAMES } from '../lib/gameRoomV2/i18n/ta'
import { GAME_ENGINES_V2 } from '../lib/gameRoomV2/registry'

let failures = 0
let passes = 0
function assert(cond: unknown, msg: string) {
  if (cond) passes++
  else {
    failures++
    console.error(`  FAIL: ${msg}`)
  }
}
const read = (f: string) => readFileSync(f, 'utf8')
const TAMIL = /[஀-௿]/

console.log('1. Vocabulary')
for (const [k, v] of Object.entries(TA)) {
  assert(TAMIL.test(v.ta), `TA.${k} is Tamil`)
  assert(v.en.trim().length > 0 && !TAMIL.test(v.en), `TA.${k} has an English gloss`)
}
const active = GAME_ENGINES_V2.filter((e) => e.status === 'ACTIVE')
assert(active.length === 8, `8 active games (got ${active.length})`)
for (const e of active) {
  assert(e.tamilName && TAMIL.test(e.tamilName), `${e.id} has a Tamil name in the registry`)
  assert(GAME_TAMIL_NAMES[e.id] === e.tamilName, `${e.id}: glossary and registry agree`)
}

console.log('2-3. Student surfaces')
// file -> English-only strings that must no longer be shown on their own.
const SURFACES: Record<string, string[]> = {
  // Shared by every game (Classic Quiz runs entirely on these).
  'components/gameRoomV2/gameplay/QuestionInput.tsx': ['label="True"', 'placeholder="Type your answer..."', 'Submit Order', 'Submit Matches'],
  'components/gameRoomV2/gameplay/GameSessionRuntime.tsx': ['>Game exited<', '>Paused<', 'label="Loading game..."'],
  'components/gameRoomV2/gameplay/GameResultsScreen.tsx': ["'Game complete'", 'label="Score"', 'Achievement Unlocked!', 'Back to Game Room\n'],
  'components/gameRoomV2/gameplay/GameHUD.tsx': ['aria-label="Exit game"'],
  'components/gameRoomV2/gameplay/ArenaHud.tsx': ['aria-label="Exit game"'],
  'components/gameRoomV2/StateScreens.tsx': ["title = 'Something went wrong'"],
  // Tower Defense
  'components/gameRoomV2/towerDefense/TowerDefenseGame.tsx': ["title: 'WAVE CLEARED!'", '> CORRECT!', '> NOT QUITE', '>Your answer<', 'Preparing the battlefield...'],
  'components/gameRoomV2/towerDefense/TdResults.tsx': ["'VICTORY!'", "stat('Waves survived'"],
  'components/gameRoomV2/towerDefense/DifficultyPicker.tsx': ['> Start the defence'],
  'components/gameRoomV2/towerDefense/TowerShop.tsx': ["'Fast spears'", '>Build a tower<'],
  // Boss Battle
  'components/gameRoomV2/bossBattle/brawl/BrawlGame.tsx': ["title: 'WAVE CLEARED!'", "'LEVEL UP!'", '> CORRECT!', '>Your answer<', 'Opening the arena...'],
  'components/gameRoomV2/bossBattle/brawl/BrawlSetup.tsx': ['>Choose your arena<', '> Enter the arena\n'],
  'components/gameRoomV2/bossBattle/brawl/BrawlResults.tsx': ["'DEFEATED'", "stat('Waves cleared'"],
  // Racing
  'components/gameRoomV2/racing3d/RaceGame3D.tsx': ["'FINAL LAP!'", "'NOT QUITE'", 'Cars to the grid...'],
  'components/gameRoomV2/racing3d/TrackPicker.tsx': ['>Choose a track<'],
  'components/gameRoomV2/racing/RaceCelebration.tsx': ["'1st PLACE!'", 'Saving your race and XP...'],
  'components/gameRoomV2/racing/RacingGame.tsx': ['Race Paused'],
  'components/gameRoomV2/racing/MultiplayerFinishScreen.tsx': ['Race Complete!'],
  // Word Ninja
  'components/gameRoomV2/wordNinja/WordNinjaGame.tsx': ["'Dojo mastered!'", "'Checking your lanes...'"],
  'components/gameRoomV2/wordNinja/NinjaSetupPicker.tsx': ['font-bold mt-1">The Word Dojo</h1>'],
  // Matching
  'components/gameRoomV2/matching/MatchingGame.tsx': ["'Perfect pairing!'", '>Paused<'],
  'components/gameRoomV2/matching/MatchingSetupPicker.tsx': ['dark:text-white">Matching</h2>'],
  // Memory
  'components/gameRoomV2/memory/MemoryGame.tsx': ["'Perfect memory!'", '>Paused<'],
  'components/gameRoomV2/memory/MemorySetupPicker.tsx': ['dark:text-white">Memory</h2>'],
  // Live Classroom (the student lobby and the join box)
  'app/gameroom-v2/live/play/[id]/LivePlayClient.tsx': [],
  'components/gameRoomV2/liveClassroom/JoinLiveBox.tsx': [],
}
for (const [file, gone] of Object.entries(SURFACES)) {
  const src = read(file)
  assert(TAMIL.test(src) || /<Bi |ta\(|TA\./.test(src), `${file}: shows Tamil`)
  // GameHUD is icon-only; its Tamil lives in aria-labels and the
  // progress label, rendered by components that set the font.
  if (!file.endsWith('GameHUD.tsx')) assert(/font-tamil|<Bi /.test(src), `${file}: uses the Tamil font`)
  for (const g of gone) assert(!src.includes(g), `${file}: English-only "${g.trim()}" replaced`)
}

console.log('4. Content is never translated')
const ALL = Object.keys(SURFACES).map((f) => [f, read(f)] as const)
for (const [file, src] of ALL) {
  assert(!/(ta|TA)\([^)]*(prompt|answer|explanation|nickname|name)\b/.test(src), `${file}: no glossary lookup on content`)
}
const overlay = read('components/gameRoomV2/gameplay/QuestionOverlay.tsx')
assert(/prompt=\{question\.prompt\}/.test(overlay), 'question prompts are rendered as authored')
const input = read('components/gameRoomV2/gameplay/QuestionInput.tsx')
assert(/label=\{opt\}/.test(input), 'answer options are rendered as authored')
assert(/onSubmit\(true\)/.test(input) && /onSubmit\(false\)/.test(input), 'true/false still submits booleans (labels only are Tamil)')

console.log(`\n${passes} passed, ${failures} failed`)
if (failures) {
  console.error('TAMIL-FIRST VERIFICATION FAILED')
  process.exit(1)
}
console.log('TAMIL-FIRST VERIFICATION PASSED')
