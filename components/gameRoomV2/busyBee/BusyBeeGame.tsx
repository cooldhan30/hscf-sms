'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { KidsChoiceGame, FitLabel, LABEL_SIZE, type StageProps } from '@/components/gameRoomV2/kids'
import { labelSizeStep, KID_COLORS, type ChoiceOption } from '@/lib/gameRoomV2/kids'

// Busy Bee (சுறுசுறுப்புத் தேனீ) -- Little Learners, ages 4-9. Each answer
// sits in the middle of a flower; a friendly bee buzzes about. Tap the
// right flower and the bee flies to it for nectar -- the honey pot fills
// with every right answer. A wrong flower droops and the right one glows.
// No timer, no lives; grading stays on the server.

const GARDEN = 'bg-gradient-to-b from-sky-200 via-emerald-50 to-lime-100'

export function BusyBeeGame(props: { sessionId: string; onExit: () => void; onPlayAgain?: () => void; onHome?: () => void }) {
  return (
    <KidsChoiceGame
      {...props}
      background={GARDEN}
      resultBackground="bg-gradient-to-b from-sky-200 to-lime-100"
      scenery={() => <Meadow />}
      startArt={
        <div className="flex items-end gap-2">
          <Flower petal={KID_COLORS[0][0]} className="w-20" />
          <Bee className="w-14 -translate-y-6" />
          <Flower petal={KID_COLORS[4][0]} className="w-16" />
        </div>
      }
      titleTa="சுறுசுறுப்புத் தேனீ!"
      titleEn="Busy Bee"
      howTa="சரியான விடையுள்ள பூவைத் தொடு - தேனீ தேன் எடுக்கும்!"
      howEn="Tap the flower with the right answer and the bee collects its honey!"
      loadingLabel="தேனீ பறந்து வருகிறது... · The bee is flying in..."
      resultLine={(n) => `தேனீ ${n} பூக்களிலிருந்து தேன் எடுத்தது · The bee collected honey from ${n} flowers`}
      gridLabel="பூக்கள் · Flowers"
      targetWidth="clamp(120px, 19vw, 210px)"
      phoneTargetWidth="42vw"
      renderTarget={(o, i, state) => <FlowerTarget o={o} i={i} state={state} />}
      stage={(p) => <BeeAndHoney {...p} />}
      stagePosition="above"
    />
  )
}

function FlowerTarget({ o, i, state }: { o: ChoiceOption; i: number; state: string }) {
  const petal = KID_COLORS[(i + 4) % KID_COLORS.length][0]
  return (
    <span className={`relative block origin-bottom transition-transform duration-500 ${state === 'wrong' ? 'rotate-[14deg] translate-y-2' : ''}`}>
      <Flower petal={petal} className={`w-full ${state === 'reveal' || state === 'chosen' ? 'drop-shadow-[0_0_18px_rgba(250,204,21,0.95)]' : 'drop-shadow-[0_6px_4px_rgba(15,23,42,0.2)]'}`} />
      {/* the flower's middle holds the answer */}
      <span className="absolute left-[27%] right-[27%] top-[18%] aspect-square rounded-full bg-yellow-200 border-4 border-amber-400 flex items-center justify-center">
        {o.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- question-set image, arbitrary Storage URL
          <img src={o.imageUrl} alt={o.label} className="w-[88%] h-[88%] object-cover rounded-full" draggable={false} />
        ) : (
          <span className="w-[84%] h-[70%]">
            <FitLabel className={`font-tamil font-extrabold text-amber-950 leading-tight ${LABEL_SIZE[labelSizeStep(o.label)]}`}>{o.label}</FitLabel>
          </span>
        )}
      </span>
    </span>
  )
}

// The bee hovers above the flowers; on a right answer it flies to the flower
// that was tapped. The honey pot fills a little with every right answer.
function BeeAndHoney({ stars, total, feedback, targetRect, reduced }: StageProps) {
  const beeRef = useRef<HTMLDivElement>(null)
  const [to, setTo] = useState<{ dx: number; dy: number } | null>(null)
  useLayoutEffect(() => {
    if (feedback?.kind !== 'correct' || !targetRect || !beeRef.current) {
      setTo(null)
      return
    }
    const b = beeRef.current.getBoundingClientRect()
    setTo({ dx: targetRect.left + targetRect.width / 2 - (b.left + b.width / 2), dy: targetRect.top + targetRect.height * 0.2 - (b.top + b.height / 2) })
  }, [feedback, targetRect])
  const fill = Math.min(1, stars / Math.max(1, total))

  return (
    <div className="relative w-full max-w-3xl flex items-center justify-between px-2" aria-hidden>
      <div
        ref={beeRef}
        className={`relative z-30 w-[clamp(56px,9vw,90px)] ${to ? '' : reduced ? '' : 'animate-[bee-buzz_3.2s_ease-in-out_infinite]'}`}
        style={{
          transform: to ? `translate(${to.dx}px, ${to.dy}px)` : undefined,
          transition: to ? 'transform 700ms cubic-bezier(.3,.7,.4,1)' : undefined,
        }}
      >
        <Bee className="w-full" />
      </div>
      {/* honey pot */}
      <div className="relative w-[clamp(56px,9vw,84px)]">
        <svg viewBox="0 0 80 90" className="w-full">
          <defs>
            <clipPath id="honey-pot">
              <path d="M12 26 H68 C 76 40, 78 70, 64 84 H16 C 2 70, 4 40, 12 26 Z" />
            </clipPath>
          </defs>
          <path d="M12 26 H68 C 76 40, 78 70, 64 84 H16 C 2 70, 4 40, 12 26 Z" fill="#fef3c7" stroke="#b45309" strokeWidth="4" />
          <rect x="0" y={84 - 58 * fill} width="80" height="90" fill="#f59e0b" clipPath="url(#honey-pot)" className="transition-all duration-700" />
          <rect x="8" y="14" width="64" height="14" rx="5" fill="#b45309" />
          <text x="40" y="62" textAnchor="middle" fontSize="16" fontWeight="800" fill="#78350f">
            தேன்
          </text>
        </svg>
      </div>
      <style>{`@keyframes bee-buzz { 0%,100% { transform: translate(0,0) rotate(-4deg) } 25% { transform: translate(18vw,-8px) rotate(6deg) } 50% { transform: translate(34vw,6px) rotate(-6deg) } 75% { transform: translate(12vw,10px) rotate(4deg) } }`}</style>
    </div>
  )
}

function Bee({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 80" className={className}>
      {/* wings */}
      <ellipse cx="40" cy="18" rx="16" ry="12" fill="#e0f2fe" opacity="0.9" stroke="#7dd3fc" strokeWidth="2" />
      <ellipse cx="60" cy="16" rx="16" ry="12" fill="#e0f2fe" opacity="0.9" stroke="#7dd3fc" strokeWidth="2" />
      {/* body */}
      <ellipse cx="50" cy="46" rx="32" ry="24" fill="#facc15" />
      <path d="M36 25 Q 30 46 36 68" stroke="#1e293b" strokeWidth="7" fill="none" />
      <path d="M52 22 Q 46 46 52 70" stroke="#1e293b" strokeWidth="7" fill="none" />
      {/* face */}
      <circle cx="74" cy="40" r="4" fill="#1e293b" />
      <path d="M68 52 Q 74 57 80 50" stroke="#1e293b" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M78 26 Q 84 14 90 12" stroke="#1e293b" strokeWidth="2.5" fill="none" />
      {/* stinger */}
      <path d="M18 46 L6 46" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

function Flower({ petal, className }: { petal: string; className?: string }) {
  const petals = [0, 45, 90, 135, 180, 225, 270, 315]
  return (
    <svg viewBox="0 0 120 158" className={className}>
      {/* stem and leaves */}
      <path d="M60 78 Q 58 118 62 158" stroke="#16a34a" strokeWidth="7" fill="none" />
      <path d="M61 126 Q 86 112 96 124 Q 80 136 61 130 Z" fill="#22c55e" />
      <path d="M59 138 Q 34 126 24 138 Q 40 148 59 142 Z" fill="#22c55e" />
      {/* petals */}
      <g transform="translate(60 52)">
        {petals.map((a) => (
          <ellipse key={a} cx="0" cy="-28" rx="14" ry="22" fill={petal} transform={`rotate(${a})`} />
        ))}
      </g>
    </svg>
  )
}

function Meadow() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      <div className="absolute right-[6%] top-[16%] w-20 h-20 rounded-full bg-yellow-300 shadow-[0_0_50px_18px_rgba(253,224,71,0.5)]" />
      <svg className="absolute inset-x-0 bottom-0 w-full h-[16vh] min-h-[80px]" viewBox="0 0 1200 120" preserveAspectRatio="none">
        <path d="M0 50 C 200 20, 400 30, 600 45 C 800 60, 1000 25, 1200 40 L1200 120 L0 120 Z" fill="#a3e635" />
        <path d="M0 80 C 250 60, 450 70, 700 80 C 900 90, 1050 66, 1200 74 L1200 120 L0 120 Z" fill="#65a30d" />
      </svg>
    </div>
  )
}
