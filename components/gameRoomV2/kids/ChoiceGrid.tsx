'use client'

import type { ReactNode } from 'react'
import { isRevealedAnswer, type ChoiceOption } from '@/lib/gameRoomV2/kids'
import { HereItIs, KidKeyframes, useNarrow } from './KidsUI'
import type { KidsFeedback } from './useKidsGame'

// The answer targets for the "tap the right one" scenes that don't fly
// around (Frog Jump's lily pads, Busy Bee's flowers, Dinosaur Egg's eggs,
// Ice Cream Shop's scoops, ...): laid out in one row on wide screens and
// 2 x 2 on phones, gently bobbing. Handles the tap, the wrong-answer
// wobble and the "here it is" reveal; each game draws its own target.

export type TargetState = 'idle' | 'chosen' | 'wrong' | 'reveal'

export function ChoiceGrid({
  options,
  feedback,
  disabled,
  reduced,
  onPick,
  renderTarget,
  width = 'clamp(110px, 20vw, 200px)',
  phoneWidth = '40vw',
  label,
  bob = true,
}: {
  options: ChoiceOption[]
  feedback: KidsFeedback
  disabled: boolean
  reduced: boolean
  onPick: (o: ChoiceOption, el: HTMLElement) => void
  renderTarget: (o: ChoiceOption, i: number, state: TargetState) => ReactNode
  width?: string
  phoneWidth?: string
  label: string
  bob?: boolean
}) {
  const narrow = useNarrow()
  const revealKey = feedback?.kind === 'wrong' ? (options.find((o) => isRevealedAnswer(o, feedback.revealed))?.key ?? null) : null
  const cols = narrow && options.length > 2 ? 2 : options.length

  return (
    <div
      className="grid justify-center justify-items-center items-end gap-x-3 gap-y-8 sm:gap-x-6"
      style={{ gridTemplateColumns: `repeat(${cols}, auto)` }}
      role="group"
      aria-label={label}
    >
      {options.map((o, i) => {
        const state: TargetState =
          feedback?.kind === 'correct' && feedback.key === o.key
            ? 'chosen'
            : feedback?.kind === 'wrong' && feedback.key === o.key
              ? 'wrong'
              : revealKey === o.key
                ? 'reveal'
                : 'idle'
        return (
          <button
            key={o.key}
            type="button"
            data-kids-choice
            disabled={disabled}
            onClick={(e) => onPick(o, e.currentTarget)}
            aria-label={o.label || `விருப்பம் ${i + 1} · Option ${i + 1}`}
            className={`relative focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white rounded-3xl ${state === 'reveal' ? 'z-20' : ''}`}
            style={{ width: narrow ? phoneWidth : width }}
          >
            <span
              className={`block transition-[transform,opacity] duration-300 ${state === 'wrong' ? 'opacity-45 animate-[kid-wobble_0.5s_ease-in-out_2]' : ''} ${
                state === 'reveal' && !reduced ? 'animate-[kid-bounce_0.7s_ease-in-out_infinite]' : ''
              } ${state === 'idle' && bob && !reduced ? 'animate-[kid-bob_3s_ease-in-out_infinite]' : ''}`}
              style={{ animationDelay: state === 'idle' ? `${-i * 0.7}s` : undefined }}
            >
              {renderTarget(o, i, state)}
            </span>
            {state === 'reveal' && <HereItIs />}
          </button>
        )
      })}
      <KidKeyframes />
      <style>{`@keyframes kid-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }`}</style>
    </div>
  )
}
