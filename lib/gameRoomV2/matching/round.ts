import { buildCardsFromMatchPayload, shuffledWithSeed, type CardSpec } from '../cardGrid'

// Matching's own round logic -- unlike Memory, every card is ALWAYS
// face-up/visible (nothing to remember, the challenge is purely
// "which two go together"), and a selection resolves instantly on the
// second tap. This keeps Matching and Memory genuinely different
// games despite sharing the same FlipCard/CardGrid visual primitives.
export interface MatchingRoundState {
  cards: CardSpec[]
  selectedCardId: string | null
  matchedPairIds: string[]
  // The last attempted pair, kept briefly so the UI can show
  // matched/mismatched feedback before it's cleared -- mirrors the
  // "revealedClue" one-shot pattern from Mystery Mansion.
  lastAttempt: { cardIds: [string, string]; correct: boolean } | null
  moves: number
  currentStreak: number
  bestStreak: number
}

export function createMatchingRound(left: string[], right: string[], seed: string): MatchingRoundState {
  const cards = shuffledWithSeed(buildCardsFromMatchPayload(left, right), seed)
  return {
    cards,
    selectedCardId: null,
    matchedPairIds: [],
    lastAttempt: null,
    moves: 0,
    currentStreak: 0,
    bestStreak: 0,
  }
}

export function isRoundComplete(state: MatchingRoundState): boolean {
  const totalPairs = state.cards.length / 2
  return state.matchedPairIds.length === totalPairs
}

// Selecting a card: the first tap just highlights it; the second tap
// (on a DIFFERENT card) resolves the attempt immediately -- correct if
// the two share a pairId, incorrect otherwise. An already-matched card
// can never be selected again (guarded by the caller's `disabled`
// prop, but also defensively here).
export function selectCard(state: MatchingRoundState, cardId: string): MatchingRoundState {
  const card = state.cards.find((c) => c.id === cardId)
  if (!card || state.matchedPairIds.includes(card.pairId)) return state

  if (!state.selectedCardId) {
    return { ...state, selectedCardId: cardId, lastAttempt: null }
  }

  if (state.selectedCardId === cardId) {
    // Tapping the same card again deselects it.
    return { ...state, selectedCardId: null }
  }

  const first = state.cards.find((c) => c.id === state.selectedCardId)!
  const correct = first.pairId === card.pairId
  const nextStreak = correct ? state.currentStreak + 1 : 0

  return {
    ...state,
    selectedCardId: null,
    matchedPairIds: correct ? [...state.matchedPairIds, first.pairId] : state.matchedPairIds,
    lastAttempt: { cardIds: [first.id, card.id], correct },
    moves: state.moves + 1,
    currentStreak: nextStreak,
    bestStreak: Math.max(state.bestStreak, nextStreak),
  }
}

// Clears the one-shot lastAttempt flag once its feedback animation has
// played (called on a short timer by the UI, same pattern as every
// prior engine's "just completed"/"revealed clue" acknowledgement).
export function acknowledgeAttempt(state: MatchingRoundState): MatchingRoundState {
  if (!state.lastAttempt) return state
  return { ...state, lastAttempt: null }
}

// Builds the Record<left, right> submission the shared MATCH grading
// (lib/gameRoomV2/gradeAnswer.ts) already expects, once every pair has
// been matched -- reusing the EXACT same server-side grading path
// every dropdown-form MatchInput submission goes through. Matching
// never grades itself client-side; a round only ever reaches "ready to
// submit" once every pair genuinely matches by construction (a card
// can't be marked matched unless selectCard found equal pairIds), so
// this submission is always 100% correct -- the real difficulty lives
// in how quickly/efficiently (fewest moves, highest streak) the round
// was solved, not in whether it can be "submitted wrong."
export function buildRoundSubmission(state: MatchingRoundState): Record<string, string> {
  const submission: Record<string, string> = {}
  for (const pairId of state.matchedPairIds) {
    const leftCard = state.cards.find((c) => c.pairId === pairId && c.side === 'left')
    const rightCard = state.cards.find((c) => c.pairId === pairId && c.side === 'right')
    if (leftCard && rightCard) submission[leftCard.label] = rightCard.label
  }
  return submission
}
