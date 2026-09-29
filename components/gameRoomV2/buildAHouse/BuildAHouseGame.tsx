'use client'

import { KidsChoiceGame, FitLabel, LABEL_SIZE, type StageProps } from '@/components/gameRoomV2/kids'
import { labelSizeStep, KID_COLORS, type ChoiceOption } from '@/lib/gameRoomV2/kids'

// Build a House (வீடு கட்டுவோம்) -- Little Learners, ages 4-9. The answers
// are on toy bricks. Every right answer adds a piece to the house --
// floor, walls, door, windows, roof, chimney, then a garden -- so a
// child who gets every answer right sees the whole house finished.
// A wrong brick wobbles and the right one glows. No timer, no lives;
// grading stays on the server.

const SKY = 'bg-gradient-to-b from-sky-300 via-sky-100 to-lime-100'
// The pieces, in building order
const PIECES = ['floor', 'walls', 'door', 'window1', 'window2', 'roof', 'chimney', 'garden'] as const

export function BuildAHouseGame(props: { sessionId: string; onExit: () => void; onPlayAgain?: () => void; onHome?: () => void }) {
  return (
    <KidsChoiceGame
      {...props}
      background={SKY}
      resultBackground="bg-gradient-to-b from-sky-300 to-lime-100"
      scenery={() => <Yard />}
      startArt={<House built={PIECES.length} className="w-28" />}
      titleTa="வீடு கட்டுவோம்!"
      titleEn="Build a House"
      howTa="சரியான விடையுள்ள கல்லைத் தொடு - வீடு வளரும்!"
      howEn="Tap the brick with the right answer and your house grows!"
      loadingLabel="செங்கற்கள் தயாராகின்றன... · Getting the bricks ready..."
      resultLine={(n) => `${n} சரியான கற்களால் உன் வீடு உருவானது! · You built your house with ${n} right bricks!`}
      gridLabel="செங்கற்கள் · Bricks"
      targetWidth="clamp(110px, 17vw, 180px)"
      phoneTargetWidth="40vw"
      bob={false}
      renderTarget={(o, i, state) => <BrickTarget o={o} i={i} state={state} />}
      stage={(p) => <Site {...p} />}
      stagePosition="above"
    />
  )
}

function BrickTarget({ o, i, state }: { o: ChoiceOption; i: number; state: string }) {
  const [fill, dark] = KID_COLORS[i % KID_COLORS.length]
  return (
    <span
      className={`relative flex items-center justify-center w-full aspect-[3/2] rounded-xl transition-all duration-500 ${state === 'chosen' ? '-translate-y-8 scale-75 opacity-0' : ''} ${
        state === 'reveal' ? 'ring-4 ring-yellow-300 shadow-[0_0_24px_rgba(250,204,21,0.9)]' : ''
      }`}
      style={{ background: fill, boxShadow: state === 'reveal' ? undefined : `0 7px 0 ${dark}` }}
    >
      {/* toy-brick studs */}
      <span className="absolute -top-2 left-[18%] w-[22%] h-3 rounded-t-md" style={{ background: fill }} aria-hidden />
      <span className="absolute -top-2 right-[18%] w-[22%] h-3 rounded-t-md" style={{ background: fill }} aria-hidden />
      <span className="w-[84%] h-[74%] rounded-lg bg-white/90 flex items-center justify-center px-1">
        {o.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- question-set image, arbitrary Storage URL
          <img src={o.imageUrl} alt={o.label} className="h-[92%] aspect-square object-cover rounded" draggable={false} />
        ) : (
          <FitLabel className={`font-tamil font-extrabold text-slate-800 leading-tight ${LABEL_SIZE[labelSizeStep(o.label)]}`}>{o.label}</FitLabel>
        )}
      </span>
    </span>
  )
}

// The building site: pieces appear in order as right answers come in,
// spread over the whole game so full marks finish the house.
function Site({ stars, total }: StageProps) {
  const built = Math.min(PIECES.length, Math.round((stars / Math.max(1, total)) * PIECES.length))
  return (
    <div className="flex flex-col items-center" aria-label={`${built} / ${PIECES.length} பகுதிகள் கட்டப்பட்டன · pieces built`}>
      <House built={built} className="w-[clamp(150px,30vw,300px)] max-h-[32vh]" />
      <div className="mt-1 flex gap-1" aria-hidden>
        {PIECES.map((p, i) => (
          <span key={p} className={`w-3 h-3 rounded-sm ${i < built ? 'bg-amber-500' : 'bg-white/70 border border-amber-400'}`} />
        ))}
      </div>
    </div>
  )
}

function House({ built, className }: { built: number; className?: string }) {
  const has = (p: (typeof PIECES)[number]) => PIECES.indexOf(p) < built
  return (
    <svg viewBox="0 0 200 180" className={className}>
      {/* the plot, always there */}
      <rect x="10" y="160" width="180" height="12" rx="4" fill="#a16207" opacity="0.5" />
      {has('garden') && (
        <g>
          <circle cx="24" cy="150" r="12" fill="#22c55e" />
          <circle cx="176" cy="150" r="12" fill="#22c55e" />
          <circle cx="20" cy="146" r="3" fill="#f472b6" />
          <circle cx="180" cy="144" r="3" fill="#facc15" />
        </g>
      )}
      {has('floor') && <rect x="36" y="152" width="128" height="10" rx="2" fill="#78716c" />}
      {has('walls') && <rect x="44" y="84" width="112" height="70" fill="#fde68a" stroke="#d97706" strokeWidth="3" />}
      {has('door') && (
        <g>
          <rect x="88" y="112" width="26" height="42" rx="3" fill="#b45309" />
          <circle cx="108" cy="134" r="2.5" fill="#facc15" />
        </g>
      )}
      {has('window1') && <rect x="56" y="98" width="24" height="22" fill="#bae6fd" stroke="#0369a1" strokeWidth="3" />}
      {has('window2') && <rect x="122" y="98" width="24" height="22" fill="#bae6fd" stroke="#0369a1" strokeWidth="3" />}
      {has('chimney') && <rect x="128" y="44" width="16" height="30" fill="#b91c1c" />}
      {has('roof') && <path d="M34 88 L100 36 L166 88 Z" fill="#ef4444" stroke="#b91c1c" strokeWidth="3" />}
      {built === 0 && (
        <text x="100" y="120" textAnchor="middle" fontSize="40" aria-hidden>
          🏗️
        </text>
      )}
    </svg>
  )
}

function Yard() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      <span className="absolute right-[6%] top-[16%] w-16 h-16 rounded-full bg-yellow-300 shadow-[0_0_40px_14px_rgba(253,224,71,0.5)]" />
      <div className="absolute inset-x-0 bottom-0 h-[10vh] bg-gradient-to-b from-lime-400 to-lime-500" />
      <span className="absolute left-[4%] bottom-[8vh] text-5xl opacity-70">🌳</span>
      <span className="absolute right-[4%] bottom-[8vh] text-5xl opacity-70">🌳</span>
    </div>
  )
}
