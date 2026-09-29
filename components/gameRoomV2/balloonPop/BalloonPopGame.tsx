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
import { choiceOptions, risePosition, isRevealedAnswer, labelSizeStep, hasLongLabels, KID_COLORS, type ChoiceOption } from '@/lib/gameRoomV2/kids'

// Balloon Pop (பலூன் உடைப்போம்) -- Little Learners, ages 4-9. The answer
// options float up the sky in balloons and the child taps the right one.
// Deliberately gentle: no timer, no lives, no score maths on screen --
// just stars. A wrong pop wobbles the balloon and shows the right one,
// then the next question comes. Every answer is still graded by the
// server (/answer), exactly like every other engine.

const SKY = 'bg-gradient-to-b from-sky-400 via-sky-200 to-sky-50'

export function BalloonPopGame({
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
  const skyTop = useBelowCard(cardRef)

  if (!g.started) {
    return (
      <KidsStartScreen
        background={SKY}
        scenery={<Scenery reduced />}
        art={KID_COLORS.slice(0, 3).map(([fill, dark], i) => (
          <span key={i} className="w-14 mx-1" style={{ transform: `translateY(${i === 1 ? -10 : 0}px)` }}>
            <BalloonShape fill={fill} dark={dark} glow={false} />
          </span>
        ))}
        titleTa="பலூன் உடைப்போம்!"
        titleEn="Balloon Pop"
        howTa="சரியான விடையுள்ள பலூனைத் தொட்டு உடை!"
        howEn="Tap the balloon with the right answer!"
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
    background: 'bg-gradient-to-b from-sky-300 to-sky-100',
    loadingLabel: 'பலூன்கள் தயாராகின்றன... · Getting the balloons ready...',
    resultLine: (n) => `${n} பலூன்களைச் சரியாக உடைத்தாய் · You popped ${n} right balloons`,
    fx: g.fx,
    soundEnabled: g.soundEnabled,
    reduced: g.reduced,
    onPlayAgain,
    onExit,
    onHome,
  })
  if (states || !g.session || !g.shown) return states

  const options = choiceOptions(g.shown.question)

  return (
    <div className={`fixed inset-0 overflow-hidden select-none touch-manipulation ${SKY}`}>
      <CelebrationLayer ref={g.fx} soundEnabled={g.soundEnabled} reducedMotion={g.reduced} fixed />
      <Scenery reduced={g.reduced} />
      <KidsTopBar
        index={g.shown.index}
        total={g.session.totalQuestions}
        stars={g.stars}
        soundEnabled={g.soundEnabled}
        onToggleSound={g.toggleSound}
        onLeave={() => g.exit(onExit)}
      />
      <KidsQuestionCard question={g.shown.question} soundEnabled={g.soundEnabled} cardRef={cardRef} />
      <BalloonSky
        key={g.shown.index}
        top={skyTop}
        options={options}
        feedback={g.feedback}
        reduced={g.reduced}
        disabled={g.answering || !!g.feedback}
        onPop={(o, el) => g.submit(o.answer, o.key, el)}
      />
      {g.feedback?.kind === 'correct' && <PraiseBubble praise={g.praise} top={skyTop + 24} reduced={g.reduced} />}
      {g.submitError && (
        <div className="absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <p className="rounded-2xl bg-white/95 px-4 py-2 text-sm font-semibold text-rose-700 shadow">{g.submitError}</p>
        </div>
      )}
    </div>
  )
}

function BalloonSky({
  top,
  options,
  feedback,
  reduced,
  disabled,
  onPop,
}: {
  top: number
  options: ChoiceOption[]
  feedback: KidsFeedback
  reduced: boolean
  disabled: boolean
  onPop: (o: ChoiceOption, el: HTMLElement) => void
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  // Long answer words on a phone: 2 wide lanes (2 balloons each) instead of
  // 4 thin ones, so the words stay big enough to read.
  const narrow = useNarrow()
  const longWords = hasLongLabels(options)
  const lanes = narrow && longWords && options.length > 2 ? 2 : options.length
  const width =
    lanes < options.length ? 'w-[clamp(130px,40vw,200px)]' : longWords ? 'w-[clamp(96px,21vw,200px)]' : 'w-[clamp(84px,21vw,180px)]'

  // Balloons stop where they are while feedback shows
  useSceneClock(
    (t) => {
      options.forEach((_, i) => {
        const el = refs.current[i]
        if (!el) return
        const p = risePosition(i, options.length, t, reduced, lanes)
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
      className="absolute inset-x-0 bottom-0 z-10 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent_0,black_56px)]"
      style={{ top }}
      role="group"
      aria-label="பலூன்கள் · Balloons"
    >
      {options.map((o, i) => {
        const [fill, dark] = KID_COLORS[i % KID_COLORS.length]
        const popped = feedback?.kind === 'correct' && feedback.key === o.key
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
            onClick={(e) => onPop(o, e.currentTarget)}
            aria-label={o.label || `விருப்பம் ${i + 1} · Option ${i + 1}`}
            className={`absolute ${width} aspect-[5/7] focus-visible:outline-none focus-visible:[&_svg]:drop-shadow-[0_0_10px_white] ${
              popped ? 'pointer-events-none' : ''
            } ${reveal ? 'z-20' : ''}`}
            style={{ left: `${10 + i * 25}%`, top: '60%', transform: 'translate(-50%, -50%)' }}
          >
            <span
              className={`relative block w-full h-full transition-[transform,opacity] duration-300 ${
                popped ? 'scale-150 opacity-0' : wrong ? 'opacity-45 animate-[kid-wobble_0.5s_ease-in-out_2]' : ''
              } ${reveal && !reduced ? 'animate-[kid-bounce_0.7s_ease-in-out_infinite]' : ''}`}
            >
              <BalloonShape fill={fill} dark={dark} glow={reveal} />
              <span className="absolute inset-x-[8%] top-[6%] h-[58%] flex items-center justify-center text-center">
                {o.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- question-set image, arbitrary Storage URL
                  <img src={o.imageUrl} alt={o.label} className="w-[78%] aspect-square object-cover rounded-full border-4 border-white/80" draggable={false} />
                ) : (
                  <FitLabel className={`font-tamil font-extrabold text-white leading-tight [text-shadow:0_2px_0_rgba(0,0,0,0.35)] ${LABEL_SIZE[labelSizeStep(o.label)]}`}>
                    {o.label}
                  </FitLabel>
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

function BalloonShape({ fill, dark, glow }: { fill: string; dark: string; glow: boolean }) {
  return (
    <svg
      viewBox="0 0 100 140"
      className={`w-full h-full ${glow ? 'drop-shadow-[0_0_18px_rgba(250,204,21,0.95)]' : 'drop-shadow-[0_6px_6px_rgba(15,23,42,0.25)]'}`}
      aria-hidden
    >
      {/* string */}
      <path d="M50 96 C 44 108, 56 118, 48 139" stroke="#64748b" strokeWidth="1.6" fill="none" />
      {/* body */}
      <path d="M50 4 C 22 4, 6 26, 6 50 C 6 74, 28 92, 50 96 C 72 92, 94 74, 94 50 C 94 26, 78 4, 50 4 Z" fill={fill} />
      {/* shading */}
      <path d="M50 96 C 72 92, 94 74, 94 50 C 94 34, 86 20, 74 12 C 84 26, 86 44, 80 60 C 74 78, 62 88, 50 96 Z" fill={dark} opacity="0.35" />
      {/* shine */}
      <ellipse cx="30" cy="30" rx="9" ry="15" transform="rotate(-25 30 30)" fill="#ffffff" opacity="0.45" />
      {/* knot */}
      <path d="M44 95 L56 95 L52 101 L48 101 Z" fill={dark} />
    </svg>
  )
}

function Scenery({ reduced }: { reduced: boolean }) {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {/* sun */}
      <div className="absolute right-[6%] top-[18%] w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-yellow-300 shadow-[0_0_60px_20px_rgba(253,224,71,0.55)]" />
      {/* clouds */}
      {[
        ['8%', '24%', 1],
        ['58%', '34%', 0.8],
        ['30%', '48%', 0.65],
      ].map(([left, top, s], i) => (
        <div
          key={i}
          className={`absolute ${reduced ? '' : 'animate-[cloud-drift_40s_linear_infinite_alternate]'}`}
          style={{ left: left as string, top: top as string, transform: `scale(${s})`, animationDelay: `${-i * 9}s` }}
        >
          <Cloud />
        </div>
      ))}
      {/* grass hills */}
      <svg className="absolute inset-x-0 bottom-0 w-full h-[14vh] min-h-[70px]" viewBox="0 0 1200 120" preserveAspectRatio="none">
        <path d="M0 70 C 200 20, 400 20, 600 60 C 800 100, 1000 30, 1200 50 L1200 120 L0 120 Z" fill="#86efac" />
        <path d="M0 90 C 250 55, 450 70, 700 88 C 900 102, 1050 70, 1200 82 L1200 120 L0 120 Z" fill="#4ade80" />
      </svg>
      <style>{`@keyframes cloud-drift { from { translate: 0 0 } to { translate: 60px 0 } }`}</style>
    </div>
  )
}
