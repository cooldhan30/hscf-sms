import { buildCardsFromMatchPayload, shuffledWithSeed, type CardSpec } from '../cardGrid'

// Memory's own round logic -- unlike Matching, every card starts FACE
// DOWN and must be flipped to reveal its label; the challenge is
// remembering where things are, not just recognizing relationships.
// This is what keeps Memory and Matching genuinely different games
// despite sharing the same FlipCard/CardGrid visual primitives.
//
// The client never knows the pairs (the server shuffles each side with a
// secret salt -- see cardGrid/cards.ts). Two face-up cards from the same
// side can never be a pair and resolve locally; a left+right pair is
// checked with the server's pair-check route and the verdict passed to
// resolveFlippedPair().
export interface MemoryRoundState {
  cards: CardSpec[]
  // Card ids currently face-up but not yet resolved as matched/
  // mismatched -- at most 2 at a time (classic memory rules: flip one,
  // flip a second, then resolve).
  flippedCardIds: string[]
  matchedCardIds: string[]
  // Confirmed pairs, by label (left -> right).
  pairs: Record<string, string>
  lastAttempt: { cardIds: [string, string]; correct: boolean } | null
  moves: number
  currentStreak: number
  bestStreak: number
}

export function createMemoryRound(left: string[], right: string[], seed: string): MemoryRoundState {
  const cards = shuffledWithSeed(buildCardsFromMatchPayload(left, right), seed)
  return {
    cards,
    flippedCardIds: [],
    matchedCardIds: [],
    pairs: {},
    lastAttempt: null,
    moves: 0,
    currentStreak: 0,
    bestStreak: 0,
  }
}

export function totalPairs(state: MemoryRoundState): number {
  return Math.min(state.cards.filter((c) => c.side === 'left').length, state.cards.filter((c) => c.side === 'right').length)
}

export function isRoundComplete(state: MemoryRoundState): boolean {
  return totalPairs(state) > 0 && Object.keys(state.pairs).length === totalPairs(state)
}

// Whether a card can currently be flipped -- never while two cards are
// already face-up awaiting resolution (classic memory's "wait for the
// pair to resolve" rule), never an already-matched card, and never the
// same card twice.
export function canFlip(state: MemoryRoundState, cardId: string): boolean {
  const card = state.cards.find((c) => c.id === cardId)
  if (!card) return false
  if (state.matchedCardIds.includes(cardId)) return false
  if (state.flippedCardIds.includes(cardId)) return false
  return state.flippedCardIds.length < 2
}

// Flips a card face-up. Resolving a pair (once 2 are face-up) is a
// SEPARATE step (resolveFlippedPair below) rather than automatic here,
// so the UI gets a deliberate beat to show both revealed faces before
// mismatch/match feedback plays -- the classic memory-game pacing.
export function flipCard(state: MemoryRoundState, cardId: string): MemoryRoundState {
  if (!canFlip(state, cardId)) return state
  return { ...state, flippedCardIds: [...state.flippedCardIds, cardId], lastAttempt: null }
}

// The two face-up cards as a left/right label pair when they need the
// server's verdict; null when fewer than two are up or both are from the
// same side (never a pair -- resolve with isPair=false, no request).
export function flippedPairToCheck(state: MemoryRoundState): { left: string; right: string } | null {
  if (state.flippedCardIds.length !== 2) return null
  const [a, b] = state.flippedCardIds.map((id) => state.cards.find((c) => c.id === id)!)
  if (a.side === b.side) return null
  const [l, r] = a.side === 'left' ? [a, b] : [b, a]
  return { left: l.label, right: r.label }
}

// Resolves the two currently-flipped cards with the verdict: a real
// match locks them in; a mismatch flips both back face-down WITHOUT
// removing anything already matched -- a wrong guess only ever costs a
// move. No-ops if fewer than 2 cards are currently flipped.
export function resolveFlippedPair(state: MemoryRoundState, isPair: boolean): MemoryRoundState {
  if (state.flippedCardIds.length !== 2) return state
  const [aId, bId] = state.flippedCardIds
  const labels = flippedPairToCheck(state)
  const correct = isPair && !!labels
  const nextStreak = correct ? state.currentStreak + 1 : 0

  return {
    ...state,
    flippedCardIds: [],
    matchedCardIds: correct ? [...state.matchedCardIds, aId, bId] : state.matchedCardIds,
    pairs: correct && labels ? { ...state.pairs, [labels.left]: labels.right } : state.pairs,
    lastAttempt: { cardIds: [aId, bId], correct },
    moves: state.moves + 1,
    currentStreak: nextStreak,
    bestStreak: Math.max(state.bestStreak, nextStreak),
  }
}

export function acknowledgeAttempt(state: MemoryRoundState): MemoryRoundState {
  if (!state.lastAttempt) return state
  return { ...state, lastAttempt: null }
}

// Whether a specific card should currently render face-up -- either
// mid-flip (awaiting resolution) or permanently revealed because it's
// already matched. Kept as a pure helper so the UI never has to
// re-derive this logic itself.
export function isCardFaceUp(state: MemoryRoundState, card: CardSpec): boolean {
  return state.flippedCardIds.includes(card.id) || state.matchedCardIds.includes(card.id)
}

// The Record<left, right> of every server-confirmed pair, graded by the
// EXISTING MATCH path in gradeAnswer. Memory's challenge is remembering
// positions (fewer moves, longer streaks, and the server-timed speed
// bonus), so a finished round is always a correct mapping.
export function buildRoundSubmission(state: MemoryRoundState): Record<string, string> {
  return { ...state.pairs }
}

// In-match star rating for a cleared round (display only): few wasted
// flips earn more stars. A perfect memory needs `pairs` moves; some
// discovery flips are unavoidable, hence the allowance.
export function memoryStars(moves: number, pairs: number): 1 | 2 | 3 {
  if (moves <= pairs + Math.ceil(pairs / 2)) return 3
  if (moves <= pairs * 2) return 2
  return 1
}
