'use client'

import { CardGrid, FlipCard, type CardVisualState } from '@/components/gameRoomV2/cardGrid'
import { isCardFaceUp, type MemoryRoundState } from '@/lib/gameRoomV2/memory'

// The Memory board -- cards start face down (a kolam back) and flip up
// on activation. Two face-up cards wait for the verdict (same-side cards
// resolve at once; a left+right pair is checked by the server), then a
// match stays face up with a green ring and a mismatch rings red and
// flips back. Every card is a real <button>: mouse, touch and keyboard.
export function MemoryBoard({ round, disabled, onFlip }: { round: MemoryRoundState; disabled: boolean; onFlip: (cardId: string) => void }) {
  return (
    <CardGrid cardCount={round.cards.length}>
      {round.cards.map((card) => {
        const isMatched = round.matchedCardIds.includes(card.id)
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
            ariaLabel={isMatched ? `${card.label}, பொருந்தியது` : faceUp ? card.label : 'மூடிய அட்டை, திருப்பத் தொடுங்கள் · Face-down card'}
          />
        )
      })}
    </CardGrid>
  )
}
