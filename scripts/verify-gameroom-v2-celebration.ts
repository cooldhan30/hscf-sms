// Shared correct-answer celebration (lib/gameRoomV2/celebration +
// components/gameRoomV2/celebration):
//   1. intensity tiers: small -> streak -> major -> victory
//   2. particle budgets are capped; full confetti is victory-only
//   3. Tamil-first praise, rewards and encouragement
//   4. the canvas layer respects reduced motion and sound, cancels its
//      animation frame, and only runs while particles are alive
//   5. every active game mounts it; wrong answers use the calm review card
//
//   npx tsx scripts/verify-gameroom-v2-celebration.ts
import { readFileSync } from 'fs'
import {
  tierFor,
  TIER_SPEC,
  MAX_PARTICLES,
  STREAK_TIER_AT,
  praiseFor,
  rewardText,
  encouragementFor,
  ENCOURAGEMENT,
  PRAISE,
  REWARD_LABEL,
} from '../lib/gameRoomV2/celebration'

let failures = 0
function assert(cond: unknown, msg: string) {
  if (!cond) {
    failures++
    console.error(`  FAIL: ${msg}`)
  }
}
const read = (f: string) => readFileSync(f, 'utf8')
const TAMIL = /[஀-௿]/

// 1. tiers
assert(tierFor({ streak: 1 }) === 'small', 'first correct answer = small')
assert(tierFor({ streak: STREAK_TIER_AT - 1 }) === 'small', 'short streak = small')
assert(tierFor({ streak: STREAK_TIER_AT }) === 'streak', 'streak threshold = streak')
assert(tierFor({ streak: 5 }) === 'major', 'streak milestone (5) = major')
assert(tierFor({ streak: 1, hard: true }) === 'major', 'hard question = major')
assert(tierFor({ streak: 1, milestone: true }) === 'major', 'game milestone = major')
assert(tierFor({ streak: 0, victory: true }) === 'victory', 'victory = victory')

// 2. budgets
const order = ['small', 'streak', 'major', 'victory'] as const
for (let i = 1; i < order.length; i++) {
  const a = TIER_SPEC[order[i - 1]]
  const b = TIER_SPEC[order[i]]
  assert(b.sparks >= a.sparks && b.confetti >= a.confetti && b.cardMs >= a.cardMs, `${order[i]} is at least as strong as ${order[i - 1]}`)
}
assert(TIER_SPEC.small.confetti === 0, 'an ordinary correct answer has no confetti (not overwhelming)')
for (const t of order) assert(TIER_SPEC[t].sparks + TIER_SPEC[t].confetti <= MAX_PARTICLES, `${t} fits the particle cap`)
assert(MAX_PARTICLES <= 300, 'global particle cap stays small')
assert(!Object.values(TIER_SPEC).some((s) => (s as unknown as Record<string, unknown>).shake), 'no screen shake on success')

// 3. Tamil-first text
for (const t of order) for (const p of PRAISE[t]) assert(TAMIL.test(p), `praise "${p}" is Tamil`)
assert(praiseFor('small', 3) === praiseFor('small', 3), 'praise is deterministic')
for (const [k, v] of Object.entries(REWARD_LABEL)) assert(TAMIL.test(v.ta), `reward label ${k} is Tamil`)
assert(rewardText({ kind: 'coins', amount: 45 }) === '+45 நாணயங்கள்', 'reward line: +45 நாணயங்கள்')
assert(rewardText({ kind: 'power', label: 'கேடயம்' }) === '+ கேடயம்', 'named power-up reward')
for (const e of ENCOURAGEMENT) assert(TAMIL.test(e.ta) && !/wrong|fail|bad/i.test(e.en), `encouragement "${e.en}" is kind`)
assert(encouragementFor(-3) !== undefined, 'encouragement handles any seed')

// 4. layer behaviour
const layer = read('components/gameRoomV2/celebration/CelebrationLayer.tsx')
assert(/if \(!reducedRef\.current\) spawnBurst/.test(layer), 'no particles with reduced motion')
assert(/cancelAnimationFrame\(raf\.current\)/.test(layer), 'animation frame cancelled on unmount')
assert(/if \(ps\.length > 0 \|\| rings\.current\.length > 0\) raf\.current = requestAnimationFrame/.test(layer), 'frame loop stops when no particles are alive')
assert(/MAX_PARTICLES - parts\.current\.length/.test(layer), 'spawns respect the live particle cap')
assert(/playSound\(id, soundRef\.current/.test(layer) && /vibrate\(spec\.haptic, soundRef\.current\)/.test(layer), 'sound and haptics follow the sound toggle')
assert(/pointer-events-none/.test(layer), 'celebration never blocks input')
assert(/aria-live="polite"/.test(layer) && /role="status"/.test(layer), 'celebration is announced to screen readers')
assert(/<span aria-hidden>✓<\/span>/.test(layer), 'correct shown with a symbol, not colour alone')
const review = read('components/gameRoomV2/celebration/AnswerReview.tsx')
assert(!/shake|animate-gamev2-shake|terracotta-7|bg-red/.test(review), 'wrong-answer card has no shame effects')
assert(/TA\.yourAnswer/.test(review) && /TA\.correctAnswer/.test(review) && /TA\.why/.test(review) && /nudge/.test(review), 'wrong answers show answer, correct answer, explanation and encouragement')

// 5. every active game mounts it
const GAMES: Record<string, string> = {
  'classic-quiz': 'components/gameRoomV2/gameplay/GameSessionRuntime.tsx',
  'tower-defense': 'components/gameRoomV2/towerDefense/TowerDefenseGame.tsx',
  'boss-battle': 'components/gameRoomV2/bossBattle/brawl/BrawlGame.tsx',
  'word-ninja': 'components/gameRoomV2/wordNinja/WordNinjaGame.tsx',
  matching: 'components/gameRoomV2/matching/MatchingGame.tsx',
  memory: 'components/gameRoomV2/memory/MemoryGame.tsx',
}
for (const [id, file] of Object.entries(GAMES)) {
  const src = read(file)
  assert(/<CelebrationLayer/.test(src), `${id} mounts the celebration layer`)
  assert(/celebrateRef\.current\?\.correct|fx\.current\?\.correct|celebrate\.current\?\.correct/.test(src), `${id} celebrates correct answers`)
}

if (failures) {
  console.error(`FAIL: ${failures} failure(s).`)
  process.exit(1)
}
console.log('PASS: 0 failure(s).')
