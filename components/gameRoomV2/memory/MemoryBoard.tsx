'use client'

import { CardGrid, FlipCard, type CardVisualState } from '@/components/gameRoomV2/cardGrid'
import { isCardFaceUp, type MemoryRoundState } from '@/lib/gameRoomV2/memory'

// The Memory board -- cards start face down (using the shared
// FlipCard's back face) and flip up on activation, using the same
// CardGrid/FlipCard primitives Matching uses but with a genuinely
// different interaction: `faceUp` is per-card and starts false, so the
// classic flip animation actually plays here (Matching's cards are
// always face-up, so its FlipCard usage never shows the back face at
// all). Mismatch feedback rings both flipped cards red before they
// flip back down; matched cards stay face up permanently with a green
// ring. Every card is a real <button>, so mouse, touch, and
// keyboard Tab+Enter all activate it identically.
export function MemoryBoard({ round, disabled, onFlip }: { round: MemoryRoundState; disabled: boolean; onFlip: (cardId: string) => void }) {
  return (
    <CardGrid cardCount={round.cards.length}>
      {round.cards.map((card) => {
        const isMatched = round.matchedPairIds.includes(card.pairId)
        const faceUp = isCardFaceUp(round, card)
        const isLastAttemptCard = round.lastAttempt?.cardIds.includes(card.id) ?? false

        let state: CardVisualState = faceUp ? 'revealed' : 'hidden'
        if (isMatched) state = 'matched'
        else if (isLastAttemptCard) state = round.lastAttempt!.correct ? 'matched' : 'mismatched'

        return (
          <FlipCard
            key={card.id}
            label={card.label}
            faceUp={faceUp}
            state={state}
            disabled={disabled || isMatched || (round.flippedCardIds.length >= 2 && !round.flippedCardIds.includes(card.id))}
            onActivate={() => onFlip(card.id)}
            ariaLabel={isMatched ? `${card.label}, matched` : faceUp ? card.label : 'Face-down card, tap to flip'}
          />
        )
      })}
    </CardGrid>
  )
}
