// GameRoom game registry / availability consistency verifier.
//
// Guards the bug where Tower Defense and Racing vanished from
// My Question Sets -> Choose a Game for a teacher-made (imported,
// short-answer) set while Coming Soon games filled the grid instead.
//
//   1. Registry: exactly the seven ACTIVE games, in display order; the
//      Coming Soon concepts; nothing duplicated (ONE Racing, backed by
//      racing3d); every active game fully described.
//   2. Wiring: every ACTIVE game has a solo play component, a Live
//      Classroom component when live-supported, and an icon.
//   3. One source of truth: no GameRoom file outside the registry and
//      lib/gameRoomV2/gameAvailability.ts reads GAME_ENGINES_V2, runs its
//      own compatibility check or compares engine statuses; every
//      important surface imports the shared availability helpers.
//   4. Behaviour: teacher MCQ set, the real production short-answer set,
//      matching set, sorting set, imported vs. manual, built-in vs.
//      manual, Coming Soon never launchable, Host Live coverage, and
//      picker == server launch guard for every combination.
//
//   npx tsx scripts/verify-gameroom-v2-game-registry.ts

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { GAME_ENGINES_V2 } from '../lib/gameRoomV2/registry'
import {
  checkGameLaunch,
  comingSoonEngines,
  gamePickerForSet,
  launchableEngines,
  listedEngines,
  playableEnginesForSet,
  type GameMode,
} from '../lib/gameRoomV2/gameAvailability'
import type { GameRoomQuestionType } from '../lib/gameRoomV2/domain'
import { BUILTIN_TOPICS, enginesForTopic, setForEngine, unavailableEnginesForTopic } from '../lib/gameRoomV2/builtin/catalog'
import { buildQuestion, checkRows, parseImport } from '../lib/gameRoomV2/import/questionImport'

let failures = 0
function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`)
    failures++
  } else {
    console.log(`  ok: ${message}`)
  }
}
const read = (p: string) => readFileSync(p, 'utf8')
const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i])

const EXPECTED_ACTIVE = ['classic-quiz', 'tower-defense', 'racing', 'boss-battle', 'word-ninja', 'matching', 'memory', 'balloon-pop', 'letter-train', 'parachute-catch', 'fishing-pond', 'missing-letter', 'letter-parade', 'frog-jump', 'busy-bee', 'dinosaur-egg', 'ice-cream-shop', 'treasure-hunt', 'build-a-house', 'sort-baskets', 'listen-choose']
const EXPECTED_COMING_SOON = ['treasure-quest', 'space-mission', 'kingdom-builder', 'mystery-mansion']
const CHECKPOINT_GAMES = ['classic-quiz', 'tower-defense', 'racing', 'boss-battle']
const MATCH_GAMES = ['matching', 'memory']
// Little Learners games play choice questions only (no typed answers)
const CHOICE_ONLY_GAMES = ['balloon-pop', 'letter-train', 'parachute-catch', 'fishing-pond', 'missing-letter', 'frog-jump', 'busy-bee', 'dinosaur-egg', 'ice-cream-shop', 'treasure-hunt', 'build-a-house', 'listen-choose']

const activeIds = launchableEngines().map((e) => e.id)

console.log('== 1. Registry ==')
assert(new Set(GAME_ENGINES_V2.map((e) => e.id)).size === GAME_ENGINES_V2.length, 'engine ids are unique')
assert(same(activeIds, EXPECTED_ACTIVE), `ACTIVE games, in display order: ${activeIds.join(', ')}`)
assert(same(comingSoonEngines().map((e) => e.id), EXPECTED_COMING_SOON), 'Coming Soon: Treasure Quest, Space Mission, Kingdom Builder, Mystery Mansion')
assert(!listedEngines().some((e) => e.id === 'crossword'), 'Crossword (never built) is HIDDEN from every surface')
// Whole word: "Parachute" contains "rac" too
assert(GAME_ENGINES_V2.filter((e) => /racing/i.test(e.id) || /\bracing\b/i.test(e.name)).length === 1, 'exactly ONE Racing entry in the registry')
for (const e of launchableEngines()) {
  assert(Boolean(e.name && e.tamilName && e.description), `${e.id}: English name, Tamil name and description present`)
  assert((e.estimatedDurationMinutes ?? 0) > 0, `${e.id}: positive duration`)
  assert(e.compatibility.soloSupport, `${e.id}: solo play supported`)
  assert(Boolean(e.requirement?.en && e.requirement?.ta), `${e.id}: has a requirement text for the disabled-card reason`)
  assert(
    (e.recommendedQuestionTypes ?? []).every((t) => e.compatibility.supportedQuestionTypes.includes(t)),
    `${e.id}: recommended types are a subset of supported types`
  )
}

console.log('\n== 2. Every ACTIVE game is wired to a real component ==')
const playSrc = read('app/gameroom-v2/play/[sessionId]/PlaySessionClient.tsx')
const liveSrc = read('app/gameroom-v2/live/play/[id]/LivePlayClient.tsx')
const iconSrc = read('components/gameRoomV2/shell/ui.tsx')
const mapKeys = (src: string, name: string) => {
  const start = src.indexOf(`const ${name}`)
  const body = src.slice(start, src.indexOf('\n}\n', start))
  return Array.from(body.matchAll(/^\s{2}'?([a-z0-9-]+)'?:/gm)).map((m) => m[1])
}
const soloKeys = mapKeys(playSrc, 'ENGINE_COMPONENTS')
const liveKeys = mapKeys(liveSrc, 'LIVE_ENGINES')
const iconKeys = mapKeys(iconSrc, 'ENGINE_ICONS')
// Classic Quiz is the GameSessionRuntime fallback in both clients; the
// live client branches on 'racing' explicitly (shared track props).
const soloHas = (id: string) => soloKeys.includes(id) || (id === 'classic-quiz' && playSrc.includes('GameSessionRuntime'))
const liveHas = (id: string) =>
  liveKeys.includes(id) || (id === 'classic-quiz' && liveSrc.includes('GameSessionRuntime')) || (id === 'racing' && liveSrc.includes("state.engineId === 'racing'"))
for (const e of launchableEngines()) {
  assert(soloHas(e.id), `${e.id}: solo play component registered`)
  if (e.compatibility.liveClassroomSupport) assert(liveHas(e.id), `${e.id}: Live Classroom component registered`)
  assert(iconKeys.includes(e.id), `${e.id}: icon registered`)
}
const racingSrc = read('components/gameRoomV2/racing/RacingGame.tsx')
assert(racingSrc.includes('racing3d/RaceGame3D') && racingSrc.includes('racing3d/LiveRace3D'), "Racing ('racing') renders the racing3d implementation, solo and live")
assert(!/DriveGame|DriveCanvas/.test(racingSrc + playSrc + liveSrc), 'the old top-down racer is not reachable from any launch path')

console.log('\n== 3. One source of truth ==')
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    // Forward slashes on every OS so paths match OWNERS (join uses '\' on Windows)
    const p = join(dir, f).replace(/\\/g, '/')
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : []
  })
}
const OWNERS = new Set(['lib/gameRoomV2/registry.ts', 'lib/gameRoomV2/gameAvailability.ts', 'lib/gameRoomV2/domain/compatibility.ts'])
const gameRoomFiles = [...walk('app/gameroom-v2'), ...walk('app/api/gameroom-v2'), ...walk('components/gameRoomV2'), ...walk('lib/gameRoomV2')]
for (const file of gameRoomFiles) {
  if (OWNERS.has(file)) continue
  const src = read(file)
  if (/\bGAME_ENGINES_V2\b/.test(src)) assert(false, `${file} reads GAME_ENGINES_V2 directly -- use lib/gameRoomV2/gameAvailability.ts`)
  if (/checkEngineCompatibility\(/.test(src)) assert(false, `${file} runs its own compatibility check -- use gameAvailability`)
  if (/\b(engine|e|g)\.status\s*[!=]==\s*'(ACTIVE|BETA|COMING_SOON|ALPHA|HIDDEN|DISABLED)'/.test(src))
    assert(false, `${file} compares an engine status itself -- use isEngineLaunchable/gamePickerForSet`)
}
assert(true, `scanned ${gameRoomFiles.length} GameRoom files for private game lists / status checks`)
const SURFACES: Record<string, string> = {
  'Choose a Game (My Question Sets / Builder)': 'components/gameRoomV2/builder/ChooseGameModal.tsx',
  'Builder "Playable Games"': 'components/gameRoomV2/builder/CompatibilityResults.tsx',
  'Question Set Library card': 'app/gameroom-v2/library/LibrarySetCard.tsx',
  'Builder list (My Question Sets)': 'app/gameroom-v2/builder/BuilderListClient.tsx',
  'Import wizard': 'components/gameRoomV2/builder/ImportWizard.tsx',
  'GameRoom home launcher': 'app/gameroom-v2/home/launcherData.ts',
  'Learning Boards / topics / Quick Play (built-in catalog)': 'lib/gameRoomV2/builtin/catalog.ts',
  'Topics page game filter': 'app/gameroom-v2/topics/page.tsx',
  'Host Live options': 'app/api/gameroom-v2/live/host-options/route.ts',
  'Host Live launch guard': 'app/api/gameroom-v2/live/host/route.ts',
  'Student solo launch guard': 'app/api/gameroom-v2/sessions/start/route.ts',
  'Student per-game set list': 'app/api/gameroom-v2/student/question-sets/route.ts',
}
for (const [label, file] of Object.entries(SURFACES)) {
  assert(/gameRoomV2\/gameAvailability'|'\.\.\/gameAvailability'/.test(read(file)), `${label} derives availability from gameAvailability`)
}

console.log('\n== 4. Behaviour ==')
function expectPicker(label: string, types: GameRoomQuestionType[], playable: string[]) {
  const p = gamePickerForSet(types)
  const shown = p.active.map((a) => a.engine.id)
  assert(same([...shown].sort(), [...EXPECTED_ACTIVE].sort()), `${label}: all 7 ACTIVE games are visible`)
  assert(same(p.playable.map((a) => a.engine.id).sort(), [...playable].sort()), `${label}: playable = ${playable.join(', ')}`)
  for (const a of p.active.filter((x) => !x.playable)) {
    assert(Boolean(a.reason?.en), `${label}: ${a.engine.id} disabled with reason "${a.reason?.en}"`)
  }
  assert(!shown.some((id) => EXPECTED_COMING_SOON.includes(id)), `${label}: no Coming Soon game in the playable grid`)
  assert(same(p.comingSoon.map((e) => e.id), EXPECTED_COMING_SOON), `${label}: Coming Soon listed separately`)
  const firstDisabled = p.active.findIndex((a) => !a.playable)
  assert(firstDisabled === -1 || p.active.slice(firstDisabled).every((a) => !a.playable), `${label}: playable games listed before disabled ones`)
}

console.log('-- Normal teacher-created MCQ set --')
expectPicker('MCQ set', ['MULTIPLE_CHOICE'], [...CHECKPOINT_GAMES, ...CHOICE_ONLY_GAMES])
const mcq = gamePickerForSet(['MULTIPLE_CHOICE'])
const reasonOf = (id: string) => mcq.active.find((a) => a.engine.id === id)?.reason?.en ?? ''
assert(/matching-pair/i.test(reasonOf('matching')) && /matching-pair/i.test(reasonOf('memory')), 'MCQ set: Matching/Memory say "Requires matching-pair questions"')
assert(/sorting|categor/i.test(reasonOf('word-ninja')), 'MCQ set: Word Ninja says it requires sorting (categorize) questions')

console.log('-- The real production set (imported, all short-answer TEXT_INPUT) --')
expectPicker('Short-answer set', ['TEXT_INPUT'], CHECKPOINT_GAMES)

console.log('-- Mixed quiz set --')
expectPicker('Mixed quiz set', ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'TEXT_INPUT', 'FILL_BLANK', 'ORDER_WORDS'], CHECKPOINT_GAMES)

console.log('-- Matching-compatible set --')
expectPicker('MATCH set', ['MATCH'], MATCH_GAMES)

console.log('-- Sorting set --')
expectPicker('CATEGORIZE set', ['CATEGORIZE'], ['tower-defense', 'word-ninja', 'sort-baskets', 'balloon-pop'])

console.log('-- Empty set --')
assert(gamePickerForSet([]).playable.length === 0 && gamePickerForSet([]).active.length === EXPECTED_ACTIVE.length, `empty set: nothing playable, all ${EXPECTED_ACTIVE.length} still visible`)

console.log('-- Imported set == manually created equivalent --')
function importedTypes(csv: string, style: 'choices' | 'typed'): GameRoomQuestionType[] {
  const res = parseImport('csv', csv)
  const ok = checkRows(res.rows).every((c) => c.errors.length === 0)
  assert(ok && res.rows.length > 0, `import (${style}): rows parse cleanly`)
  return Array.from(new Set(res.rows.map((r) => buildQuestion(r, res.rows, style).questionType)))
}
const CSV = [
  'question,answer,wrong_answer_1,wrong_answer_2,wrong_answer_3',
  '"வீடு" எந்தச் சொல்வகை?,பெயர்ச்சொல்,வினைச்சொல்,இடைச்சொல்,உரிச்சொல்',
  '"ஓடு" எந்தச் சொல்வகை?,வினைச்சொல்,பெயர்ச்சொல்,இடைச்சொல்,உரிச்சொல்',
  '"அம்மா" எந்தச் சொல்வகை?,பெயர்ச்சொல்,வினைச்சொல்,இடைச்சொல்,உரிச்சொல்',
].join('\n')
const ids = (types: GameRoomQuestionType[]) => playableEnginesForSet(types).map((e) => e.id)
const importedMc = importedTypes(CSV, 'choices')
assert(same(importedMc, ['MULTIPLE_CHOICE']), 'imported choice-style set is MULTIPLE_CHOICE')
assert(same(ids(importedMc), ids(['MULTIPLE_CHOICE'])), 'imported MCQ set has exactly the same games as a manual MCQ set')
const importedTyped = importedTypes(CSV, 'typed')
// Rows that carry wrong answers become multiple choice even in the typed
// style (questionImport.buildQuestion), so this CSV imports as MCQ either way.
// (This used to compare against TEXT_INPUT and only passed while every
// MCQ game also played short answers.)
assert(same(importedTyped, ['MULTIPLE_CHOICE']), 'imported typed set with wrong answers is still MULTIPLE_CHOICE')
assert(same(ids(importedTyped), ids(['MULTIPLE_CHOICE'])), 'imported typed set has exactly the same games as a manual MCQ set')
assert(['tower-defense', 'racing'].every((id) => ids(importedTyped).includes(id)), 'imported typed set: Tower Defense and Racing are playable')

console.log('-- Built-in sets use the same rule --')
for (const topic of BUILTIN_TOPICS) {
  for (const set of topic.sets) {
    const viaTopic = launchableEngines().filter((e) => set.questionTypes.every((t) => e.compatibility.supportedQuestionTypes.includes(t))).map((e) => e.id)
    if (!same(viaTopic, ids(set.questionTypes))) assert(false, `built-in ${set.id}: games differ from a manual set with the same types`)
  }
  const offered = enginesForTopic(topic).map((x) => x.engine.id)
  const missing = unavailableEnginesForTopic(topic).map((e) => e.id)
  if (!same([...offered, ...missing].sort(), [...EXPECTED_ACTIVE].sort())) assert(false, `topic ${topic.key}: every ACTIVE game is either offered or shown disabled`)
}
assert(true, `${BUILTIN_TOPICS.length} built-in topics: same availability as manual sets; every active game offered or disabled-with-reason`)
const quizTopic = BUILTIN_TOPICS.find((t) => t.sets.some((s) => same(s.questionTypes, ['MULTIPLE_CHOICE'])))
assert(Boolean(quizTopic) && CHECKPOINT_GAMES.every((id) => Boolean(setForEngine(quizTopic!, id))), 'built-in MCQ topic: Classic, Tower Defense, Racing, Boss Battle all playable')
for (const id of EXPECTED_ACTIVE) {
  assert(BUILTIN_TOPICS.some((t) => setForEngine(t, id)), `${id}: playable on at least one built-in topic (student home Games tile is never empty)`)
}

console.log('-- Coming Soon can never launch --')
for (const e of comingSoonEngines()) {
  for (const mode of ['solo', 'live'] as GameMode[]) {
    const r = checkGameLaunch(e.id, e.compatibility.supportedQuestionTypes, mode)
    assert(!r.ok && r.status === 409, `${e.id} (${mode}): launch refused even with a compatible set`)
  }
}
assert(!checkGameLaunch('crossword', ['FILL_BLANK'], 'solo').ok, 'hidden Crossword: launch refused')
assert(!checkGameLaunch('racing-old', ['MULTIPLE_CHOICE'], 'solo').ok, 'unknown engine id: launch refused')

console.log('-- Host Live --')
for (const types of [['MULTIPLE_CHOICE'], ['TEXT_INPUT'], ['MATCH'], ['CATEGORIZE']] as GameRoomQuestionType[][]) {
  const expected = launchableEngines().filter((e) => e.compatibility.liveClassroomSupport && playableEnginesForSet(types).some((p) => p.id === e.id)).map((e) => e.id)
  const hostLive = playableEnginesForSet(types, 'live').map((e) => e.id)
  assert(same(hostLive, expected), `${types.join('+')}: Host Live offers every ACTIVE live-supported compatible game (${hostLive.join(', ')})`)
  assert(hostLive.every((id) => checkGameLaunch(id, types, 'live').ok), `${types.join('+')}: each of those can actually be hosted`)
}

console.log('-- Picker == server launch guard, every combination --')
const TYPE_SETS: GameRoomQuestionType[][] = [[], ['MULTIPLE_CHOICE'], ['TEXT_INPUT'], ['MATCH'], ['CATEGORIZE'], ['ORDER_LETTERS'], ['MULTIPLE_CHOICE', 'MATCH'], ['PRONUNCIATION']]
let mismatches = 0
for (const types of TYPE_SETS) {
  for (const mode of ['solo', 'live'] as GameMode[]) {
    const shownPlayable = new Set(playableEnginesForSet(types, mode).map((e) => e.id))
    for (const e of GAME_ENGINES_V2) if (checkGameLaunch(e.id, types, mode).ok !== shownPlayable.has(e.id)) mismatches++
  }
}
assert(mismatches === 0, 'a game can be launched if and only if the picker shows it as playable')

console.log(failures === 0 ? '\nAll game-registry checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
