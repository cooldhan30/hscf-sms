'use client'

import { KidsChoiceGame, FitLabel, LABEL_SIZE, type StageProps } from '@/components/gameRoomV2/kids'
import { labelSizeStep, type ChoiceOption } from '@/lib/gameRoomV2/kids'

// Treasure Hunt (புதையல் வேட்டை) -- Little Learners, ages 4-9, made for
// longer sets (10-20 questions). A treasure map with a dotted trail: every
// question moves the explorer one step closer to the chest, and every
// right answer collects a sparkling gem (the answers are on the gems).
// The chest opens at the end. No timer, no lives; grading on the server.

const SAND = 'bg-gradient-to-b from-sky-200 via-amber-100 to-amber-200'
const GEMS: [string, string][] = [
  ['#f43f5e', '#9f1239'],
  ['#3b82f6', '#1e3a8a'],
  ['#22c55e', '#14532d'],
  ['#a855f7', '#581c87'],
  ['#f59e0b', '#78350f'],
  ['#06b6d4', '#164e63'],
]

export function TreasureHuntGame(props: { sessionId: string; onExit: () => void; onPlayAgain?: () => void; onHome?: () => void }) {
  return (
    <KidsChoiceGame
      {...props}
      background={SAND}
      resultBackground="bg-gradient-to-b from-sky-200 to-amber-200"
      scenery={() => <Beach />}
      startArt={
        <div className="flex items-end gap-2">
          <Gem className="w-12" c={GEMS[0]} />
          <Chest className="w-24" open />
          <Gem className="w-12" c={GEMS[1]} />
        </div>
      }
      titleTa="புதையல் வேட்டை!"
      titleEn="Treasure Hunt"
      howTa="சரியான விடையுள்ள மணியைத் தொடு - புதையலை நோக்கிச் செல்!"
      howEn="Tap the gem with the right answer and walk to the treasure!"
      loadingLabel="வரைபடம் விரிகிறது... · Opening the treasure map..."
      resultLine={(n) => `${n} மணிகளைச் சேகரித்தாய் - புதையல் உன்னுடையது! · You collected ${n} gems -- the treasure is yours!`}
      gridLabel="மணிகள் · Gems"
      targetWidth="clamp(110px, 16vw, 170px)"
      phoneTargetWidth="38vw"
      renderTarget={(o, i, state) => <GemTarget o={o} i={i} state={state} />}
      stage={(p) => <TreasureMap {...p} />}
      stagePosition="above"
    />
  )
}

function GemTarget({ o, i, state }: { o: ChoiceOption; i: number; state: string }) {
  return (
    <span className={`relative block transition-all duration-500 ${state === 'chosen' ? '-translate-y-6 scale-90 opacity-0' : ''}`}>
      <Gem className={`w-full ${state === 'reveal' ? 'drop-shadow-[0_0_18px_rgba(250,204,21,0.95)]' : 'drop-shadow-[0_6px_4px_rgba(15,23,42,0.25)]'}`} c={GEMS[i % GEMS.length]} />
      <span className="absolute left-[22%] right-[22%] top-[30%] h-[42%] rounded-xl bg-white/90 flex items-center justify-center px-1">
        {o.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- question-set image, arbitrary Storage URL
          <img src={o.imageUrl} alt={o.label} className="h-[92%] aspect-square object-cover rounded-lg" draggable={false} />
        ) : (
          <FitLabel className={`font-tamil font-extrabold text-slate-800 leading-tight ${LABEL_SIZE[labelSizeStep(o.label)]}`}>{o.label}</FitLabel>
        )}
      </span>
    </span>
  )
}

// The map: a dotted trail with one step per question, the explorer on the
// current step, the chest at the end, and the gems collected so far.
function TreasureMap({ stars, index, total, feedback, reduced }: StageProps) {
  const steps = Math.max(2, total)
  // After an answer the explorer walks on to the next step
  const at = Math.min(steps, index + (feedback ? 1 : 0))
  const done = at >= steps
  const pos = (s: number) => {
    const f = s / steps
    // a gentle S-shaped trail across the map
    return { x: 6 + f * 80, y: 50 + Math.sin(f * Math.PI * 2) * 26 }
  }
  const me = pos(at)

  return (
    <div className="relative w-[min(94vw,760px)] h-[clamp(96px,18vh,150px)] rounded-3xl border-4 border-amber-700/60 bg-[#fde8b8] shadow-inner overflow-hidden" aria-label={`படி ${at} / ${steps} · ${stars} மணிகள்`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden>
        <path
          d={Array.from({ length: 41 }, (_, k) => {
            const p = pos((k / 40) * steps)
            return `${k === 0 ? 'M' : 'L'}${p.x} ${p.y}`
          }).join(' ')}
          stroke="#b45309"
          strokeWidth="1.4"
          strokeDasharray="2 2.4"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* palm tree at the start, the chest (X) at the end */}
      <span className="absolute left-[1%] top-[10%] text-3xl" aria-hidden>
        🌴
      </span>
      <span className="absolute right-[1%] top-1/2 -translate-y-1/2 w-[clamp(44px,8vw,72px)]" aria-hidden>
        <Chest className="w-full" open={done} />
      </span>
      {/* the explorer */}
      <span
        className={`absolute text-3xl sm:text-4xl -translate-x-1/2 -translate-y-1/2 ${reduced ? '' : 'transition-all duration-700'}`}
        style={{ left: `${me.x}%`, top: `${me.y}%` }}
        aria-hidden
      >
        🧒
      </span>
      {/* gems collected */}
      <span className="absolute left-2 bottom-1 flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-sm font-extrabold text-amber-800" aria-hidden>
        💎 {stars}
      </span>
    </div>
  )
}

function Gem({ className, c }: { className?: string; c: [string, string] }) {
  return (
    <svg viewBox="0 0 100 90" className={className}>
      <path d="M20 6 H80 L98 32 L50 88 L2 32 Z" fill={c[0]} />
      <path d="M2 32 H98 L50 88 Z" fill={c[1]} opacity="0.45" />
      <path d="M20 6 L34 32 L50 6 L66 32 L80 6" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.6" />
      <path d="M26 14 L34 12" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
    </svg>
  )
}

function Chest({ className, open = false }: { className?: string; open?: boolean }) {
  return (
    <svg viewBox="0 0 120 100" className={className}>
      {open && (
        <g>
          <circle cx="44" cy="44" r="10" fill="#facc15" />
          <circle cx="66" cy="40" r="10" fill="#fde047" />
          <circle cx="58" cy="50" r="10" fill="#eab308" />
          <path d="M30 30 L40 20 M90 30 L80 20 M60 14 V4" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
        </g>
      )}
      {/* lid */}
      {open ? <path d="M14 46 L24 18 H96 L106 46 Z" fill="#92400e" transform="rotate(-18 60 46)" /> : <path d="M14 50 C 14 26, 106 26, 106 50 Z" fill="#92400e" />}
      {/* box */}
      <rect x="14" y="50" width="92" height="44" rx="6" fill="#b45309" />
      <rect x="14" y="50" width="92" height="10" fill="#78350f" />
      <rect x="52" y="54" width="16" height="18" rx="3" fill="#facc15" />
    </svg>
  )
}

function Beach() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      <div className="absolute inset-x-0 top-0 h-[34%] bg-gradient-to-b from-sky-300 to-sky-100" />
      <svg className="absolute inset-x-0 top-[26%] w-full h-[10vh]" viewBox="0 0 1200 60" preserveAspectRatio="none">
        <path d="M0 30 Q 150 10 300 30 T 600 30 T 900 30 T 1200 30 V60 H0 Z" fill="#38bdf8" opacity="0.7" />
      </svg>
      <span className="absolute right-[6%] top-[10%] w-16 h-16 rounded-full bg-yellow-300 shadow-[0_0_40px_14px_rgba(253,224,71,0.5)]" />
      <span className="absolute left-[4%] bottom-[6%] text-5xl opacity-70">🐚</span>
      <span className="absolute right-[5%] bottom-[8%] text-5xl opacity-70">🦀</span>
    </div>
  )
}
