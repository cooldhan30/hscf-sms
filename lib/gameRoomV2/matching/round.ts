import { buildCardsFromMatchPayload, shuffledWithSeed, type CardSpec } from '../cardGrid'

// Matching's round logic. Every card is face-up; the player taps one
// card from each side to claim they belong together. The client never
// knows the pairs (see cardGrid/cards.ts), so a claimed pair becomes a
// `pending` attempt that the UI sends to the server's pair-check route;
// resolveAttempt() applies the answer. The state is immutable (each
// function returns a new object) for React.
export interface MatchingRoundState {
  cards: CardSpec[]
  selectedCardId: string | null
  // A claimed left/right pair waiting for the server's verdict.
  pending: { leftId: string; rightId: string } | null
  matchedCardIds: string[]
  // Confirmed pairs, by label (left -> right).
  pairs: Record<string, string>
  // The FIRST right card each left card was paired with -- what the
  // round submits, so the server grades whether the student knew every
  // pair first time (a round solved by trial and error is graded wrong).
  firstGuess: Record<string, string>
  lastAttempt: { cardIds: [string, string]; correct: boolean } | null
  moves: number
  mistakes: number
  currentStreak: number
  bestStreak: number
}

export function createMatchingRound(left: string[], right: string[], seed: string): MatchingRoundState {
  return {
    cards: shuffledWithSeed(buildCardsFromMatchPayload(left, right), seed),
    selectedCardId: null,
    pending: null,
    matchedCardIds: [],
    pairs: {},
    firstGuess: {},
    lastAttempt: null,
    moves: 0,
    mistakes: 0,
    currentStreak: 0,
    bestStreak: 0,
  }
}

export function totalPairs(state: MatchingRoundState): number {
  return Math.min(state.cards.filter((c) => c.side === 'left').length, state.cards.filter((c) => c.side === 'right').length)
}

export function isRoundComplete(state: MatchingRoundState): boolean {
  return totalPairs(state) > 0 && Object.keys(state.pairs).length === totalPairs(state)
}

// First tap selects a card. Tapping a card on the SAME side switches the
// selection (a pair is always one of each side); tapping the selected
// card again deselects it; tapping a card on the other side claims the
// pair (-> pending). Matched cards and taps while a claim is pending are
// ignored.
export function selectCard(state: MatchingRoundState, cardId: string): MatchingRoundState {
  const card = state.cards.find((c) => c.id === cardId)
  if (!card || state.pending || state.matchedCardIds.includes(cardId)) return state
  if (!state.selectedCardId || state.selectedCardId === cardId) {
    return { ...state, selectedCardId: state.selectedCardId === cardId ? null : cardId, lastAttempt: null }
  }
  const first = state.cards.find((c) => c.id === state.selectedCardId)!
  if (first.side === card.side) return { ...state, selectedCardId: cardId, lastAttempt: null }
  const [l, r] = first.side === 'left' ? [first, card] : [card, first]
  return { ...state, selectedCardId: null, pending: { leftId: l.id, rightId: r.id }, lastAttempt: null }
}

export function pendingLabels(state: MatchingRoundState): { left: string; right: string } | null {
  if (!state.pending) return null
  const l = state.cards.find((c) => c.id === state.pending!.leftId)
  const r = state.cards.find((c) => c.id === state.pending!.rightId)
  return l && r ? { left: l.label, right: r.label } : null
}

// Applies the server's verdict on the pending claim.
export function resolveAttempt(state: MatchingRoundState, isPair: boolean): MatchingRoundState {
  const labels = pendingLabels(state)
  if (!state.pending || !labels) return state
  const { leftId, rightId } = state.pending
  const firstGuess = labels.left in state.firstGuess ? state.firstGuess : { ...state.firstGuess, [labels.left]: labels.right }
  const nextStreak = isPair ? state.currentStreak + 1 : 0
  return {
    ...state,
    pending: null,
    matchedCardIds: isPair ? [...state.matchedCardIds, leftId, rightId] : state.matchedCardIds,
    pairs: isPair ? { ...state.pairs, [labels.left]: labels.right } : state.pairs,
    firstGuess,
    lastAttempt: { cardIds: [leftId, rightId], correct: isPair },
    moves: state.moves + 1,
    mistakes: state.mistakes + (isPair ? 0 : 1),
    currentStreak: nextStreak,
    bestStreak: Math.max(state.bestStreak, nextStreak),
  }
}

// Drops a pending claim (e.g. the check request failed) so the player
// can try again.
export function cancelAttempt(state: MatchingRoundState): MatchingRoundState {
  return state.pending ? { ...state, pending: null } : state
}

export function acknowledgeAttempt(state: MatchingRoundState): MatchingRoundState {
  if (!state.lastAttempt) return state
  return { ...state, lastAttempt: null }
}

// The Record<left, right> submission graded by gradeAnswer's MATCH case:
// each left card's FIRST claimed partner. Every left card has one once
// the round is complete (a card is only matched after being claimed).
export function buildRoundSubmission(state: MatchingRoundState): Record<string, string> {
  return { ...state.pairs, ...state.firstGuess }
}

// In-match star rating for a cleared round (display only; points and
// rewards are server-computed). 3 = every pair right first time and
// inside the timer; 2 = one slip, or perfect but over time; 1 = cleared.
export function matchingStars(mistakes: number, timedOut: boolean): 1 | 2 | 3 {
  if (mistakes === 0 && !timedOut) return 3
  if ((mistakes <= 1 && !timedOut) || mistakes === 0) return 2
  return 1
}
