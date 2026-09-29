'use client'

import { useEffect, useRef, useState } from 'react'
import { CelebrationLayer } from '@/components/gameRoomV2/celebration/CelebrationLayer'
import {
  useKidsGame,
  useBelowCard,
  useNarrow,
  KidsTopBar,
  KidsQuestionCard,
  KidsStartScreen,
  KidsGameStates,
  PraiseBubble,
  HereItIs,
  FitLabel,
  KidKeyframes,
  Cloud,
  LABEL_SIZE,
  type KidsFeedback,
} from '@/components/gameRoomV2/kids'
import { choiceOptions, isRevealedAnswer, labelSizeStep, KID_COLORS, type ChoiceOption } from '@/lib/gameRoomV2/kids'

// Letter Train (எழுத்து ரயில்) -- Little Learners, ages 4-9. A friendly
// steam engine chugs in pulling carriages; each carriage's window carries
// an answer and the child taps the right carriage. Same gentle rules as
// every kids' game: no timer, no lives, a wrong tap just shows the right
// carriage. Grading stays on the server (/answer).

const SKY = 'bg-gradient-to-b from-sky-300 via-sky-100 to-emerald-50'
const ENGINE_SCALE = 1.15

// A tall screen (phone, or a tablet held upright)
function usePortrait(): boolean {
  const [portrait, setPortrait] = useState(false)
  useEffect(() => {
    const check = () => setPortrait(window.innerHeight > window.innerWidth * 1.15)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return portrait
}

export function LetterTrainGame({
  sessionId,
  onExit,
  onPlayAgain,
  onHome,
}: {
  sessionId: string
  onExit: () => void
  onPlayAgain?: () => void
  onHome?: () => void
}) {
  const g = useKidsGame({ sessionId })
  const cardRef = useRef<HTMLDivElement>(null)
  const top = useBelowCard(cardRef)

  if (!g.started) {
    return (
      <KidsStartScreen
        background={SKY}
        scenery={<Countryside />}
        art={
          <div className="flex items-end gap-1 w-56">
            <Carriage fill={KID_COLORS[1][0]} dark={KID_COLORS[1][1]} className="w-16" />
            <Carriage fill={KID_COLORS[0][0]} dark={KID_COLORS[0][1]} className="w-16" />
            <Engine className="w-20" />
          </div>
        }
        titleTa="எழுத்து ரயில்!"
        titleEn="Letter Train"
        howTa="சரியான விடையுள்ள பெட்டியைத் தொடு!"
        howEn="Tap the carriage with the right answer!"
        onStart={g.start}
        onExit={onExit}
      />
    )
  }

  const states = KidsGameStates({
    error: g.error,
    hasSession: !!g.session && !!g.shown,
    result: g.result,
    poll: g.poll,
    background: 'bg-gradient-to-b from-sky-300 to-emerald-50',
    loadingLabel: 'ரயில் வருகிறது... · The train is coming...',
    resultLine: (n) => `${n} பெட்டிகளைச் சரியாகத் தேர்ந்தெடுத்தாய் · You picked ${n} right carriages`,
    fx: g.fx,
    soundEnabled: g.soundEnabled,
    reduced: g.reduced,
    onPlayAgain,
    onExit,
    onHome,
  })
  if (states || !g.session || !g.shown) return states

  return (
    <div className={`fixed inset-0 overflow-hidden select-none touch-manipulation ${SKY}`}>
      <CelebrationLayer ref={g.fx} soundEnabled={g.soundEnabled} reducedMotion={g.reduced} fixed />
      <Countryside />
      <KidsTopBar
        index={g.shown.index}
        total={g.session.totalQuestions}
        stars={g.stars}
        soundEnabled={g.soundEnabled}
        onToggleSound={g.toggleSound}
        onLeave={() => g.exit(onExit)}
      />
      <KidsQuestionCard question={g.shown.question} soundEnabled={g.soundEnabled} cardRef={cardRef} />
      <Railway
        key={g.shown.index}
        top={top}
        options={choiceOptions(g.shown.question)}
        feedback={g.feedback}
        reduced={g.reduced}
        disabled={g.answering || !!g.feedback}
        onPick={(o, el) => g.submit(o.answer, o.key, el)}
      />
      {g.feedback?.kind === 'correct' && <PraiseBubble praise={g.praise} top={top + 16} reduced={g.reduced} />}
      {g.submitError && (
        <div className="absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <p className="rounded-2xl bg-white/95 px-4 py-2 text-sm font-semibold text-rose-700 shadow">{g.submitError}</p>
        </div>
      )}
    </div>
  )
}

function Railway({
  top,
  options,
  feedback,
  reduced,
  disabled,
  onPick,
}: {
  top: number
  options: ChoiceOption[]
  feedback: KidsFeedback
  reduced: boolean
  disabled: boolean
  onPick: (o: ChoiceOption, el: HTMLElement) => void
}) {
  // On a phone or a tall (portrait) screen, two shorter trains on two tracks
  // (2 carriages each), so every carriage stays big enough for a small
  // finger and for long words, and the screen's height gets used.
  const narrow = useNarrow()
  const portrait = usePortrait()
  const twoTracks = (narrow || portrait) && options.length > 2
  const tracks = twoTracks ? [options.slice(0, Math.ceil(options.length / 2)), options.slice(Math.ceil(options.length / 2))] : [options]
  const perTrack = Math.max(...tracks.map((t) => t.length))
  // Carriages plus an engine (ENGINE_SCALE carriages wide) fit in 90vw,
  // leaving room for the gaps between them
  const carVw = Math.floor((86 / (perTrack + ENGINE_SCALE)) * 10) / 10
  const revealKey = feedback?.kind === 'wrong' ? (options.find((o) => isRevealedAnswer(o, feedback.revealed))?.key ?? null) : null

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-center gap-6 sm:gap-10 pb-[12vh]" style={{ top }} role="group" aria-label="ரயில் பெட்டிகள் · Train carriages">
      {tracks.map((cars, ti) => (
        <div key={ti} className="relative w-full px-2 sm:px-6">
          {/* the train: carriages, then the engine at the front */}
          <div
            className={`relative z-10 mx-auto flex items-end justify-center gap-1 sm:gap-2 max-w-[1100px] ${reduced ? '' : 'animate-[train-arrive_1.8s_cubic-bezier(.2,.8,.3,1)_both]'}`}
            style={{ animationDelay: `${ti * 0.25}s` }}
          >
            {cars.map((o) => {
              const i = options.indexOf(o)
              const [fill, dark] = KID_COLORS[i % KID_COLORS.length]
              const chosen = feedback?.kind === 'correct' && feedback.key === o.key
              const wrong = feedback?.kind === 'wrong' && feedback.key === o.key
              const reveal = revealKey === o.key
              return (
                <button
                  key={o.key}
                  type="button"
                  data-kids-choice
                  disabled={disabled}
                  onClick={(e) => onPick(o, e.currentTarget)}
                  aria-label={o.label || `பெட்டி ${i + 1} · Carriage ${i + 1}`}
                  className={`relative shrink-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white rounded-2xl ${reveal ? 'z-20' : ''}`}
                  style={{ width: `min(${carVw}vw, 220px)` }}
                >
                  <span
                    className={`relative block transition-[transform,opacity] duration-300 ${chosen ? '-translate-y-3' : ''} ${
                      wrong ? 'opacity-45 animate-[kid-wobble_0.5s_ease-in-out_2]' : ''
                    } ${reveal && !reduced ? 'animate-[kid-bounce_0.7s_ease-in-out_infinite]' : ''}`}
                  >
                    <Carriage fill={chosen ? '#facc15' : fill} dark={chosen ? '#ca8a04' : dark} glow={reveal || chosen} spinning={!reduced} />
                    {/* the window with the answer */}
                    <span className="absolute left-[12%] right-[12%] top-[14%] h-[46%] rounded-xl bg-white/95 flex items-center justify-center px-1 shadow-inner">
                      {o.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- question-set image, arbitrary Storage URL
                        <img src={o.imageUrl} alt={o.label} className="h-[88%] aspect-square object-cover rounded-lg" draggable={false} />
                      ) : (
                        <FitLabel className={`font-tamil font-extrabold text-slate-800 leading-tight ${LABEL_SIZE[labelSizeStep(o.label)]}`}>{o.label}</FitLabel>
                      )}
                    </span>
                    {chosen && <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-3xl drop-shadow">⭐</span>}
                  </span>
                  {reveal && <HereItIs />}
                </button>
              )
            })}
            <div className="shrink-0" style={{ width: `min(${(carVw * ENGINE_SCALE).toFixed(1)}vw, ${Math.round(220 * ENGINE_SCALE)}px)` }} aria-hidden>
              <Engine spinning={!reduced} smoking={!reduced} />
            </div>
          </div>
          {/* the track under the wheels */}
          <Track />
        </div>
      ))}
      <KidKeyframes />
      <style>{`
        @keyframes train-arrive { from { transform: translateX(-110vw) } to { transform: translateX(0) } }
        @keyframes wheel-spin { to { transform: rotate(360deg) } }
        @keyframes smoke-puff { 0% { transform: translate(0,0) scale(.5); opacity: .9 } 100% { transform: translate(-30px,-60px) scale(1.6); opacity: 0 } }
      `}</style>
    </div>
  )
}

function Track() {
  return (
    <div className="absolute inset-x-0 bottom-[-10px] h-[18px]" aria-hidden>
      <div className="absolute inset-x-0 top-0 h-[4px] bg-slate-500 rounded" />
      <div className="absolute inset-x-0 top-[10px] h-[4px] bg-slate-500 rounded" />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,#92400e_0_10px,transparent_10px_34px)] opacity-80 -z-10" />
    </div>
  )
}

function Wheel({ cx, cy, r, spinning }: { cx: number; cy: number; r: number; spinning: boolean }) {
  return (
    <g style={{ transformOrigin: `${cx}px ${cy}px`, transformBox: 'view-box' }} className={spinning ? 'animate-[wheel-spin_0.6s_linear_4]' : ''}>
      <circle cx={cx} cy={cy} r={r} fill="#334155" />
      <circle cx={cx} cy={cy} r={r * 0.62} fill="#94a3b8" />
      <line x1={cx - r * 0.6} y1={cy} x2={cx + r * 0.6} y2={cy} stroke="#334155" strokeWidth="2" />
      <line x1={cx} y1={cy - r * 0.6} x2={cx} y2={cy + r * 0.6} stroke="#334155" strokeWidth="2" />
    </g>
  )
}

function Carriage({ fill, dark, glow = false, spinning = false, className = 'w-full' }: { fill: string; dark: string; glow?: boolean; spinning?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 120 100"
      className={`${className} block ${glow ? 'drop-shadow-[0_0_16px_rgba(250,204,21,0.95)]' : 'drop-shadow-[0_5px_4px_rgba(15,23,42,0.25)]'}`}
      aria-hidden
    >
      {/* coupling */}
      <rect x="0" y="70" width="8" height="5" fill="#475569" />
      <rect x="112" y="70" width="8" height="5" fill="#475569" />
      {/* roof */}
      <rect x="6" y="4" width="108" height="10" rx="5" fill={dark} />
      {/* body */}
      <rect x="8" y="10" width="104" height="70" rx="10" fill={fill} />
      <rect x="8" y="64" width="104" height="16" rx="6" fill={dark} opacity="0.45" />
      <Wheel cx={32} cy={84} r={12} spinning={spinning} />
      <Wheel cx={88} cy={84} r={12} spinning={spinning} />
    </svg>
  )
}

function Engine({ spinning = false, smoking = false, className = 'w-full' }: { spinning?: boolean; smoking?: boolean; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {smoking && (
        <div className="absolute left-[18%] -top-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="absolute w-6 h-6 rounded-full bg-white/80 animate-[smoke-puff_1.8s_ease-out_infinite]"
              style={{ animationDelay: `${i * 0.6}s` }}
            />
          ))}
        </div>
      )}
      <svg viewBox="0 0 140 110" className="w-full block drop-shadow-[0_5px_4px_rgba(15,23,42,0.25)]" aria-hidden>
        {/* chimney */}
        <rect x="22" y="8" width="16" height="26" rx="3" fill="#334155" />
        <rect x="18" y="4" width="24" height="8" rx="3" fill="#1e293b" />
        {/* boiler */}
        <rect x="6" y="34" width="84" height="48" rx="14" fill="#ef4444" />
        <rect x="6" y="66" width="84" height="16" rx="6" fill="#b91c1c" />
        {/* cab */}
        <rect x="84" y="14" width="50" height="68" rx="8" fill="#dc2626" />
        <rect x="80" y="8" width="58" height="10" rx="5" fill="#7f1d1d" />
        <rect x="94" y="24" width="30" height="24" rx="5" fill="#bae6fd" />
        {/* friendly face on the front */}
        <circle cx="12" cy="56" r="3.5" fill="#1e293b" />
        <circle cx="24" cy="56" r="3.5" fill="#1e293b" />
        <path d="M11 65 Q18 71 25 65" stroke="#1e293b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* cowcatcher */}
        <path d="M0 82 L14 82 L10 94 L0 94 Z" fill="#475569" />
        <Wheel cx={30} cy={90} r={14} spinning={spinning} />
        <Wheel cx={66} cy={90} r={14} spinning={spinning} />
        <Wheel cx={112} cy={92} r={12} spinning={spinning} />
      </svg>
    </div>
  )
}

function Countryside() {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      <div className="absolute right-[6%] top-[18%] w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-yellow-300 shadow-[0_0_50px_18px_rgba(253,224,71,0.5)]" />
      <div className="absolute left-[6%] top-[22%] scale-90">
        <Cloud />
      </div>
      <div className="absolute left-[55%] top-[30%] scale-75">
        <Cloud />
      </div>
      {/* distant hills */}
      <svg className="absolute inset-x-0 bottom-[10vh] w-full h-[26vh]" viewBox="0 0 1200 200" preserveAspectRatio="none">
        <path d="M0 140 C 150 60, 300 60, 450 120 C 600 170, 750 50, 900 90 C 1020 120, 1100 80, 1200 100 L1200 200 L0 200 Z" fill="#bbf7d0" />
      </svg>
      {/* meadow */}
      <div className="absolute inset-x-0 bottom-0 h-[14vh] min-h-[70px] bg-gradient-to-b from-green-400 to-green-500" />
    </div>
  )
}
