import { buildCardsFromMatchPayload, shuffledWithSeed, type CardSpec } from '../cardGrid'

// Memory's own round logic -- unlike Matching, every card starts FACE
// DOWN and must be flipped to reveal its label; the challenge is
// remembering where things are, not just recognizing relationships.
// This is what keeps Memory and Matching genuinely different games
// despite sharing the same FlipCard/CardGrid visual primitives.
export interface MemoryRoundState {
  cards: CardSpec[]
  // Card ids currently face-up but not yet resolved as matched/
  // mismatched -- at most 2 at a time (classic memory rules: flip one,
  // flip a second, then resolve).
  flippedCardIds: string[]
  matchedPairIds: string[]
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
    matchedPairIds: [],
    lastAttempt: null,
    moves: 0,
    currentStreak: 0,
    bestStreak: 0,
  }
}

export function isRoundComplete(state: MemoryRoundState): boolean {
  const totalPairs = state.cards.length / 2
  return state.matchedPairIds.length === totalPairs
}

// Whether a card can currently be flipped -- never while two cards are
// already face-up awaiting resolution (classic memory's "wait for the
// pair to resolve" rule), never an already-matched card, and never the
// same card twice.
export function canFlip(state: MemoryRoundState, cardId: string): boolean {
  const card = state.cards.find((c) => c.id === cardId)
  if (!card) return false
  if (state.matchedPairIds.includes(card.pairId)) return false
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

// Resolves the two currently-flipped cards: a real match locks them in
// (added to matchedPairIds, cleared from flippedCardIds); a mismatch
// clears flippedCardIds so both flip back face-down, WITHOUT removing
// anything already matched -- a wrong guess only ever costs a move,
// never previously-found progress. No-ops if fewer than 2 cards are
// currently flipped.
export function resolveFlippedPair(state: MemoryRoundState): MemoryRoundState {
  if (state.flippedCardIds.length !== 2) return state
  const [aId, bId] = state.flippedCardIds
  const a = state.cards.find((c) => c.id === aId)!
  const b = state.cards.find((c) => c.id === bId)!
  const correct = a.pairId === b.pairId
  const nextStreak = correct ? state.currentStreak + 1 : 0

  return {
    ...state,
    flippedCardIds: [],
    matchedPairIds: correct ? [...state.matchedPairIds, a.pairId] : state.matchedPairIds,
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
  return state.flippedCardIds.includes(card.id) || state.matchedPairIds.includes(card.pairId)
}

// Same submission contract as Matching -- reuses the EXACT existing
// MATCH grading path (lib/gameRoomV2/gradeAnswer.ts), never a new
// grading rule. A round only reaches "ready to submit" once every pair
// is genuinely matched by construction, so this is always correct;
// Memory's real difficulty is remembering positions efficiently (fewer
// moves, longer streaks), not whether the final submission can fail.
export function buildRoundSubmission(state: MemoryRoundState): Record<string, string> {
  const submission: Record<string, string> = {}
  for (const pairId of state.matchedPairIds) {
    const leftCard = state.cards.find((c) => c.pairId === pairId && c.side === 'left')
    const rightCard = state.cards.find((c) => c.pairId === pairId && c.side === 'right')
    if (leftCard && rightCard) submission[leftCard.label] = rightCard.label
  }
  return submission
}
