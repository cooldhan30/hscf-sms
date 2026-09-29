'use client'

import { useRef } from 'react'
import { CelebrationLayer } from '@/components/gameRoomV2/celebration/CelebrationLayer'
import {
  useKidsGame,
  useBelowCard,
  useNarrow,
  useSceneClock,
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
import { choiceOptions, fallPosition, isRevealedAnswer, labelSizeStep, hasLongLabels, KID_COLORS, type ChoiceOption } from '@/lib/gameRoomV2/kids'

// Parachute Catch (பாராசூட்) -- Little Learners, ages 4-9. Parachutes
// drift down from the evening sky, each carrying a crate with an answer;
// the child taps the right one to catch it in the basket. No timer or
// lives: a parachute that lands floats down again from the top, and a
// wrong catch just shows the right one. Grading stays on the server.

const SKY = 'bg-gradient-to-b from-orange-300 via-amber-100 to-sky-100'

export function ParachuteCatchGame({
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
        scenery={<Evening />}
        art={KID_COLORS.slice(1, 4).map(([fill, dark], i) => (
          <span key={i} className="w-16 mx-1" style={{ transform: `translateY(${i === 1 ? -12 : 0}px)` }}>
            <ParachuteShape fill={fill} dark={dark} glow={false} />
          </span>
        ))}
        titleTa="பாராசூட் பிடி!"
        titleEn="Parachute Catch"
        howTa="சரியான விடையுள்ள பாராசூட்டைத் தொட்டுப் பிடி!"
        howEn="Tap the parachute with the right answer to catch it!"
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
    background: 'bg-gradient-to-b from-orange-200 to-sky-100',
    loadingLabel: 'பாராசூட்கள் வருகின்றன... · Parachutes on the way...',
    resultLine: (n) => `${n} பாராசூட்களைச் சரியாகப் பிடித்தாய் · You caught ${n} right parachutes`,
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
      <Evening />
      <KidsTopBar
        index={g.shown.index}
        total={g.session.totalQuestions}
        stars={g.stars}
        soundEnabled={g.soundEnabled}
        onToggleSound={g.toggleSound}
        onLeave={() => g.exit(onExit)}
      />
      <KidsQuestionCard question={g.shown.question} soundEnabled={g.soundEnabled} cardRef={cardRef} />
      <ParachuteSky
        key={g.shown.index}
        top={top}
        options={choiceOptions(g.shown.question)}
        feedback={g.feedback}
        reduced={g.reduced}
        disabled={g.answering || !!g.feedback}
        onCatch={(o, el) => g.submit(o.answer, o.key, el)}
      />
      <Basket caught={g.feedback?.kind === 'correct'} />
      {g.feedback?.kind === 'correct' && <PraiseBubble praise={g.praise} top={top + 24} reduced={g.reduced} />}
      {g.submitError && (
        <div className="absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <p className="rounded-2xl bg-white/95 px-4 py-2 text-sm font-semibold text-rose-700 shadow">{g.submitError}</p>
        </div>
      )}
    </div>
  )
}

function ParachuteSky({
  top,
  options,
  feedback,
  reduced,
  disabled,
  onCatch,
}: {
  top: number
  options: ChoiceOption[]
  feedback: KidsFeedback
  reduced: boolean
  disabled: boolean
  onCatch: (o: ChoiceOption, el: HTMLElement) => void
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const narrow = useNarrow()
  const longWords = hasLongLabels(options)
  const lanes = narrow && longWords && options.length > 2 ? 2 : options.length
  const width =
    lanes < options.length ? 'w-[clamp(130px,40vw,210px)]' : longWords ? 'w-[clamp(96px,21vw,210px)]' : 'w-[clamp(90px,22vw,190px)]'

  useSceneClock(
    (t) => {
      options.forEach((_, i) => {
        const el = refs.current[i]
        if (!el) return
        const p = fallPosition(i, options.length, t, reduced, lanes)
        el.style.left = `${p.x}%`
        el.style.top = `${p.y}%`
        el.style.transform = `translate(-50%, -50%) rotate(${p.tilt}deg)`
      })
    },
    !!feedback,
    [options, reduced, lanes]
  )

  const revealKey = feedback?.kind === 'wrong' ? (options.find((o) => isRevealedAnswer(o, feedback.revealed))?.key ?? null) : null

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-10 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent_0,black_48px)]"
      style={{ top }}
      role="group"
      aria-label="பாராசூட்கள் · Parachutes"
    >
      {options.map((o, i) => {
        const [fill, dark] = KID_COLORS[i % KID_COLORS.length]
        const caught = feedback?.kind === 'correct' && feedback.key === o.key
        const wrong = feedback?.kind === 'wrong' && feedback.key === o.key
        const reveal = revealKey === o.key
        return (
          <button
            key={o.key}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            data-kids-choice
            disabled={disabled}
            onClick={(e) => onCatch(o, e.currentTarget)}
            aria-label={o.label || `விருப்பம் ${i + 1} · Option ${i + 1}`}
            className={`absolute ${width} aspect-[5/7] focus-visible:outline-none focus-visible:[&_svg]:drop-shadow-[0_0_10px_white] ${caught ? 'pointer-events-none' : ''} ${reveal ? 'z-20' : ''}`}
            style={{ left: `${10 + i * 25}%`, top: '-20%', transform: 'translate(-50%, -50%)' }}
          >
            <span
              className={`relative block w-full h-full transition-[transform,opacity] duration-700 ease-in ${caught ? 'translate-y-[60vh] scale-50 opacity-0' : ''} ${
                wrong ? 'opacity-45 animate-[kid-wobble_0.5s_ease-in-out_2]' : ''
              } ${reveal && !reduced ? 'animate-[kid-bounce_0.7s_ease-in-out_infinite]' : ''}`}
            >
              <ParachuteShape fill={fill} dark={dark} glow={reveal} />
              {/* the crate's label */}
              <span className="absolute left-[16%] right-[16%] top-[54%] h-[40%] rounded-lg bg-amber-50 flex items-center justify-center px-0.5 shadow-inner">
                {o.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- question-set image, arbitrary Storage URL
                  <img src={o.imageUrl} alt={o.label} className="h-[90%] aspect-square object-cover rounded" draggable={false} />
                ) : (
                  <FitLabel className={`font-tamil font-extrabold text-amber-950 leading-tight ${LABEL_SIZE[labelSizeStep(o.label)]}`}>{o.label}</FitLabel>
                )}
              </span>
            </span>
            {reveal && <HereItIs />}
          </button>
        )
      })}
      <KidKeyframes />
    </div>
  )
}

function ParachuteShape({ fill, dark, glow }: { fill: string; dark: string; glow: boolean }) {
  return (
    <svg
      viewBox="0 0 100 140"
      className={`w-full h-full ${glow ? 'drop-shadow-[0_0_18px_rgba(250,204,21,0.95)]' : 'drop-shadow-[0_6px_6px_rgba(15,23,42,0.22)]'}`}
      aria-hidden
    >
      {/* canopy with stripes */}
      <path d="M8 38 C 8 12, 32 2, 50 2 C 68 2, 92 12, 92 38 Z" fill={fill} />
      <path d="M50 2 C 41 11, 38 25, 38 38 L 62 38 C 62 25, 59 11, 50 2 Z" fill="#ffffff" opacity="0.55" />
      <path d="M8 38 Q 16 33 24 38 Q 32 33 40 38 Q 50 33 60 38 Q 68 33 76 38 Q 84 33 92 38" fill="none" stroke={dark} strokeWidth="3" />
      {/* strings */}
      <path d="M10 38 L 16 72 M 38 38 L 36 72 M 62 38 L 64 72 M 90 38 L 84 72" stroke="#475569" strokeWidth="1.4" />
      {/* crate */}
      <rect x="10" y="70" width="80" height="66" rx="6" fill="#b45309" />
      <rect x="10" y="70" width="80" height="66" rx="6" fill="none" stroke="#78350f" strokeWidth="3" />
    </svg>
  )
}

function Basket({ caught }: { caught: boolean }) {
  return (
    <div className="absolute bottom-[3vh] left-1/2 -translate-x-1/2 z-20 pointer-events-none" aria-hidden>
      <div className={`relative w-32 sm:w-44 transition-transform duration-300 ${caught ? 'scale-110' : ''}`}>
        <svg viewBox="0 0 160 80" className="w-full drop-shadow-[0_6px_6px_rgba(15,23,42,0.25)]">
          <path d="M8 18 H152 L136 76 H24 Z" fill="#d97706" />
          <path d="M8 18 H152" stroke="#92400e" strokeWidth="8" strokeLinecap="round" />
          <path d="M30 30 L40 72 M56 30 L60 72 M80 30 L80 72 M104 30 L100 72 M130 30 L120 72" stroke="#92400e" strokeWidth="3" />
          <path d="M14 42 H146 M18 58 H142" stroke="#b45309" strokeWidth="3" />
        </svg>
        {caught && <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-4xl">⭐</span>}
      </div>
    </div>
  )
}

function Evening() {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      <div className="absolute left-[8%] top-[20%] w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-orange-200 shadow-[0_0_70px_26px_rgba(254,215,170,0.8)]" />
      <div className="absolute right-[8%] top-[26%] scale-90 opacity-90">
        <Cloud />
      </div>
      <div className="absolute left-[40%] top-[40%] scale-75 opacity-80">
        <Cloud />
      </div>
      <svg className="absolute inset-x-0 bottom-0 w-full h-[16vh] min-h-[80px]" viewBox="0 0 1200 120" preserveAspectRatio="none">
        <path d="M0 60 C 200 20, 400 30, 600 55 C 800 80, 1000 25, 1200 45 L1200 120 L0 120 Z" fill="#bef264" />
        <path d="M0 88 C 250 60, 450 72, 700 86 C 900 98, 1050 70, 1200 80 L1200 120 L0 120 Z" fill="#84cc16" />
      </svg>
    </div>
  )
}
