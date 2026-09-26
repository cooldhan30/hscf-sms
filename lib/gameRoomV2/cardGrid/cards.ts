// Shared, engine-agnostic card/grid primitives -- used by BOTH Matching
// and Memory, but deliberately limited to the parts that are genuinely
// identical between them: representing "a deck of cards with pair
// relationships" and laying it out responsively. Everything about HOW
// a card is revealed/matched (Matching's tap-two-visible-items vs.
// Memory's flip-and-remember) stays in each engine's own round logic,
// per the "keep the games behaviorally distinct" requirement.

export interface CardSpec {
  id: string
  // Which side of the MATCH question this card came from. A pair is
  // always one left card and one right card.
  side: 'left' | 'right'
  label: string
}

// Builds one CardSpec per item of a MATCH question's stripped payload
// (payload.left / payload.right, exactly as delivered by
// app/api/gameroom-v2/sessions/[id]/state/route.ts) -- a card grid is
// DERIVED from the existing MATCH payload, never authored or stored
// separately.
//
// IMPORTANT: the server shuffles `left` and `right` independently with
// a server-only salt, so left[i] and right[i] are NOT a pair and the
// client cannot know which cards pair up. Cards therefore carry no pair
// identity at all: whether an attempted left/right pair is correct is
// asked of the server (POST /sessions/[id]/pair-check), and the final
// mapping is graded by /answer.
export function buildCardsFromMatchPayload(left: string[], right: string[]): CardSpec[] {
  return [
    ...left.map((label, i) => ({ id: `L${i}`, side: 'left' as const, label })),
    ...right.map((label, i) => ({ id: `R${i}`, side: 'right' as const, label })),
  ]
}

// Deterministic shuffle (Fisher-Yates with a seeded PRNG), so a given
// session/question combination lays out the SAME shuffled grid on every
// re-render (no visible re-shuffle on a poll-driven re-render) while
// still varying between different questions/sessions. Mirrors the
// generator determinism pattern established in Mystery Mansion.
function mulberry32(seed: number) {
  let a = seed
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashSeed(input: string): number {
  let h = 1779033703 ^ input.length
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}

export function shuffledWithSeed<T>(items: T[], seed: string): T[] {
  const rand = mulberry32(hashSeed(seed))
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// Grid column count that stays visually balanced across card counts --
// shared by both engines' responsive layout so "responsive grid" means
// the same sizing rules everywhere, not two independently-tuned
// breakpoint sets.
export function gridColumnsForCardCount(cardCount: number): { base: number; sm: number } {
  if (cardCount <= 6) return { base: 2, sm: 3 }
  if (cardCount <= 12) return { base: 3, sm: 4 }
  return { base: 4, sm: 5 }
}
