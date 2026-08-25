// Fisher-Yates -- unbiased, unlike the `.sort(() => Math.random() - 0.5)`
// idiom used elsewhere in this codebase (Tamil Theni's answer-option
// shuffle), which is a well-known biased shuffle. Used for the two
// one-time randomization points in Game Room: session question-set
// selection and each player's personal question order (both computed
// once and persisted, never re-derived). For a per-poll, non-persisted
// shuffle (answer option order), use shuffledOptionsFor below instead --
// plain shuffle() would reorder on every call.
export function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// A tiny deterministic PRNG (mulberry32) seeded from a string -- NOT for
// cryptographic use, just for producing a stable-but-arbitrary order.
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

// Confirmed as a real bug: /api/game-room/state is polled every ~2s, and
// calling plain shuffle() on the answer options there re-randomized
// their on-screen order every single poll -- a student's tap landed on
// whatever option had rotated into that position by the time the
// request reached the server, not the one they actually looked at and
// pressed. This returns the SAME order every time for a given
// (playerId, questionId) pair (seeded off that combination), so a
// question's options stay visually stable for the whole time a player
// is looking at it, while still differing between players and between
// questions -- no single fixed layout to memorize/exploit either.
export function shuffledOptionsFor<T>(items: T[], seed: string): T[] {
  const random = seededRandom(seed)
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
