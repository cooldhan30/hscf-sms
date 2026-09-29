'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { KidsChoiceGame, FitLabel, LABEL_SIZE, type StageProps } from '@/components/gameRoomV2/kids'
import { labelSizeStep, type ChoiceOption } from '@/lib/gameRoomV2/kids'

// Frog Jump (தவளைத் தாவல்) -- Little Learners, ages 4-9. The answers float
// on lily pads; a frog waits on a log. Tap the right pad and the frog
// leaps onto it; a wrong pad makes the frog shake its head and the right
// pad glows. No timer, no lives; grading stays on the server.

const WATER = 'bg-gradient-to-b from-sky-200 via-teal-200 to-teal-400'

export function FrogJumpGame(props: { sessionId: string; onExit: () => void; onPlayAgain?: () => void; onHome?: () => void }) {
  return (
    <KidsChoiceGame
      {...props}
      background={WATER}
      resultBackground="bg-gradient-to-b from-sky-200 to-teal-200"
      scenery={(reduced) => <Pond reduced={reduced} />}
      startArt={
        <div className="flex items-end gap-2">
          <LilyPad className="w-20" />
          <Frog className="w-16" />
        </div>
      }
      titleTa="தவளைத் தாவல்!"
      titleEn="Frog Jump"
      howTa="சரியான விடையுள்ள இலையைத் தொடு - தவளை தாவும்!"
      howEn="Tap the lily pad with the right answer and the frog jumps on!"
      loadingLabel="தவளை தயாராகிறது... · The frog is getting ready..."
      resultLine={(n) => `தவளை ${n} முறை சரியாகத் தாவியது · The frog made ${n} right jumps`}
      gridLabel="அல்லி இலைகள் · Lily pads"
      targetWidth="clamp(120px, 19vw, 210px)"
      phoneTargetWidth="42vw"
      renderTarget={(o, i, state) => <PadTarget o={o} i={i} glow={state === 'reveal' || state === 'chosen'} />}
      stage={(p) => <FrogOnLog {...p} />}
      stagePosition="below"
    />
  )
}

function PadTarget({ o, i, glow }: { o: ChoiceOption; i: number; glow: boolean }) {
  return (
    <span className="relative block">
      <LilyPad className={`w-full ${glow ? 'drop-shadow-[0_0_18px_rgba(250,204,21,0.95)]' : 'drop-shadow-[0_6px_4px_rgba(15,23,42,0.25)]'}`} flower={i % 2 === 0} />
      <span className="absolute left-[20%] right-[20%] top-[26%] h-[48%] rounded-full bg-white/90 flex items-center justify-center px-1">
        {o.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- question-set image, arbitrary Storage URL
          <img src={o.imageUrl} alt={o.label} className="h-[92%] aspect-square object-cover rounded-full" draggable={false} />
        ) : (
          <FitLabel className={`font-tamil font-extrabold text-emerald-900 leading-tight ${LABEL_SIZE[labelSizeStep(o.label)]}`}>{o.label}</FitLabel>
        )}
      </span>
    </span>
  )
}

// The frog on its log. On a right answer it leaps (in an arc) to the pad
// that was tapped; on a wrong one it shakes its head.
function FrogOnLog({ feedback, targetRect, reduced }: StageProps) {
  const frogRef = useRef<HTMLDivElement>(null)
  const [jump, setJump] = useState<{ dx: number; dy: number } | null>(null)
  useLayoutEffect(() => {
    if (feedback?.kind !== 'correct' || !targetRect || !frogRef.current) {
      setJump(null)
      return
    }
    const f = frogRef.current.getBoundingClientRect()
    // Land on the pad's top edge, so the letter it carries stays visible
    setJump({ dx: targetRect.left + targetRect.width / 2 - (f.left + f.width / 2), dy: targetRect.top - f.height * 0.2 - (f.top + f.height / 2) })
  }, [feedback, targetRect])

  return (
    <div className="relative flex flex-col items-center" aria-hidden>
      <div
        ref={frogRef}
        className={`relative z-30 w-[clamp(64px,12vw,110px)] ${feedback?.kind === 'wrong' && !reduced ? 'animate-[kid-wobble_0.45s_ease-in-out_3]' : ''} ${
          jump && !reduced ? 'animate-[frog-leap_0.7s_cubic-bezier(.3,.7,.4,1)_forwards]' : ''
        }`}
        style={jump ? ({ '--dx': `${jump.dx}px`, '--dy': `${jump.dy}px` } as React.CSSProperties) : undefined}
      >
        <Frog className="w-full" happy={feedback?.kind === 'correct'} />
      </div>
      {/* the log */}
      <div className="-mt-3 w-[clamp(110px,20vw,190px)] h-6 rounded-full bg-gradient-to-b from-amber-600 to-amber-800 border-2 border-amber-900/60" />
      <style>{`
        @keyframes frog-leap {
          0% { transform: translate(0, 0) }
          50% { transform: translate(calc(var(--dx) * 0.5), calc(var(--dy) * 0.5 - 90px)) scale(1.1) }
          100% { transform: translate(var(--dx), var(--dy)) }
        }
      `}</style>
    </div>
  )
}

function Frog({ className, happy = false }: { className?: string; happy?: boolean }) {
  return (
    <svg viewBox="0 0 120 100" className={className}>
      {/* legs */}
      <ellipse cx="22" cy="80" rx="18" ry="10" fill="#15803d" />
      <ellipse cx="98" cy="80" rx="18" ry="10" fill="#15803d" />
      {/* body */}
      <ellipse cx="60" cy="64" rx="42" ry="30" fill="#22c55e" />
      <ellipse cx="60" cy="72" rx="26" ry="16" fill="#bbf7d0" />
      {/* eyes */}
      <circle cx="38" cy="30" r="15" fill="#22c55e" />
      <circle cx="82" cy="30" r="15" fill="#22c55e" />
      <circle cx="38" cy="28" r="9" fill="#ffffff" />
      <circle cx="82" cy="28" r="9" fill="#ffffff" />
      <circle cx="40" cy="29" r="4.5" fill="#1e293b" />
      <circle cx="84" cy="29" r="4.5" fill="#1e293b" />
      <circle cx="34" cy="56" r="5" fill="#fda4af" opacity="0.7" />
      <circle cx="86" cy="56" r="5" fill="#fda4af" opacity="0.7" />
      <path d={happy ? 'M42 54 Q 60 72 78 54' : 'M44 56 Q 60 66 76 56'} stroke="#14532d" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function LilyPad({ className, flower = false }: { className?: string; flower?: boolean }) {
  return (
    <svg viewBox="0 0 160 110" className={className}>
      <path d="M80 55 L150 38 C 160 70, 130 104, 80 104 C 30 104, 2 80, 4 55 C 6 22, 40 6, 80 6 C 112 6, 140 18, 150 38 Z" fill="#16a34a" />
      <path d="M80 55 L150 38 C 140 18, 112 6, 80 6 C 40 6, 6 22, 4 55 C 20 40, 50 30, 80 55 Z" fill="#22c55e" opacity="0.6" />
      <path d="M80 55 L 30 90 M80 55 L 60 100 M80 55 L 110 96 M80 55 L 130 78" stroke="#15803d" strokeWidth="2" opacity="0.6" />
      {flower && (
        <g transform="translate(128 20)">
          <circle r="7" cx="0" cy="-6" fill="#f9a8d4" />
          <circle r="7" cx="-6" cy="2" fill="#f472b6" />
          <circle r="7" cx="6" cy="2" fill="#f472b6" />
          <circle r="4" cx="0" cy="0" fill="#fde047" />
        </g>
      )}
    </svg>
  )
}

function Pond({ reduced }: { reduced: boolean }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      <div className="absolute inset-x-0 top-0 h-[26%] bg-gradient-to-b from-sky-200 to-transparent" />
      {/* ripples */}
      {[
        ['12%', '40%'],
        ['70%', '52%'],
        ['38%', '78%'],
        ['86%', '84%'],
      ].map(([left, top], i) => (
        <span
          key={i}
          className={`absolute w-24 h-8 rounded-[50%] border-2 border-white/50 ${reduced ? '' : 'animate-[ripple_4s_ease-out_infinite]'}`}
          style={{ left, top, animationDelay: `${-i}s` }}
        />
      ))}
      {/* reeds */}
      <svg className="absolute left-0 bottom-0 h-[30vh] w-24" viewBox="0 0 60 200" preserveAspectRatio="none">
        {[10, 26, 42].map((x, i) => (
          <path key={i} d={`M${x} 200 Q ${x - 8} 100 ${x + 4} ${20 + i * 18}`} stroke="#15803d" strokeWidth="6" fill="none" strokeLinecap="round" />
        ))}
      </svg>
      <style>{`@keyframes ripple { 0% { transform: scale(.6); opacity: .9 } 100% { transform: scale(1.6); opacity: 0 } }`}</style>
    </div>
  )
}
