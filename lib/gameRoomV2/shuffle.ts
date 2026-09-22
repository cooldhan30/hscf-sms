// Forked from lib/gameRoom/shuffle.ts rather than imported -- the
// discovery report classified the original as SAFE TO REUSE (pure,
// zero table/route coupling), but GameRoom V2 never takes a code
// dependency on legacy GameRoom, even for a genuinely safe-to-share
// pure function, so a future change to legacy's file can never ripple
// into V2's gameplay. See lib/gameRoomV2/README.md.
//
// Fisher-Yates -- unbiased, unlike a naive `.sort(() => Math.random() -
// 0.5)`. Used for the one-time randomization of a session's question
// order (computed once at session creation, persisted on
// sms_gamev2_sessions.question_order, never re-derived).
export function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// A tiny deterministic PRNG (mulberry32) seeded from a string -- NOT
// for cryptographic use, just a stable-but-arbitrary order.
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

// Returns the SAME order every time for a given (sessionId, questionId)
// pair, seeded off that combination -- so a question's answer-option
// order stays visually stable across repeated polls/renders for one
// player, while still differing between sessions and between
// questions. Legacy GameRoom's shuffledOptionsFor documents the exact
// bug this prevents: naive re-shuffling on every poll caused a
// student's tap to land on whatever option had rotated into that
// screen position by the time the request reached the server.
export function shuffledOptionsFor<T>(items: T[], seed: string): T[] {
  const random = seededRandom(seed)
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
