'use client'

import { KidsChoiceGame, FitLabel, LABEL_SIZE, type StageProps } from '@/components/gameRoomV2/kids'
import { labelSizeStep, type ChoiceOption } from '@/lib/gameRoomV2/kids'

// Ice Cream Shop (ஐஸ்கிரீம் கடை) -- Little Learners, ages 4-7 especially.
// The answers are scoops in the shop's tubs. Tap the right scoop and it
// lands on the child's cone -- the cone grows taller with every right
// answer. A wrong scoop wobbles and the right one glows. No timer, no
// lives; grading stays on the server.

const SHOP = 'bg-gradient-to-b from-pink-100 via-rose-50 to-sky-100'
// Flavours: scoop colour, darker drip
const FLAVOURS: [string, string][] = [
  ['#f9a8d4', '#ec4899'], // strawberry
  ['#fde68a', '#f59e0b'], // mango
  ['#a7f3d0', '#10b981'], // pista
  ['#c4b5fd', '#8b5cf6'], // blueberry
  ['#fdba74', '#ea580c'], // orange
  ['#d6d3d1', '#78716c'], // vanilla-choc
]

export function IceCreamShopGame(props: { sessionId: string; onExit: () => void; onPlayAgain?: () => void; onHome?: () => void }) {
  return (
    <KidsChoiceGame
      {...props}
      background={SHOP}
      resultBackground="bg-gradient-to-b from-pink-100 to-sky-100"
      scenery={() => <Awning />}
      startArt={<Cone scoops={[0, 1, 2]} className="w-20" />}
      titleTa="ஐஸ்கிரீம் கடை!"
      titleEn="Ice Cream Shop"
      howTa="சரியான விடையுள்ள ஐஸ்கிரீமைத் தொடு - உன் கோன் உயரும்!"
      howEn="Tap the scoop with the right answer to add it to your cone!"
      loadingLabel="கடை திறக்கிறது... · The shop is opening..."
      resultLine={(n) => `உன் கோனில் ${n} ஐஸ்கிரீம்கள்! · ${n} scoops on your cone!`}
      gridLabel="ஐஸ்கிரீம்கள் · Ice cream scoops"
      targetWidth="clamp(110px, 17vw, 180px)"
      phoneTargetWidth="38vw"
      bob={false}
      renderTarget={(o, i, state) => <ScoopTarget o={o} i={i} state={state} />}
      stage={(p) => <MyCone {...p} />}
      stagePosition="below"
    />
  )
}

function ScoopTarget({ o, i, state }: { o: ChoiceOption; i: number; state: string }) {
  const [fill, drip] = FLAVOURS[i % FLAVOURS.length]
  const picked = state === 'chosen'
  return (
    <span className="relative block">
      {/* the scoop (flies up and away when picked) */}
      <span className={`relative block transition-all duration-500 ${picked ? '-translate-y-10 scale-75 opacity-0' : ''}`}>
        <svg
          viewBox="0 0 120 90"
          className={`w-full ${state === 'reveal' ? 'drop-shadow-[0_0_18px_rgba(250,204,21,0.95)]' : 'drop-shadow-[0_5px_3px_rgba(15,23,42,0.2)]'}`}
          aria-hidden
        >
          <path d="M10 70 C 4 30, 36 6, 60 6 C 84 6, 116 30, 110 70 Z" fill={fill} />
          <path d="M10 70 Q 22 84 34 70 Q 46 86 58 70 Q 72 86 84 70 Q 98 84 110 70 Z" fill={drip} opacity="0.8" />
          <ellipse cx="40" cy="26" rx="10" ry="6" fill="#ffffff" opacity="0.55" transform="rotate(-20 40 26)" />
        </svg>
        <span className="absolute left-[18%] right-[18%] top-[16%] h-[52%] rounded-full bg-white/85 flex items-center justify-center px-1">
          {o.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- question-set image, arbitrary Storage URL
            <img src={o.imageUrl} alt={o.label} className="h-[92%] aspect-square object-cover rounded-full" draggable={false} />
          ) : (
            <FitLabel className={`font-tamil font-extrabold text-rose-950 leading-tight ${LABEL_SIZE[labelSizeStep(o.label)]}`}>{o.label}</FitLabel>
          )}
        </span>
      </span>
      {/* the tub it sits in */}
      <span className="block -mt-2 mx-[6%] h-[clamp(22px,4vw,34px)] rounded-b-2xl rounded-t-md bg-gradient-to-b from-sky-300 to-sky-500 border-2 border-sky-600/50" aria-hidden />
    </span>
  )
}

// The child's cone: one scoop per right answer, newest on top
function MyCone({ stars, feedback }: StageProps) {
  const scoops = Array.from({ length: Math.min(stars, 6) }, (_, i) => (stars - Math.min(stars, 6) + i) % FLAVOURS.length)
  return (
    <div className="flex items-end gap-3" aria-label={`${stars} ஐஸ்கிரீம்கள் · scoops`}>
      <Cone scoops={scoops} className={`w-[clamp(84px,13vw,120px)] ${feedback?.kind === 'correct' ? 'animate-[kid-bounce_0.5s_ease-in-out_2]' : ''}`} />
      {stars > 6 && <span className="font-extrabold text-rose-700 text-xl mb-4">+{stars - 6}</span>}
      {stars === 0 && <span className="text-sm font-semibold text-rose-800/70 font-tamil mb-6">உன் கோன் · Your cone</span>}
    </div>
  )
}

function Cone({ scoops, className }: { scoops: number[]; className?: string }) {
  // Each scoop is 30 units tall and overlaps the one below
  const height = 90 + scoops.length * 26
  return (
    <svg viewBox={`0 0 80 ${height}`} className={className}>
      {scoops.map((f, i) => {
        const y = height - 90 - i * 26
        const [fill, drip] = FLAVOURS[f % FLAVOURS.length]
        return (
          <g key={i}>
            <circle cx="40" cy={y + 8} r="24" fill={fill} />
            <path d={`M16 ${y + 12} Q 24 ${y + 24} 32 ${y + 14} Q 40 ${y + 26} 48 ${y + 14} Q 56 ${y + 24} 64 ${y + 12}`} fill={drip} opacity="0.7" />
          </g>
        )
      })}
      {/* the cone */}
      <path d={`M14 ${height - 88} L66 ${height - 88} L40 ${height - 2} Z`} fill="#f59e0b" />
      <path d={`M20 ${height - 76} L60 ${height - 60} M24 ${height - 56} L54 ${height - 44} M28 ${height - 36} L48 ${height - 28}`} stroke="#b45309" strokeWidth="2.5" />
      <path d={`M60 ${height - 76} L20 ${height - 60} M56 ${height - 56} L26 ${height - 44}`} stroke="#b45309" strokeWidth="2.5" />
    </svg>
  )
}

function Awning() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {/* striped shop awning along the top edge, under the top bar */}
      <div className="absolute inset-x-0 top-0 h-[64px] bg-[repeating-linear-gradient(90deg,#f472b6_0_40px,#ffffff_40px_80px)] opacity-80" />
      <div className="absolute inset-x-0 top-[64px] h-5 bg-[radial-gradient(circle_at_20px_0,#f472b6_18px,transparent_19px)] [background-size:40px_20px] opacity-80" />
      {/* counter */}
      <div className="absolute inset-x-0 bottom-0 h-[10vh] bg-gradient-to-b from-amber-200 to-amber-300 border-t-4 border-amber-400" />
    </div>
  )
}
