// Standalone verification script for the GameRoom V2 performance audit
// (docs/gameroom-v2-completion-plan.md, Phase 15). Same tsx-script
// convention as every other verify-gameroom-v2-*.ts script.
//
// Sections 1-2 test the pure helpers directly (the Realtime refresh
// coalescer on a fake clock, and batched usage-count mapping). Sections
// 3-6 are static regression guards over component source: engines stay
// code-split, simulation/poll effects never depend on per-tick state
// objects (which re-created their intervals every tick / turned polling
// into back-to-back requests), Live Classroom coalesces Realtime-driven
// refetches, and every timer/listener has matching cleanup.
//
// Run with: npx tsx scripts/verify-gameroom-v2-performance.ts

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { createCoalescer, type CoalescerTimers } from '../lib/gameRoomV2/gameplay/coalesce'
import { usageCountMapFromRows } from '../lib/gameRoomV2/questionSetUsageRows'

const ROOT = join(__dirname, '..')
let failures = 0

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`)
    failures++
  } else {
    console.log(`  ok: ${message}`)
  }
}

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8')
}

// ---------------------------------------------------------------------
console.log('== 1. Realtime refresh coalescer (fake clock) ==')
function fakeClock() {
  let now = 0
  let nextId = 1
  const pending = new Map<number, { at: number; fn: () => void }>()
  const timers: CoalescerTimers = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = nextId++
      pending.set(id, { at: now + ms, fn })
      return id
    },
    clearTimeout: (id) => {
      pending.delete(id as number)
    },
  }
  function advance(ms: number) {
    const target = now + ms
    for (;;) {
      const due = Array.from(pending.entries())
        .filter(([, t]) => t.at <= target)
        .sort((a, b) => a[1].at - b[1].at)[0]
      if (!due) break
      pending.delete(due[0])
      now = due[1].at
      due[1].fn()
    }
    now = target
  }
  return { timers, advance, pendingCount: () => pending.size }
}

{
  const clock = fakeClock()
  let runs = 0
  const c = createCoalescer(() => runs++, 1000, clock.timers)
  c.call()
  assert(runs === 1, 'the first event refreshes immediately (no added latency when idle)')
  for (let i = 0; i < 30; i++) c.call()
  assert(runs === 1, '30 more events inside the window do not refetch 30 times')
  assert(clock.pendingCount() === 1, 'exactly one trailing refresh is scheduled for the whole burst')
  clock.advance(1000)
  assert(runs === 2, 'the trailing refresh fires at the end of the window (the last event is never lost)')
  clock.advance(5000)
  assert(runs === 2, 'no further refreshes without further events')
  c.call()
  assert(runs === 3, 'after a quiet period the next event refreshes immediately again')
}

{
  // A class of 30 students heartbeating every 8s for 60s = 225 events.
  const clock = fakeClock()
  let runs = 0
  const c = createCoalescer(() => runs++, 1000, clock.timers)
  const students = 30
  const heartbeatMs = 8000
  let events = 0
  for (let t = 0; t < 60_000; t += 100) {
    for (let s = 0; s < students; s++) {
      // Stagger each student's heartbeat phase by 300ms.
      if (t % heartbeatMs === (s * 300) % heartbeatMs) {
        c.call()
        events++
      }
    }
    clock.advance(100)
  }
  clock.advance(2000)
  assert(events > 200, `simulated ${events} Realtime heartbeat events from ${students} students over 60s`)
  assert(runs <= 65, `those events cause at most ~one refetch per second per client (${runs} refetches, previously ${events})`)
}

{
  const clock = fakeClock()
  let runs = 0
  const c = createCoalescer(() => runs++, 1000, clock.timers)
  c.call()
  c.call()
  c.cancel()
  clock.advance(5000)
  assert(runs === 1, 'cancel() (on unmount) drops the pending trailing refresh')
}

// ---------------------------------------------------------------------
console.log('\n== 2. Batched question-set usage counts ==')
const counts = usageCountMapFromRows(['a', 'b', 'c'], [
  { question_set_id: 'a', usage_count: 4 },
  { question_set_id: 'c', usage_count: '2' },
  { question_set_id: 'zzz', usage_count: 99 },
])
assert(counts.get('a') === 4, 'a returned count is used')
assert(counts.get('b') === 0, 'a set with no usage row reads as 0, not undefined')
assert(counts.get('c') === 2, 'a numeric-string count is coerced')
assert(!counts.has('zzz'), 'rows for sets that were not requested are ignored')
assert(usageCountMapFromRows(['x'], null).get('x') === 0, 'a null RPC result yields zeros')
const usageHelper = read('lib/gameRoomV2/questionSetUsage.ts')
assert(/sms_gamev2_question_set_usage_counts/.test(usageHelper), 'the helper uses the single batched RPC')
assert(/sms_gamev2_question_set_usage_count'/.test(usageHelper), 'the helper falls back to the per-set RPC if migration 084 is not applied yet')
for (const f of ['app/gameroom-v2/library/page.tsx', 'app/api/gameroom-v2/question-sets/route.ts']) {
  const src = read(f)
  assert(
    /fetchQuestionSetUsageCounts\(/.test(src) && !/\.map\([^)]*=>[\s\S]{0,120}sms_gamev2_question_set_usage_count'/.test(src),
    `${f}: no per-set usage-count RPC loop (N+1) -- uses the batched helper`
  )
}

// ---------------------------------------------------------------------
console.log('\n== 3. Engines are code-split ==')
const ENGINE_DIRS = ['towerDefense', 'racing', 'bossBattle', 'treasureQuest', 'wordNinja', 'spaceMission', 'kingdomBuilder', 'mysteryMansion', 'matching', 'memory']
const staticEngineImport = new RegExp(`^import[^\\n]*from '@/components/gameRoomV2/(${ENGINE_DIRS.join('|')})(/[^']*)?'`, 'm')
for (const f of [
  'app/gameroom-v2/play/[sessionId]/PlaySessionClient.tsx',
  'app/gameroom-v2/live/play/[id]/LivePlayClient.tsx',
  'app/gameroom-v2/live/host/[id]/HostDashboardClient.tsx',
]) {
  const src = read(f)
  assert(!staticEngineImport.test(src), `${f}: no static import of any engine (each loads on demand)`)
  assert(/from 'next\/dynamic'/.test(src), `${f}: uses next/dynamic`)
}
const playClient = read('app/gameroom-v2/play/[sessionId]/PlaySessionClient.tsx')
assert(!/^import[^\n]*GameSessionRuntime[^\n]*from/m.test(playClient), 'PlaySessionClient: even the generic quiz runtime is loaded on demand')
for (const dir of ENGINE_DIRS) {
  const idx = join('components/gameRoomV2', dir, 'index.ts')
  if (!existsSync(join(ROOT, idx))) continue
  const exportedGame = /export \{ (\w+Game) \}/.exec(read(idx))?.[1]
  if (exportedGame) {
    assert(new RegExp(`m\\.${exportedGame}\\b`).test(playClient), `PlaySessionClient lazily maps ${dir} -> ${exportedGame}`)
  }
}
const sharedBarrel = read('components/gameRoomV2/index.ts')
assert(!new RegExp(`'\\./(${ENGINE_DIRS.join('|')})`).test(sharedBarrel), 'the shared components/gameRoomV2 barrel re-exports no engine (so every page importing it stays engine-free)')

// ---------------------------------------------------------------------
console.log('\n== 4. Simulation/poll effects never depend on per-tick state ==')
// Each [file, forbidden dependency-array fragment] pair was a real bug:
// the dependency is replaced every tick/poll, so the effect tore down
// and recreated its interval each time (and for the race poll, fired an
// immediate extra request each time).
const FORBIDDEN_DEPS: [string, RegExp, string][] = [
  ['components/gameRoomV2/towerDefense/TowerDefenseGame.tsx', /\}, \[battlefield, showQuestion/, 'Tower Defense sim clock keyed on the battlefield object'],
  ['components/gameRoomV2/racing/RacingGame.tsx', /\}, \[race, difficulty, showQuestion/, 'solo Racing sim clock keyed on the race object'],
  ['components/gameRoomV2/racing/RacingGame.tsx', /liveRace\?\.racers\]/, 'live race poll keyed on the racers array (back-to-back polling)'],
  ['components/gameRoomV2/bossBattle/BossBattleGame.tsx', /\}, \[battle, difficulty, showQuestion/, 'Boss Battle sim clock keyed on the battle object'],
  ['components/gameRoomV2/wordNinja/WordNinjaGame.tsx', /\}, \[round, difficulty, submitting/, 'Word Ninja flight clock keyed on the round object'],
  ['components/gameRoomV2/matching/MatchingGame.tsx', /\}, \[roundSecondsRemaining,/, 'Matching countdown keyed on the remaining seconds'],
]
for (const [file, re, label] of FORBIDDEN_DEPS) {
  assert(!re.test(read(file)), `${label}: fixed`)
}
for (const [file, flag] of [
  ['components/gameRoomV2/towerDefense/TowerDefenseGame.tsx', 'simRunning'],
  // Solo racing's loop lives in GrandPrixGame.tsx (RacingGame.tsx keeps the Live Classroom race).
  ['components/gameRoomV2/racing/GrandPrixGame.tsx', 'simRunning'],
  ['components/gameRoomV2/racing/RacingGame.tsx', 'raceFinished'],
  ['components/gameRoomV2/wordNinja/WordNinjaGame.tsx', 'flightRunning'],
  ['components/gameRoomV2/matching/MatchingGame.tsx', 'countdownRunning'],
]) {
  assert(new RegExp(`\\}, \\[[^\\]]*\\b${flag}\\b[^\\]]*\\]\\)`).test(read(file)), `${file}: the loop effect is keyed on the '${flag}' boolean`)
}

// ---------------------------------------------------------------------
// Solo Boss Battle is a turn-based duel (BossDuelGame.tsx): it runs no
// per-tick simulation loop at all -- nothing to key, nothing to leak.
{
  const duelSrc = read('components/gameRoomV2/bossBattle/BossDuelGame.tsx')
  assert(!/setInterval\(|requestAnimationFrame\(/.test(duelSrc), 'solo Boss Battle (turn-based) runs no tick loop')
}

console.log('\n== 5. Live Classroom Realtime load ==')
const livePlay = read('app/gameroom-v2/live/play/[id]/LivePlayClient.tsx')
const host = read('app/gameroom-v2/live/host/[id]/HostDashboardClient.tsx')
assert(/createCoalescer\(/.test(livePlay) && /coalescedRefresh\.call/.test(livePlay), 'student client coalesces Realtime-triggered refetches')
assert(/createCoalescer\(/.test(host) && /coalescedRefresh\.call/.test(host), 'host dashboard coalesces Realtime-triggered refetches')
assert(/coalescedRefresh\.cancel\(\)/.test(livePlay) && /coalescedRefresh\.cancel\(\)/.test(host), 'both cancel any pending trailing refetch on unmount')
assert(/includeParticipants: !inGameplay/.test(livePlay), 'a student already in gameplay stops receiving every classmate\'s heartbeat')
assert(/lastPayloadRef\.current/.test(livePlay) && /lastLobbyRef\.current/.test(host), 'identical refetch payloads skip setState (no re-render of the mounted game)')
assert(/if \(status === 'ENDED'\) \{\s*refreshResults\(\)\s*return/.test(host), 'host results polling stops once the session has ENDED')
const realtime = read('lib/gameRoomV2/liveClassroom/realtime.ts')
assert(/includeParticipants = true/.test(realtime), 'subscribeToLiveSession defaults to the old behavior (participants included) for other callers')

// ---------------------------------------------------------------------
console.log('\n== 6. Timer / listener / subscription cleanup ==')
function walk(dir: string): string[] {
  const full = join(ROOT, dir)
  if (!existsSync(full)) return []
  const out: string[] = []
  for (const entry of readdirSync(full, { withFileTypes: true })) {
    const rel = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(rel))
    else if (/\.tsx?$/.test(entry.name)) out.push(rel)
  }
  return out
}
const clientSources = [...walk('components/gameRoomV2'), ...walk('app/gameroom-v2')]
function count(src: string, re: RegExp): number {
  return (src.match(re) ?? []).length
}
let leaks = 0
for (const f of clientSources) {
  // Line comments stripped first -- several files mention setInterval in
  // prose (e.g. explaining why no tick loop is needed).
  const src = read(f)
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
  const intervals = count(src, /\bsetInterval\(/g)
  const clears = count(src, /\bclearInterval\(/g)
  if (intervals > clears) {
    console.error(`  FAIL: ${f} starts ${intervals} interval(s) but clears only ${clears}`)
    leaks++
  }
  const adds = count(src, /\baddEventListener\(/g)
  const removes = count(src, /\bremoveEventListener\(/g)
  if (adds > removes) {
    console.error(`  FAIL: ${f} adds ${adds} event listener(s) but removes only ${removes}`)
    leaks++
  }
  const channels = count(src, /subscribeToLiveSession\(supabase/g)
  const removed = count(src, /removeChannel\(/g)
  if (channels > removed) {
    console.error(`  FAIL: ${f} opens ${channels} Realtime channel(s) but removes only ${removed}`)
    leaks++
  }
}
failures += leaks
assert(leaks === 0, `every setInterval / addEventListener / Realtime channel in ${clientSources.length} V2 client files has matching cleanup`)
for (const f of ['components/gameRoomV2/towerDefense/TowerDefenseGame.tsx', 'components/gameRoomV2/bossBattle/BossBattleGame.tsx']) {
  assert(!/window\.setTimeout\(/.test(read(f)), `${f}: hit-flash/impact timers use useManagedTimeouts (cleared on exit), not bare window.setTimeout`)
}
const managed = read('components/gameRoomV2/gameplay/useManagedTimeouts.ts')
assert(/clearTimeout/.test(managed) && /return \(\) =>/.test(managed), 'useManagedTimeouts clears every outstanding timeout on unmount')
const sessionHook = read('components/gameRoomV2/gameplay/useGameSessionState.ts')
assert(/clearInterval\(interval\)/.test(sessionHook) && /stopAllSounds/.test(sessionHook), 'the shared session hook clears its poll and stops all audio on unmount')

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
