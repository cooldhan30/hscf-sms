'use client'

import { CardGrid, FlipCard, type CardVisualState } from '@/components/gameRoomV2/cardGrid'
import type { MatchingRoundState } from '@/lib/gameRoomV2/matching'

// The Matching board -- every card is always face-up (nothing to
// remember here, unlike Memory), using the shared CardGrid/FlipCard
// primitives with `faceUp` permanently true. Clear relationship
// feedback: a wrong attempt briefly rings BOTH tapped cards red before
// clearing, a correct attempt rings them green and locks them in as
// matched -- the concrete "clear relationship feedback" requirement.
// Every card is a real <button>, so a mouse click, a touch tap, and a
// keyboard Tab+Enter all activate it identically -- there is no
// drag/drop-only path.
export function MatchingBoard({ round, disabled, onSelect }: { round: MatchingRoundState; disabled: boolean; onSelect: (cardId: string) => void }) {
  return (
    <CardGrid cardCount={round.cards.length}>
      {round.cards.map((card) => {
        const isMatched = round.matchedPairIds.includes(card.pairId)
        const isSelected = round.selectedCardId === card.id
        const isLastAttemptCard = round.lastAttempt?.cardIds.includes(card.id) ?? false

        let state: CardVisualState = 'revealed'
        if (isMatched) state = 'matched'
        else if (isLastAttemptCard) state = round.lastAttempt!.correct ? 'matched' : 'mismatched'
        else if (isSelected) state = 'selected'

        return (
          <FlipCard
            key={card.id}
            label={card.label}
            faceUp
            state={state}
            disabled={disabled || isMatched}
            onActivate={() => onSelect(card.id)}
            ariaLabel={isMatched ? `${card.label}, matched` : card.label}
          />
        )
      })}
    </CardGrid>
  )
}
