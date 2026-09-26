'use client'

import { FlipCard, type CardVisualState } from '@/components/gameRoomV2/cardGrid'
import type { MatchingRoundState } from '@/lib/gameRoomV2/matching'

// The Matching board: the question's two sides as two columns of
// face-up cards. A claimed pair shows as selected while the server
// checks it, then rings green (locked in) or red (flashes, then clears).
// Every card is a real <button>: mouse, touch and keyboard all work.
export function MatchingBoard({ round, disabled, onSelect }: { round: MatchingRoundState; disabled: boolean; onSelect: (cardId: string) => void }) {
  const column = (side: 'left' | 'right') => (
    <div className="grid gap-2 sm:gap-3 content-start">
      {round.cards
        .filter((c) => c.side === side)
        .map((card) => {
          const isMatched = round.matchedCardIds.includes(card.id)
          const isPending = round.pending?.leftId === card.id || round.pending?.rightId === card.id
          const isLastAttemptCard = round.lastAttempt?.cardIds.includes(card.id) ?? false
          let state: CardVisualState = 'revealed'
          if (isMatched) state = 'matched'
          else if (isLastAttemptCard) state = round.lastAttempt!.correct ? 'matched' : 'mismatched'
          else if (isPending || round.selectedCardId === card.id) state = 'selected'
          return (
            <FlipCard
              key={card.id}
              label={card.label}
              faceUp
              state={state}
              disabled={disabled || isMatched || !!round.pending}
              onActivate={() => onSelect(card.id)}
              ariaLabel={isMatched ? `${card.label}, matched` : card.label}
            />
          )
        })}
    </div>
  )
  return (
    <div className="w-full max-w-2xl mx-auto grid grid-cols-2 gap-4 sm:gap-8">
      {column('left')}
      {column('right')}
    </div>
  )
}
