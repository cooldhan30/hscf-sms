// Verification for Balloon Pop's "pop every <type>" rounds
// (lib/gameRoomV2/balloonPop/stream.ts) and the server routes that use
// them. Covers: the asked-for type rotating by round, the balloon stream
// (every item POP_REPEAT times, both types mixed), per-pop checks, round
// scoring (points/XP per right pop, wrong and missed counted, perfect
// rounds), and that a client can't score balloons that don't exist.
//
// Run with: npx tsx scripts/verify-gameroom-v2-balloon-pop.ts

import { readFileSync } from 'fs'
import { POP_REPEAT, POINTS_PER_POP, XP_PER_POP, BALLOON_POP_ENGINE_ID, checkPop, gradePops, popStream, popTarget } from '../lib/gameRoomV2/balloonPop/stream'
import { getGameEngineV2 } from '../lib/gameRoomV2/registry'
import { getBuiltinTopic, setForEngine } from '../lib/gameRoomV2/builtin/catalog'

let failures = 0
function assert(cond: unknown, label: string) {
  if (cond) console.log(`  ok: ${label}`)
  else {
    console.error(`  FAIL: ${label}`)
    failures++
  }
}

const payload = {
  items: ['அ', 'க்', 'இ', 'ம்'],
  categories: ['உயிரெழுத்து', 'மெய்யெழுத்து'],
  answerKey: { அ: 'உயிரெழுத்து', இ: 'உயிரெழுத்து', க்: 'மெய்யெழுத்து', ம்: 'மெய்யெழுத்து' },
}

console.log('\n== The asked-for type ==')
assert(popTarget(payload.categories, 0) === 'உயிரெழுத்து', 'round 1 asks for the first type')
assert(popTarget(payload.categories, 1) === 'மெய்யெழுத்து', 'round 2 asks for the second type')
assert(popTarget(payload.categories, 2) === 'உயிரெழுத்து', 'round 3 comes back to the first')
assert(popTarget([], 0) === null, 'no categories, no target')

console.log('\n== The balloon stream ==')
let seed = 7
const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
const stream = popStream(payload.items, rnd)
assert(stream.length === payload.items.length * POP_REPEAT, `every item floats up ${POP_REPEAT} times`)
assert(payload.items.every((i) => stream.filter((p) => p.item === i).length === POP_REPEAT), 'each item exactly that many times')
assert(stream.every((p, i) => i === 0 || p.item !== stream[i - 1].item), 'never the same item twice in a row')

console.log('\n== One pop ==')
assert(checkPop(payload, 0, 'அ')?.isTarget === true, 'அ is a உயிரெழுத்து in a உயிர் round')
assert(checkPop(payload, 0, 'க்')?.isTarget === false && checkPop(payload, 0, 'க்')?.category === 'மெய்யெழுத்து', 'க் is not, and the check says what it is')
assert(checkPop(payload, 1, 'க்')?.isTarget === true, 'க் IS the target in a மெய் round')
assert(checkPop(payload, 0, 'ஃ') === null, 'an item that is not in the round is refused')

console.log('\n== Scoring a round ==')
const pops = (...ps: [string, number][]) => ({ popped: ps.map(([item, copy]) => ({ item, copy })) })
const perfect = gradePops(payload, 0, pops(['அ', 0], ['அ', 1], ['இ', 0], ['இ', 1]))
assert(perfect.targets === 2 * POP_REPEAT, 'targets = target items x repeats')
assert(perfect.correct === 4 && perfect.wrong === 0 && perfect.missed === 0 && perfect.perfect, 'all targets, nothing else: a perfect round')
assert(perfect.points === 4 * POINTS_PER_POP && perfect.xp === 4 * XP_PER_POP && perfect.coins > 0, 'points and XP per right pop, coins for perfect')
const mixed = gradePops(payload, 0, pops(['அ', 0], ['க்', 0], ['ம்', 1]))
assert(mixed.correct === 1 && mixed.wrong === 2 && mixed.missed === 3 && !mixed.perfect, 'right, wrong and missed are all counted')
assert(mixed.points === POINTS_PER_POP && mixed.xp === XP_PER_POP, 'wrong pops cost nothing, they just score nothing')
const none = gradePops(payload, 0, { popped: [] })
assert(none.correct === 0 && none.missed === 4 && none.points === 0, 'popping nothing: everything missed, no points')

console.log('\n== Cheating does not pay ==')
const repeat = gradePops(payload, 0, pops(...Array.from({ length: 50 }, () => ['அ', 0] as [string, number])))
assert(repeat.correct === 1, 'the same balloon popped 50 times counts once')
const invented = gradePops(payload, 0, pops(['அ', 5], ['அ', -1], ['ஃ', 0]))
assert(invented.correct === 0 && invented.wrong === 0, 'balloons that never floated up (bad copy, unknown item) are ignored')
assert(gradePops(payload, 0, 'அ').correct === 0 && gradePops(payload, 0, null).correct === 0, 'a malformed answer scores nothing')

console.log('\n== Wiring ==')
const engine = getGameEngineV2(BALLOON_POP_ENGINE_ID)
assert(engine?.compatibility.supportedQuestionTypes.includes('CATEGORIZE'), 'Balloon Pop accepts sorting questions')
assert(engine?.compatibility.supportedQuestionTypes.includes('MULTIPLE_CHOICE'), 'and still accepts choice questions')
const uyir = getBuiltinTopic('uyir-ezhuthukkal')
assert(uyir && setForEngine(uyir, BALLOON_POP_ENGINE_ID)?.kind === 'sort', 'உயிரெழுத்துகள் plays its sorting set in Balloon Pop')
const vilangugal = getBuiltinTopic('vilangugal')
assert(vilangugal && setForEngine(vilangugal, BALLOON_POP_ENGINE_ID)?.kind === 'quiz', 'a topic without sorting still plays its quiz')
const answerRoute = readFileSync('app/api/gameroom-v2/sessions/[id]/answer/route.ts', 'utf8')
assert(/engine_id === BALLOON_POP_ENGINE_ID && question\.question_type === 'CATEGORIZE'/.test(answerRoute) && /gradePops\(/.test(answerRoute), '/answer scores Balloon Pop sorting rounds with gradePops')
const popRoute = readFileSync('app/api/gameroom-v2/sessions/[id]/pop-check/route.ts', 'utf8')
assert(/requireGameV2Session\(/.test(popRoute) && /BALLOON_POP_ENGINE_ID/.test(popRoute) && /'ACTIVE'/.test(popRoute) && /current_index/.test(popRoute), 'pop-check: own session, Balloon Pop only, active, current question only')
assert(!/\.insert\(|\.update\(/.test(popRoute), 'pop-check writes nothing')

console.log(failures ? `\nFAIL: ${failures} failure(s).` : '\nPASS: 0 failure(s).')
if (failures) process.exit(1)
