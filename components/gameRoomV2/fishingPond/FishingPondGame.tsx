'use client'

import { useEffect, useRef, useState } from 'react'
import { CelebrationLayer } from '@/components/gameRoomV2/celebration/CelebrationLayer'
import {
  useKidsGame,
  useBelowCard,
  useSceneClock,
  KidsTopBar,
  KidsQuestionCard,
  KidsStartScreen,
  KidsGameStates,
  PraiseBubble,
  HereItIs,
  FitLabel,
  KidKeyframes,
  LABEL_SIZE,
  type KidsFeedback,
} from '@/components/gameRoomV2/kids'
import { choiceOptions, swimPosition, isRevealedAnswer, labelSizeStep, KID_COLORS, type ChoiceOption } from '@/lib/gameRoomV2/kids'

// Fishing Pond (மீன் பிடிப்போம்) -- Little Learners, ages 4-9. Fish swim
// across the pond, each carrying an answer; the child taps the right fish
// to catch it. Each fish has its own row (no overlaps), rows alternate
// direction, and a fish that leaves one side comes back from the other.
// No timer or lives; grading stays on the server.

const WATER = 'bg-gradient-to-b from-sky-200 via-cyan-300 to-blue-500'

export function FishingPondGame({
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
        background={WATER}
        scenery={<Pond reduced />}
        art={
          <div className="flex items-center gap-2">
            <FishShape fill={KID_COLORS[2][0]} dark={KID_COLORS[2][1]} glow={false} className="w-20" />
            <FishShape fill={KID_COLORS[4][0]} dark={KID_COLORS[4][1]} glow={false} className="w-16 -scale-x-100" />
          </div>
        }
        titleTa="மீன் பிடிப்போம்!"
        titleEn="Fishing Pond"
        howTa="சரியான விடையுள்ள மீனைத் தொட்டுப் பிடி!"
        howEn="Tap the fish with the right answer to catch it!"
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
    background: 'bg-gradient-to-b from-sky-200 to-cyan-200',
    loadingLabel: 'மீன்கள் நீந்தி வருகின்றன... · The fish are swimming in...',
    resultLine: (n) => `${n} மீன்களைச் சரியாகப் பிடித்தாய் · You caught ${n} right fish`,
    fx: g.fx,
    soundEnabled: g.soundEnabled,
    reduced: g.reduced,
    onPlayAgain,
    onExit,
    onHome,
  })
  if (states || !g.session || !g.shown) return states

  return (
    <div className={`fixed inset-0 overflow-hidden select-none touch-manipulation ${WATER}`}>
      <CelebrationLayer ref={g.fx} soundEnabled={g.soundEnabled} reducedMotion={g.reduced} fixed />
      <Pond reduced={g.reduced} />
      <KidsTopBar
        index={g.shown.index}
        total={g.session.totalQuestions}
        stars={g.stars}
        soundEnabled={g.soundEnabled}
        onToggleSound={g.toggleSound}
        onLeave={() => g.exit(onExit)}
      />
      <KidsQuestionCard question={g.shown.question} soundEnabled={g.soundEnabled} cardRef={cardRef} />
      <School
        key={g.shown.index}
        top={top}
        options={choiceOptions(g.shown.question)}
        feedback={g.feedback}
        reduced={g.reduced}
        disabled={g.answering || !!g.feedback}
        onCatch={(o, el) => g.submit(o.answer, o.key, el)}
      />
      {g.feedback?.kind === 'correct' && <PraiseBubble praise={g.praise} top={top + 8} reduced={g.reduced} />}
      {g.submitError && (
        <div className="absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <p className="rounded-2xl bg-white/95 px-4 py-2 text-sm font-semibold text-rose-700 shadow">{g.submitError}</p>
        </div>
      )}
    </div>
  )
}

function School({
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
  const bodies = useRef<(HTMLSpanElement | null)[]>([])
  // Each fish gets its own row: on a short, wide screen the row height (not
  // the width) limits how big a fish can be without touching its neighbour.
  const areaRef = useRef<HTMLDivElement>(null)
  const [maxFishW, setMaxFishW] = useState(250)
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const update = () => setMaxFishW(Math.max(110, Math.floor(((el.clientHeight * 0.76) / Math.max(1, options.length)) * 0.82 * 2)))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [options.length])

  useSceneClock(
    (t) => {
      options.forEach((_, i) => {
        const el = refs.current[i]
        if (!el) return
        const p = swimPosition(i, options.length, t, reduced)
        el.style.left = `${p.x}%`
        el.style.top = `${p.y}%`
        el.style.transform = `translate(-50%, -50%) rotate(${p.tilt}deg)`
        // Face the way it swims; the label stays readable (not mirrored)
        const body = bodies.current[i]
        if (body) body.style.transform = p.dir === -1 ? 'scaleX(-1)' : ''
      })
    },
    !!feedback,
    [options, reduced]
  )

  const revealKey = feedback?.kind === 'wrong' ? (options.find((o) => isRevealedAnswer(o, feedback.revealed))?.key ?? null) : null

  return (
    <div ref={areaRef} className="absolute inset-x-0 bottom-0 z-10 overflow-hidden" style={{ top }} role="group" aria-label="மீன்கள் · Fish">
      {options.map((o, i) => {
        const [fill, dark] = KID_COLORS[(i + 2) % KID_COLORS.length]
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
            aria-label={o.label || `மீன் ${i + 1} · Fish ${i + 1}`}
            className={`absolute aspect-[2/1] focus-visible:outline-none focus-visible:[&_svg]:drop-shadow-[0_0_10px_white] ${caught ? 'pointer-events-none' : ''} ${reveal ? 'z-20' : ''}`}
            style={{ width: `min(max(130px, 36vw), 250px, ${maxFishW}px)`, left: i % 2 === 0 ? '-20%' : '120%', top: '50%', transform: 'translate(-50%, -50%)' }}
          >
            <span
              className={`relative block w-full h-full transition-[transform,opacity] duration-700 ${caught ? '-translate-y-[45vh] rotate-[-20deg] opacity-0' : ''} ${
                wrong ? 'opacity-45 animate-[kid-wobble_0.5s_ease-in-out_2]' : ''
              } ${reveal && !reduced ? 'animate-[kid-bounce_0.7s_ease-in-out_infinite]' : ''}`}
            >
              <span
                ref={(el) => {
                  bodies.current[i] = el
                }}
                className="block w-full h-full"
              >
                <FishShape fill={fill} dark={dark} glow={reveal} />
              </span>
              {/* the answer patch on the fish's body */}
              <span className="absolute left-[21%] right-[23%] top-[20%] h-[60%] rounded-full bg-white/95 flex items-center justify-center px-2 shadow-inner">
                {o.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- question-set image, arbitrary Storage URL
                  <img src={o.imageUrl} alt={o.label} className="h-[90%] aspect-square object-cover rounded-full" draggable={false} />
                ) : (
                  <FitLabel className={`font-tamil font-extrabold text-slate-800 leading-tight ${LABEL_SIZE[labelSizeStep(o.label)]}`}>{o.label}</FitLabel>
                )}
              </span>
            </span>
            {caught && <span className="absolute left-1/2 top-0 -translate-x-1/2 text-4xl">💦</span>}
            {reveal && <HereItIs />}
          </button>
        )
      })}
      <KidKeyframes />
    </div>
  )
}

// Faces right; mirrored with scaleX(-1) to swim left
function FishShape({ fill, dark, glow, className = 'w-full h-full' }: { fill: string; dark: string; glow: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 200 100"
      className={`${className} ${glow ? 'drop-shadow-[0_0_18px_rgba(250,204,21,0.95)]' : 'drop-shadow-[0_6px_6px_rgba(15,23,42,0.25)]'}`}
      aria-hidden
    >
      {/* tail */}
      <path d="M40 50 L4 16 Q 14 50 4 84 Z" fill={dark} />
      {/* fins */}
      <path d="M90 14 Q 110 -2 132 16 Z" fill={dark} />
      <path d="M96 86 Q 110 100 126 84 Z" fill={dark} />
      {/* body */}
      <ellipse cx="112" cy="50" rx="80" ry="40" fill={fill} />
      {/* scales shine */}
      <ellipse cx="112" cy="36" rx="60" ry="14" fill="#ffffff" opacity="0.22" />
      {/* eye and smile */}
      <circle cx="170" cy="40" r="8" fill="#ffffff" />
      <circle cx="172" cy="40" r="4.5" fill="#1e293b" />
      <path d="M174 60 Q 182 64 188 58" stroke="#1e293b" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function Pond({ reduced }: { reduced: boolean }) {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {/* sunlight on the water */}
      <div className="absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/40 to-transparent" />
      {/* lily pads */}
      {[
        ['6%', '22%', 'w-16 h-10'],
        ['80%', '30%', 'w-20 h-12'],
      ].map(([left, top, size], i) => (
        <span key={i} className={`absolute ${size} rounded-[50%] bg-green-500/90 border-4 border-green-600/60`} style={{ left, top }} />
      ))}
      {/* reeds along the bottom */}
      <svg className="absolute inset-x-0 bottom-0 w-full h-[14vh] min-h-[70px]" viewBox="0 0 1200 120" preserveAspectRatio="none">
        <path d="M0 120 C 150 70, 300 90, 450 100 C 650 112, 850 70, 1200 96 L1200 120 Z" fill="#fde68a" opacity="0.9" />
        {[60, 140, 980, 1080, 1150].map((x, i) => (
          <path key={i} d={`M${x} 120 Q ${x - 10} 60 ${x + 6} 20`} stroke="#15803d" strokeWidth="8" fill="none" strokeLinecap="round" />
        ))}
      </svg>
      {/* bubbles */}
      {!reduced &&
        [12, 34, 58, 76, 90].map((left, i) => (
          <span
            key={i}
            className="absolute bottom-0 w-3 h-3 rounded-full border-2 border-white/80 animate-[bubble-rise_7s_linear_infinite]"
            style={{ left: `${left}%`, animationDelay: `${-i * 1.4}s` }}
          />
        ))}
      <style>{`@keyframes bubble-rise { from { transform: translateY(0); opacity: .9 } to { transform: translateY(-90vh); opacity: 0 } }`}</style>
    </div>
  )
}
