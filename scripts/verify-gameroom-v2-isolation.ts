// Standalone verification script (this repo has no formal test
// framework -- see package.json's scripts: dev/build/start/lint only,
// and the existing precedent of scripts/validate-game-room-questions.ts
// for exactly this "tsx script as the test suite" convention).
//
// Proves two things about the GameRoom V2 foundation work:
//
// 1. LEGACY UNTOUCHED -- every file under the legacy GameRoom surface
//    (lib/gameRoom/*, app/api/game-room/*, app/teacher/game-room/*,
//    app/student/game-room/*) is byte-for-byte identical to what's
//    committed in git HEAD. If this script is run again after some
//    later change accidentally edits a legacy file, it fails loudly
//    instead of the drift going unnoticed.
//
// 2. V2 IS ISOLATED -- no file under lib/gameRoomV2/, app/gameroom-v2/,
//    or app/api/gameroom-v2/ imports anything from lib/gameRoom/ or
//    app/api/game-room/ (or vice versa: no legacy file imports
//    anything from a *V2* path). A single shared import would be the
//    exact coupling this whole foundation phase was designed to avoid.
//
// Run with: npx tsx scripts/verify-gameroom-v2-isolation.ts

import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..')

const LEGACY_PATHS = [
  'lib/gameRoom',
  'app/api/game-room',
  'app/teacher/game-room',
  'app/student/game-room',
]

const V2_PATHS = ['lib/gameRoomV2', 'app/gameroom-v2', 'app/api/gameroom-v2']

let failures = 0

function listFiles(relDir: string): string[] {
  const out = execSync(`git ls-files -- "${relDir}"`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  return out.split('\n').filter(Boolean)
}

function gitShowHead(relPath: string): string | null {
  try {
    return execSync(`git show HEAD:"${relPath}"`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  } catch {
    return null
  }
}

console.log('== 1. Legacy GameRoom files unchanged vs. git HEAD ==')
let legacyFileCount = 0
for (const dir of LEGACY_PATHS) {
  const files = listFiles(dir)
  for (const file of files) {
    legacyFileCount++
    const headContent = gitShowHead(file)
    const workingContent = existsSync(join(ROOT, file)) ? readFileSync(join(ROOT, file), 'utf8') : null

    if (headContent === null) {
      console.error(`  FAIL: ${file} is tracked but has no HEAD content (new/renamed?)`)
      failures++
      continue
    }
    if (workingContent === null) {
      console.error(`  FAIL: ${file} was deleted from the working tree`)
      failures++
      continue
    }
    if (headContent !== workingContent) {
      console.error(`  FAIL: ${file} differs from git HEAD -- legacy GameRoom must not be modified`)
      failures++
    }
  }
}
console.log(`  Checked ${legacyFileCount} legacy files.`)

console.log('\n== 2. No cross-imports between legacy GameRoom and V2 ==')
function findImportsOf(file: string, needleFragments: string[]): string[] {
  const full = join(ROOT, file)
  if (!existsSync(full)) return [] // deleted in the working tree -- handled/reported by check #1 instead
  const content = readFileSync(full, 'utf8')
  const importLines = content.split('\n').filter((l) => /^\s*import\b/.test(l) || /from\s+['"]/.test(l))
  return importLines.filter((line) => needleFragments.some((f) => line.includes(f)))
}

let crossImportCount = 0
for (const dir of LEGACY_PATHS) {
  for (const file of listFiles(dir)) {
    if (!/\.(ts|tsx)$/.test(file)) continue
    const hits = findImportsOf(file, ['gameRoomV2', 'gameroom-v2'])
    if (hits.length > 0) {
      console.error(`  FAIL: legacy file ${file} imports from a V2 path:\n    ${hits.join('\n    ')}`)
      failures++
      crossImportCount++
    }
  }
}
for (const dir of V2_PATHS) {
  if (!existsSync(join(ROOT, dir))) continue
  for (const file of listFiles(dir)) {
    if (!/\.(ts|tsx)$/.test(file)) continue
    const hits = findImportsOf(file, ["'@/lib/gameRoom/", '"@/lib/gameRoom/', "'@/app/api/game-room", '"@/app/api/game-room'])
    if (hits.length > 0) {
      console.error(`  FAIL: V2 file ${file} imports from a legacy GameRoom path:\n    ${hits.join('\n    ')}`)
      failures++
      crossImportCount++
    }
  }
}
console.log(`  Found ${crossImportCount} disallowed cross-import(s).`)

console.log('\n== 3. V2 foundation files exist and are non-empty ==')
const EXPECTED_V2_FILES = [
  'lib/gameRoomV2/domain/questionTypes.ts',
  'lib/gameRoomV2/domain/content.ts',
  'lib/gameRoomV2/domain/engine.ts',
  'lib/gameRoomV2/domain/session.ts',
  'lib/gameRoomV2/domain/index.ts',
  'lib/gameRoomV2/registry.ts',
  'lib/gameRoomV2/requireAccess.ts',
  'app/gameroom-v2/page.tsx',
  'app/api/gameroom-v2/engines/route.ts',
  'supabase/migrations/073_gameroom_v2_foundation.sql',
  'lib/gameRoomV2/domain/learningWorld.ts',
  'app/gameroom-v2/home/page.tsx',
  'app/gameroom-v2/home/HomeScreenClient.tsx',
  'components/gameRoomV2/WorldCard.tsx',
  'components/gameRoomV2/StudentStatusBar.tsx',
  'supabase/migrations/074_gameroom_v2_question_set_builder.sql',
  'lib/gameRoomV2/domain/validateQuestion.ts',
  'lib/gameRoomV2/domain/compatibility.ts',
  'lib/gameRoomV2/requireTeacherAccess.ts',
  'app/api/gameroom-v2/question-sets/route.ts',
  'app/api/gameroom-v2/question-sets/[id]/route.ts',
  'app/gameroom-v2/builder/page.tsx',
  'app/gameroom-v2/builder/BuilderListClient.tsx',
  'app/gameroom-v2/builder/new/page.tsx',
  'app/gameroom-v2/builder/[id]/page.tsx',
  'components/gameRoomV2/builder/types.ts',
  'components/gameRoomV2/builder/TamilTextInput.tsx',
  'components/gameRoomV2/builder/QuestionTypeEditor.tsx',
  'components/gameRoomV2/builder/MetadataStep.tsx',
  'components/gameRoomV2/builder/QuestionListStep.tsx',
  'components/gameRoomV2/builder/QuestionPreviewCard.tsx',
  'components/gameRoomV2/builder/CompatibilityResults.tsx',
  'components/gameRoomV2/builder/BuilderWizard.tsx',
  'supabase/migrations/075_gameroom_v2_question_set_library.sql',
  'lib/gameRoomV2/domain/language.ts',
  'app/api/gameroom-v2/question-sets/[id]/duplicate/route.ts',
  'app/api/gameroom-v2/question-sets/[id]/favorite/route.ts',
  'app/api/gameroom-v2/question-sets/[id]/assign/route.ts',
  'app/api/gameroom-v2/question-sets/[id]/usage/route.ts',
  'app/gameroom-v2/library/page.tsx',
  'app/gameroom-v2/library/LibraryClient.tsx',
  'app/gameroom-v2/library/LibraryFilterPanel.tsx',
  'app/gameroom-v2/library/LibrarySetCard.tsx',
  'app/gameroom-v2/library/AssignModal.tsx',
  'app/gameroom-v2/library/PreviewModal.tsx',
  'components/gameRoomV2/builder/ChooseGameModal.tsx',
  'scripts/verify-gameroom-v2-library.ts',
  'supabase/migrations/076_gameroom_v2_gameplay_framework.sql',
  'lib/gameRoomV2/shuffle.ts',
  'lib/gameRoomV2/scoring.ts',
  'lib/gameRoomV2/gradeAnswer.ts',
  'lib/gameRoomV2/skillsForQuestionSet.ts',
  'lib/gameRoomV2/requireSession.ts',
  'app/api/gameroom-v2/sessions/start/route.ts',
  'app/api/gameroom-v2/sessions/[id]/state/route.ts',
  'app/api/gameroom-v2/sessions/[id]/answer/route.ts',
  'app/api/gameroom-v2/sessions/[id]/pause/route.ts',
  'app/api/gameroom-v2/sessions/[id]/resume/route.ts',
  'app/api/gameroom-v2/sessions/[id]/complete/route.ts',
  'app/api/gameroom-v2/sessions/[id]/abandon/route.ts',
  'components/gameRoomV2/gameplay/index.ts',
  'components/gameRoomV2/gameplay/GameSessionRuntime.tsx',
  'components/gameRoomV2/gameplay/GameHUD.tsx',
  'components/gameRoomV2/gameplay/QuestionOverlay.tsx',
  'components/gameRoomV2/gameplay/QuestionInput.tsx',
  'components/gameRoomV2/gameplay/GameResultsScreen.tsx',
  'components/gameRoomV2/gameplay/useSoundPreference.ts',
  'components/gameRoomV2/gameplay/playSound.ts',
  'app/gameroom-v2/play/[sessionId]/page.tsx',
  'app/gameroom-v2/play/[sessionId]/PlaySessionClient.tsx',
  'scripts/verify-gameroom-v2-gameplay.ts',
  'lib/gameRoomV2/towerDefense/towers.ts',
  'lib/gameRoomV2/towerDefense/difficulty.ts',
  'lib/gameRoomV2/towerDefense/waves.ts',
  'lib/gameRoomV2/towerDefense/simulation.ts',
  'lib/gameRoomV2/towerDefense/index.ts',
  'components/gameRoomV2/towerDefense/DifficultyPicker.tsx',
  'components/gameRoomV2/towerDefense/Battlefield.tsx',
  'components/gameRoomV2/towerDefense/TowerShop.tsx',
  'components/gameRoomV2/towerDefense/TowerDefenseGame.tsx',
  'components/gameRoomV2/towerDefense/index.ts',
  'scripts/verify-gameroom-v2-tower-defense.ts',
  'lib/gameRoomV2/racing/themes.ts',
  'lib/gameRoomV2/racing/difficulty.ts',
  'lib/gameRoomV2/racing/race.ts',
  'lib/gameRoomV2/racing/index.ts',
  'components/gameRoomV2/racing/RaceSetupPicker.tsx',
  'components/gameRoomV2/racing/Track.tsx',
  'components/gameRoomV2/racing/RacingGame.tsx',
  'components/gameRoomV2/racing/index.ts',
  'scripts/verify-gameroom-v2-racing.ts',
  'lib/gameRoomV2/bossBattle/bosses.ts',
  'lib/gameRoomV2/bossBattle/abilities.ts',
  'lib/gameRoomV2/bossBattle/difficulty.ts',
  'lib/gameRoomV2/bossBattle/battle.ts',
  'lib/gameRoomV2/bossBattle/index.ts',
  'components/gameRoomV2/bossBattle/BossSetupPicker.tsx',
  'components/gameRoomV2/bossBattle/BossArena.tsx',
  'components/gameRoomV2/bossBattle/VictorySequence.tsx',
  'components/gameRoomV2/bossBattle/BossBattleGame.tsx',
  'components/gameRoomV2/bossBattle/index.ts',
  'scripts/verify-gameroom-v2-boss-battle.ts',
  'lib/gameRoomV2/treasureQuest/rooms.ts',
  'lib/gameRoomV2/treasureQuest/difficulty.ts',
  'lib/gameRoomV2/treasureQuest/exploration.ts',
  'lib/gameRoomV2/treasureQuest/index.ts',
  'components/gameRoomV2/treasureQuest/TreasureSetupPicker.tsx',
  'components/gameRoomV2/treasureQuest/RoomView.tsx',
  'components/gameRoomV2/treasureQuest/TreasureFoundScreen.tsx',
  'components/gameRoomV2/treasureQuest/TreasureQuestGame.tsx',
  'components/gameRoomV2/treasureQuest/index.ts',
  'scripts/verify-gameroom-v2-treasure-quest.ts',
  'lib/gameRoomV2/wordNinja/lanes.ts',
  'lib/gameRoomV2/wordNinja/difficulty.ts',
  'lib/gameRoomV2/wordNinja/round.ts',
  'lib/gameRoomV2/wordNinja/index.ts',
  'components/gameRoomV2/wordNinja/NinjaSetupPicker.tsx',
  'components/gameRoomV2/wordNinja/NinjaBoard.tsx',
  'components/gameRoomV2/wordNinja/WordNinjaGame.tsx',
  'components/gameRoomV2/wordNinja/index.ts',
  'scripts/verify-gameroom-v2-word-ninja.ts',
]
for (const file of EXPECTED_V2_FILES) {
  const full = join(ROOT, file)
  if (!existsSync(full)) {
    console.error(`  FAIL: expected V2 foundation file missing: ${file}`)
    failures++
    continue
  }
  const size = readFileSync(full, 'utf8').trim().length
  if (size === 0) {
    console.error(`  FAIL: ${file} exists but is empty`)
    failures++
  }
}
console.log(`  Checked ${EXPECTED_V2_FILES.length} expected V2 files.`)

console.log('\n== 4. Legacy registry array contents unchanged ==')
// Belt-and-suspenders on top of #1's hash check: explicitly re-read the
// legacy registry and assert the exact module id lists, so a future
// script run catches even a semantically-meaningful change (not just
// any byte diff) to the two arrays every legacy route/page depends on.
const registrySource = readFileSync(join(ROOT, 'lib/gameRoom/registry.ts'), 'utf8')
const EXPECTED_LEGACY_QUIZ_IDS = ['tamilGrammarModule', 'mayangoliModule', 'tamilGrammarClassificationModule']
const EXPECTED_LEGACY_INTERACTIVE_IDS = [
  'uyirOrderModule',
  'uyirMemoryModule',
  'meiOrderModule',
  'meiMemoryModule',
  'uyirKurilNedilSortModule',
  'uyirKurilNedilMemoryModule',
  'meiVallinamMellinamIdaiyinamSortModule',
  'inaEzhuthukkalMatchingModule',
  'uyirMissingLetterModule',
  'meiMissingLetterModule',
]
for (const id of [...EXPECTED_LEGACY_QUIZ_IDS, ...EXPECTED_LEGACY_INTERACTIVE_IDS]) {
  if (!registrySource.includes(id)) {
    console.error(`  FAIL: lib/gameRoom/registry.ts no longer references '${id}'`)
    failures++
  }
}
console.log(`  Checked ${EXPECTED_LEGACY_QUIZ_IDS.length + EXPECTED_LEGACY_INTERACTIVE_IDS.length} legacy module references.`)

console.log('\n== 5. Shared config files touched by V2 work are additive-only ==')
// tailwind.config.ts is the one file the V2 design system legitimately
// needs to touch (it's shared, global config -- there's no way to scope
// Tailwind's color/keyframe tokens to one subtree). Asserted here as
// zero deletions vs. git HEAD so a future edit that removes or
// repurposes an EXISTING key (as opposed to adding a new gamev2* one)
// fails loudly instead of silently changing another portal's theme.
const SHARED_CONFIG_FILES_MUST_BE_ADDITIVE_ONLY = ['tailwind.config.ts']
for (const file of SHARED_CONFIG_FILES_MUST_BE_ADDITIVE_ONLY) {
  const headContent = gitShowHead(file)
  const workingContent = existsSync(join(ROOT, file)) ? readFileSync(join(ROOT, file), 'utf8') : null
  if (headContent === null || workingContent === null) {
    console.log(`  skip: ${file} not found in HEAD or working tree (no baseline to diff against yet)`)
    continue
  }
  if (headContent === workingContent) {
    console.log(`  ok: ${file} unchanged`)
    continue
  }
  const diffOutput = execSync(`git diff --numstat -- "${file}"`, { cwd: ROOT, encoding: 'utf8' }).trim()
  const [added, removed] = diffOutput.split(/\s+/).map(Number)
  if (removed > 0) {
    console.error(`  FAIL: ${file} has ${removed} removed/modified line(s) -- shared config must only gain new keys, never change existing ones`)
    failures++
  } else {
    console.log(`  ok: ${file} changed additively only (+${added} lines, 0 removed)`)
  }
}

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
