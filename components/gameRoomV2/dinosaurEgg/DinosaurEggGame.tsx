'use client'

import { KidsChoiceGame, FitLabel, LABEL_SIZE, type StageProps } from '@/components/gameRoomV2/kids'
import { labelSizeStep, KID_COLORS, type ChoiceOption } from '@/lib/gameRoomV2/kids'

// Dinosaur Egg (டைனோசர் முட்டை) -- Little Learners, ages 4-9. The answers
// are on speckled eggs in a nest. Tap the right egg and it cracks open --
// a baby dinosaur hatches and joins the row of hatched babies, which grows
// all game long (the reward loop). A wrong egg wobbles and the right one
// glows. No timer, no lives; grading stays on the server.

const JUNGLE = 'bg-gradient-to-b from-emerald-200 via-lime-100 to-amber-100'
// Baby dinosaur colours, one per hatch (cycled)
const DINO_COLORS = ['#22c55e', '#3b82f6', '#a855f7', '#f97316', '#ec4899', '#14b8a6']

export function DinosaurEggGame(props: { sessionId: string; onExit: () => void; onPlayAgain?: () => void; onHome?: () => void }) {
  return (
    <KidsChoiceGame
      {...props}
      background={JUNGLE}
      resultBackground="bg-gradient-to-b from-emerald-200 to-amber-100"
      scenery={() => <Jungle />}
      startArt={
        <div className="flex items-end gap-1">
          <Egg className="w-14" spots={KID_COLORS[1][0]} />
          <BabyDino className="w-20" color={DINO_COLORS[0]} />
          <Egg className="w-14" spots={KID_COLORS[4][0]} />
        </div>
      }
      titleTa="டைனோசர் முட்டை!"
      titleEn="Dinosaur Egg"
      howTa="சரியான விடையுள்ள முட்டையைத் தொடு - குட்டி டைனோசர் பிறக்கும்!"
      howEn="Tap the egg with the right answer to hatch a baby dinosaur!"
      loadingLabel="முட்டைகள் தயாராகின்றன... · The eggs are getting ready..."
      resultLine={(n) => `${n} குட்டி டைனோசர்கள் பிறந்தன! · You hatched ${n} baby dinosaurs!`}
      gridLabel="முட்டைகள் · Eggs"
      targetWidth="clamp(110px, 17vw, 180px)"
      phoneTargetWidth="38vw"
      feedbackMs={{ correct: 2000, wrong: 2600 }}
      renderTarget={(o, i, state) => <EggTarget o={o} i={i} state={state} />}
      stage={(p) => <Hatchery {...p} />}
      stagePosition="below"
    />
  )
}

function EggTarget({ o, i, state }: { o: ChoiceOption; i: number; state: string }) {
  const hatched = state === 'chosen'
  return (
    <span className="relative block">
      {hatched ? (
        // Cracked shell with the baby dinosaur popping out
        <span className="relative block">
          <BabyDino className="w-full animate-[kid-bounce_0.5s_ease-in-out_2]" color={DINO_COLORS[i % DINO_COLORS.length]} />
          <Shell className="absolute inset-x-0 bottom-0 w-full" spots={KID_COLORS[i % KID_COLORS.length][0]} />
        </span>
      ) : (
        <>
          <Egg
            className={`w-full ${state === 'reveal' ? 'drop-shadow-[0_0_18px_rgba(250,204,21,0.95)]' : 'drop-shadow-[0_6px_4px_rgba(15,23,42,0.25)]'}`}
            spots={KID_COLORS[i % KID_COLORS.length][0]}
          />
          <span className="absolute left-[18%] right-[18%] top-[34%] h-[36%] rounded-2xl bg-white/90 flex items-center justify-center px-1">
            {o.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- question-set image, arbitrary Storage URL
              <img src={o.imageUrl} alt={o.label} className="h-[90%] aspect-square object-cover rounded-xl" draggable={false} />
            ) : (
              <FitLabel className={`font-tamil font-extrabold text-slate-800 leading-tight ${LABEL_SIZE[labelSizeStep(o.label)]}`}>{o.label}</FitLabel>
            )}
          </span>
        </>
      )}
    </span>
  )
}

// The nest, and the row of babies hatched so far this game
function Hatchery({ stars }: StageProps) {
  const shown = Math.min(stars, 8)
  return (
    <div className="flex flex-col items-center gap-2" aria-label={`${stars} குட்டி டைனோசர்கள் · baby dinosaurs`}>
      <div className="flex items-end justify-center gap-1 min-h-[48px] flex-wrap max-w-[92vw]">
        {Array.from({ length: shown }, (_, i) => (
          <BabyDino key={i} className="w-12 sm:w-16" color={DINO_COLORS[i % DINO_COLORS.length]} />
        ))}
        {stars > shown && <span className="font-extrabold text-emerald-800 text-lg self-center">+{stars - shown}</span>}
        {stars === 0 && <span className="text-sm font-semibold text-emerald-800/70 font-tamil self-center">குட்டிகள் இங்கே வரும் · Your babies will appear here</span>}
      </div>
      <div className="w-[min(88vw,420px)] h-5 rounded-full bg-[repeating-linear-gradient(90deg,#a16207_0_6px,#ca8a04_6px_12px)] shadow-inner" aria-hidden />
    </div>
  )
}

function Egg({ className, spots }: { className?: string; spots: string }) {
  return (
    <svg viewBox="0 0 100 130" className={className}>
      <path d="M50 4 C 22 4, 6 52, 6 80 C 6 108, 26 126, 50 126 C 74 126, 94 108, 94 80 C 94 52, 78 4, 50 4 Z" fill="#fffbeb" stroke="#fcd34d" strokeWidth="3" />
      <circle cx="30" cy="30" r="6" fill={spots} opacity="0.7" />
      <circle cx="70" cy="24" r="5" fill={spots} opacity="0.7" />
      <circle cx="80" cy="100" r="6" fill={spots} opacity="0.7" />
      <circle cx="22" cy="104" r="5" fill={spots} opacity="0.7" />
      <ellipse cx="34" cy="22" rx="6" ry="10" fill="#ffffff" opacity="0.8" transform="rotate(-20 34 22)" />
    </svg>
  )
}

function Shell({ className, spots }: { className?: string; spots: string }) {
  return (
    <svg viewBox="0 0 100 60" className={className}>
      <path d="M6 20 L18 10 L28 22 L40 8 L52 22 L64 8 L74 22 L86 10 L94 20 C 94 44, 74 58, 50 58 C 26 58, 6 44, 6 20 Z" fill="#fffbeb" stroke="#fcd34d" strokeWidth="3" />
      <circle cx="28" cy="40" r="5" fill={spots} opacity="0.7" />
      <circle cx="72" cy="42" r="5" fill={spots} opacity="0.7" />
    </svg>
  )
}

function BabyDino({ className, color }: { className?: string; color: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className}>
      {/* tail */}
      <path d="M26 70 Q 6 72 4 58 Q 14 66 30 60 Z" fill={color} />
      {/* body */}
      <ellipse cx="48" cy="68" rx="26" ry="22" fill={color} />
      {/* spikes */}
      <path d="M30 50 L36 40 L42 50 M44 46 L50 36 L56 46" fill={color} stroke={color} strokeWidth="2" />
      {/* head */}
      <ellipse cx="66" cy="36" rx="24" ry="20" fill={color} />
      <circle cx="72" cy="30" r="7" fill="#ffffff" />
      <circle cx="74" cy="30" r="3.5" fill="#1e293b" />
      <path d="M62 44 Q 72 52 84 44" stroke="#1e293b" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="58" cy="40" r="4" fill="#fda4af" opacity="0.7" />
      {/* belly and feet */}
      <ellipse cx="50" cy="74" rx="14" ry="11" fill="#ffffff" opacity="0.5" />
      <rect x="34" y="84" width="10" height="10" rx="4" fill={color} />
      <rect x="54" y="84" width="10" height="10" rx="4" fill={color} />
    </svg>
  )
}

function Jungle() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {/* big leaves at the edges */}
      {[
        ['-6%', '18%', 'rotate-[30deg]'],
        ['88%', '26%', '-rotate-[30deg] -scale-x-100'],
        ['-4%', '64%', 'rotate-[10deg]'],
        ['90%', '70%', '-rotate-[12deg] -scale-x-100'],
      ].map(([left, top, t], i) => (
        <svg key={i} viewBox="0 0 120 60" className={`absolute w-40 sm:w-56 opacity-70 ${t}`} style={{ left, top }}>
          <path d="M4 30 C 30 0, 90 0, 116 30 C 90 60, 30 60, 4 30 Z" fill="#16a34a" />
          <path d="M4 30 L116 30" stroke="#15803d" strokeWidth="3" />
        </svg>
      ))}
      {/* volcano far away */}
      <svg className="absolute left-1/2 -translate-x-1/2 bottom-[8vh] w-[60vw] max-w-[640px] opacity-35" viewBox="0 0 300 120">
        <path d="M0 120 L120 20 L180 20 L300 120 Z" fill="#78716c" />
        <path d="M120 20 L150 6 L180 20 Z" fill="#f97316" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-[8vh] bg-gradient-to-b from-lime-500 to-lime-600" />
    </div>
  )
}
