// GameRoom Classic Phase 5: live-game rules (lib/grClassic/live.ts).
// Run with: npx tsx scripts/verify-grc-live.ts
import qrcode from 'qrcode-generator'
import { ANSWER_GRACE_MS, LIVE_EXPIRY_MS, canAnswerLive, isExpired, isRace, makePin, nextStep, nicknameFor, normalizePin, raceBonus, rankPlayers } from '../lib/grClassic/live'
import { livePoints } from '../lib/grClassic/scoring'

let failures = 0
let passes = 0
function eq(name: string, got: unknown, want: unknown) {
  if (JSON.stringify(got) === JSON.stringify(want)) passes++
  else {
    failures++
    console.error(`FAIL ${name}\n  got:  ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`)
  }
}

// --- Steps: Classic Quiz, question by question ---
const walk: string[] = []
let st = { status: 'lobby' as const as Parameters<typeof nextStep>[1], index: -1 }
for (let i = 0; i < 20; i++) {
  const n = nextStep('quiz', st.status, st.index, 2)
  if (!n) break
  st = n
  walk.push(`${n.status}${n.status === 'ended' ? '' : n.index}`)
}
eq('quiz walk', walk, ['question0', 'reveal0', 'leaderboard0', 'question1', 'reveal1', 'leaderboard1', 'ended'])
eq('nothing after ended', nextStep('quiz', 'ended', 1, 2), null)

// --- Steps: race games ---
eq('match is a race', [isRace('match'), isRace('word-builder'), isRace('quiz')], [true, true, false])
eq('race walk', [nextStep('match', 'lobby', -1, 3), nextStep('match', 'race', 0, 3), nextStep('match', 'ended', 0, 3)], [{ status: 'race', index: 0 }, { status: 'ended', index: 0 }, null])

// --- Answering windows (server clock) ---
const T = new Date('2026-10-13T10:00:00Z').getTime()
const ends = new Date(T).toISOString()
eq('on time', canAnswerLive({ status: 'question', question_ends_at: ends }, false, T - 1000), true)
eq('within grace', canAnswerLive({ status: 'question', question_ends_at: ends }, false, T + ANSWER_GRACE_MS - 1), true)
eq('too late', canAnswerLive({ status: 'question', question_ends_at: ends }, false, T + ANSWER_GRACE_MS + 1), false)
eq('not during reveal', canAnswerLive({ status: 'reveal', question_ends_at: ends }, false, T - 1000), false)
eq('race open', canAnswerLive({ status: 'race', question_ends_at: null }, true, T), true)
eq('race over', canAnswerLive({ status: 'ended', question_ends_at: null }, true, T), false)

// --- PINs ---
const pins = Array.from({ length: 2000 }, () => makePin())
eq('PINs are 6 digits, never start with 0', pins.every((p) => /^[1-9]\d{5}$/.test(p)), true)
eq('PIN edges', [makePin(() => 0), makePin(() => 0.9999999)], ['100000', '999999'])
eq('PIN typed with spaces', normalizePin(' 482 913 '), '482913')
eq('PIN junk', [normalizePin(482913), normalizePin('abc')], ['', ''])

// --- Nicknames ---
eq('first name', nicknameFor('Kavin', 'Raj', []), 'Kavin')
eq('same first name gets initial', nicknameFor('Kavin', 'Raj', ['Kavin']), 'Kavin R.')
eq('case-insensitive', nicknameFor('kavin', 'raj', ['KAVIN']), 'kavin R.')
eq('then a number', nicknameFor('Kavin', 'Ravi', ['Kavin', 'Kavin R.']), 'Kavin R. 2')
eq('Tamil initial keeps its vowel sign', nicknameFor('கயல்', 'முருகன்', ['கயல்']), 'கயல் மு.')

// --- Points and ranking ---
eq('speed points', [livePoints(true, 0, 20000), livePoints(true, 10000, 20000), livePoints(false, 0, 20000)], [1000, 750, 0])
const players = [
  { student_id: 'a', nickname: 'Anbu', finished_at: null },
  { student_id: 'b', nickname: 'Bala', finished_at: null },
  { student_id: 'c', nickname: 'Chitra', finished_at: null },
  { student_id: 'd', nickname: 'Devi', finished_at: null },
]
const answers = [
  { student_id: 'a', points: 900 },
  { student_id: 'b', points: 700 },
  { student_id: 'b', points: 200 },
  { student_id: 'c', points: 500 },
]
eq('quiz ranking with a tie', rankPlayers(players, answers, false).map((p) => [p.nickname, p.score, p.rank]), [['Anbu', 900, 1], ['Bala', 900, 1], ['Chitra', 500, 3], ['Devi', 0, 4]])
const racers = players.map((p, i) => ({ ...p, finished_at: i < 2 ? new Date(T + (1 - i) * 1000).toISOString() : null })) // Bala finished first
eq('race bonus for finishing order', rankPlayers(racers, [], true).map((p) => [p.nickname, p.score]), [['Bala', 500], ['Anbu', 400], ['Chitra', 0], ['Devi', 0]])
eq('race bonus never negative', [raceBonus(0), raceBonus(4), raceBonus(9)], [500, 100, 0])
eq('nobody joined', rankPlayers([], [], false), [])

// --- Expiry ---
eq('fresh game', isExpired(new Date(T).toISOString(), T + 60_000), false)
eq('3 hours idle = over', isExpired(new Date(T).toISOString(), T + LIVE_EXPIRY_MS + 1), true)

// --- The QR code library encodes the join link ---
const qr = qrcode(0, 'M')
qr.addData('https://tamilschoolfl.org/tamizhi/gr-classic/join?pin=482913')
qr.make()
eq('QR code builds', qr.getModuleCount() >= 21 && qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }).startsWith('<svg'), true)

console.log(failures ? `\n${failures} FAILURE(S), ${passes} passed` : `\nPASS: ${passes} checks.`)
process.exit(failures ? 1 : 0)
