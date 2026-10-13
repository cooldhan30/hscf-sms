// Proves GameRoom Classic is isolated (no test framework in this repo --
// same "tsx script as the test" convention as scripts/verify-gameroom-v2-*.ts):
//
// 1. ONLY GR CLASSIC FILES CHANGED -- every file that differs from the
//    branch point with master (committed, staged, unstaged or untracked)
//    lives inside the GameRoom Classic module. So the legacy GameRoom,
//    GameRoom V2 and the rest of the portal are byte-for-byte unchanged.
// 2. NO CROSS-IMPORTS -- GameRoom Classic imports nothing from either
//    existing GameRoom, and nothing outside the module imports it.
//
// Run with: npx tsx scripts/verify-grc-isolation.ts [baseRef=master]
import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..')
const BASE = process.argv[2] ?? 'master'
const GRC_PATHS = ['app/gr-classic/', 'app/api/gr-classic/', 'components/grClassic/', 'lib/grClassic/', 'scripts/verify-grc-', 'scripts/grc-harness/', 'supabase/migrations/', 'supabase/tests/grc_']
const EXISTING_GAMEROOM = ['lib/gameRoom/', 'lib/gameRoomV2/', 'lib/gameRoomMode', 'components/gameRoom/', 'components/gameRoomV2/', 'components/gameRoomMode/', 'app/gameroom/', 'app/gameroom-v2/', 'app/api/game-room/', 'app/api/gameroom-v2/', 'app/student/game-room/', 'app/teacher/game-room/']
let failures = 0
const sh = (cmd: string) => execSync(cmd, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean)

console.log(`== 1. Changed files vs. ${BASE} stay inside GameRoom Classic ==`)
const base = sh(`git merge-base ${BASE} HEAD`).trim()
const changed = new Set([...lines(sh(`git diff --name-only ${base}`)), ...lines(sh('git ls-files --others --exclude-standard'))])
changed.delete('.wakatime-project') // editor plugin file, not part of the app
for (const file of Array.from(changed).sort()) {
  const inside = GRC_PATHS.some((p) => file.startsWith(p))
  // A migration is allowed only if it's a new sms_grc_* file.
  const okMigration = !file.startsWith('supabase/migrations/') || /_grc_/.test(file)
  if (!inside || !okMigration) {
    console.error(`  FAIL: ${file} changed outside the GameRoom Classic module`)
    failures++
  }
}
for (const file of lines(sh(`git diff --name-only --diff-filter=DMR ${base} -- supabase/migrations`))) {
  console.error(`  FAIL: existing migration ${file} was modified or deleted`)
  failures++
}
console.log(`  ${changed.size} changed file(s) checked.`)

console.log('\n== 2. No imports between GameRoom Classic and the existing GameRooms ==')
const tracked = lines(sh('git ls-files --cached --others --exclude-standard -- "*.ts" "*.tsx"'))
let imports = 0
for (const file of tracked) {
  if (!existsSync(join(ROOT, file))) continue
  const importLines = readFileSync(join(ROOT, file), 'utf8')
    .split('\n')
    .filter((l) => /^\s*import\b/.test(l) || /from\s+['"]/.test(l))
  const isGrc = GRC_PATHS.some((p) => file.startsWith(p))
  for (const l of importLines) {
    const bad = isGrc ? EXISTING_GAMEROOM.some((p) => l.includes(`@/${p}`) || l.includes(`@/${p.replace(/\/$/, '')}'`)) : /@\/(lib|components|app)\/(grClassic|gr-classic)/.test(l)
    if (bad) {
      console.error(`  FAIL: ${file}: ${l.trim()}`)
      failures++
      imports++
    }
  }
}
console.log(`  ${tracked.length} files scanned, ${imports} disallowed import(s).`)

console.log(failures ? `\n${failures} FAILURE(S)` : '\nPASS: GameRoom Classic is isolated.')
process.exit(failures ? 1 : 0)
