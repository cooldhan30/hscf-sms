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
