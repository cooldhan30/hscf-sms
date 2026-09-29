'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FiX, FiVolume2, FiVolumeX, FiStar } from 'react-icons/fi'
import { GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { GameResultsScreen, useSoundPreference, playSound, useGameSessionState } from '@/components/gameRoomV2/gameplay'
import { useGameV2Motion } from '@/components/gameRoomV2/useGameV2Motion'
import { CelebrationLayer, type CelebrationHandle } from '@/components/gameRoomV2/celebration/CelebrationLayer'
import type { BaseSessionStatePayload } from '@/lib/gameRoomV2/gameplay/sessionPolling'
import {
  balloonOptions,
  balloonPosition,
  isRevealedAnswer,
  visibleLength,
  labelSizeStep,
  BALLOON_COLORS,
  PRAISE,
  type BalloonOption,
} from '@/lib/gameRoomV2/balloonPop'

// Balloon Pop (பலூன் உடைப்போம்) -- Little Learners, ages 4-9. The answer
// options float up the sky in balloons and the child taps the right one.
// Deliberately gentle: no timer, no lives, no score maths on screen --
// just stars. A wrong pop wobbles the balloon and shows the right one,
// then the next question comes. Every answer is still graded by the
// server (/answer), exactly like every other engine.

interface KidsQuestionPayload {
  id: string
  questionType: string
  prompt: string
  payload: Record<string, unknown>
  mediaUrl: string | null
}

interface BalloonSessionState extends BaseSessionStatePayload {
  question: KidsQuestionPayload | null
}

type Feedback = { kind: 'correct'; key: string } | { kind: 'wrong'; key: string; revealed: string | null } | null

const FEEDBACK_MS = { correct: 1600, wrong: 2600 }

// Label size as a share of the balloon's label box (a size container, see
// FitLabel). Kept here, not in lib/, because Tailwind only scans app/ and
// components/ for class names.
const LABEL_SIZE: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'text-[52cqw]',
  2: 'text-[36cqw]',
  3: 'text-[26cqw]',
  4: 'text-[19cqw]',
  5: 'text-[15cqw]',
}

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
  const { soundEnabled, toggleSound } = useSoundPreference()
  const reduced = !!useGameV2Motion().reduced
  const [started, setStarted] = useState(false)
  const { state: session, error, result, poll, exit } = useGameSessionState<BalloonSessionState>({
    sessionId,
    enabled: started,
    soundEnabled,
  })

  // The question on screen is held while feedback plays, even though the
  // server has already moved on to the next one.
  const [shown, setShown] = useState<{ index: number; question: KidsQuestionPayload } | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [answering, setAnswering] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [stars, setStars] = useState(0)
  const [streak, setStreak] = useState(0)
  const [praise, setPraise] = useState(PRAISE[0])
  const fx = useRef<CelebrationHandle>(null)
  // The sky (where balloons fly) starts just under the question card, so a
  // balloon -- maybe the right answer -- never hides behind it. The card's
  // height changes with each question, so it's measured.
  const cardRef = useRef<HTMLDivElement>(null)
  const [skyTop, setSkyTop] = useState(160)
  useLayoutEffect(() => {
    const el = cardRef.current
    if (!el) return
    const update = () => setSkyTop(Math.round(el.getBoundingClientRect().bottom + 8))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  })

  useEffect(() => {
    if (feedback || !session?.question) return
    if (!shown || shown.index !== session.currentIndex) setShown({ index: session.currentIndex, question: session.question })
  }, [session, feedback, shown])

  const options = shown ? balloonOptions(shown.question) : []
  const tamilVoice = useTamilVoice()

  const speak = useCallback(() => {
    if (!shown || !tamilVoice || typeof window === 'undefined') return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(shown.question.prompt)
    u.voice = tamilVoice
    u.lang = tamilVoice.lang
    u.rate = 0.85
    window.speechSynthesis.speak(u)
  }, [shown, tamilVoice])

  // Listening questions play their clip as each question appears
  const audioUrl = shown && typeof shown.question.payload.audioUrl === 'string' ? (shown.question.payload.audioUrl as string) : null
  const audioRef = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    if (audioUrl && soundEnabled) audioRef.current?.play().catch(() => undefined)
  }, [audioUrl, soundEnabled])

  const pop = useCallback(
    async (option: BalloonOption, el: HTMLElement) => {
      if (!shown || answering || feedback) return
      setAnswering(true)
      setSubmitError(null)
      try {
        const res = await fetch(`/api/gameroom-v2/sessions/${sessionId}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionIndex: shown.index, answer: option.answer }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || typeof data?.isCorrect !== 'boolean') throw new Error(data?.error || 'Could not check that balloon')

        const r = el.getBoundingClientRect()
        if (data.isCorrect) {
          const nextStreak = streak + 1
          const words = PRAISE[Math.floor(Math.random() * PRAISE.length)]
          setPraise(words)
          setStreak(nextStreak)
          setStars((s) => s + 1)
          setFeedback({ kind: 'correct', key: option.key })
          fx.current?.correct({ streak: nextStreak, origin: { x: r.left + r.width / 2, y: r.top + r.height / 3 }, card: false })
        } else {
          setStreak(0)
          // A soft sound, not a buzzer -- this is a 4-year-old
          playSound('button', soundEnabled)
          setFeedback({ kind: 'wrong', key: option.key, revealed: typeof data.correctAnswer === 'string' ? data.correctAnswer : null })
        }
        const wait = data.isCorrect ? FEEDBACK_MS.correct : FEEDBACK_MS.wrong
        window.setTimeout(() => {
          setFeedback(null)
          poll()
        }, wait)
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : 'Could not check that balloon')
        poll()
      } finally {
        setAnswering(false)
      }
    },
    [shown, answering, feedback, sessionId, streak, soundEnabled, poll]
  )

  if (!started) {
    return <StartScreen onStart={() => setStarted(true)} onExit={onExit} />
  }
  if (error && !session) return <GameV2Error description={error} onRetry={poll} />

  if (result) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-sky-300 to-sky-100 px-4 py-8">
        <CelebrationLayer ref={fx} soundEnabled={soundEnabled} reducedMotion={reduced} fixed />
        <GameResultsScreen
          result={result}
          headline="நீ ஒரு நட்சத்திரம்! · You're a star!"
          subline={`${result.correctCount} பலூன்களைச் சரியாக உடைத்தாய் · You popped ${result.correctCount} right balloons`}
          gameStats={[
            { label: 'நட்சத்திரங்கள் · Stars', value: result.correctCount },
            { label: 'கேள்விகள் · Questions', value: result.totalQuestions },
          ]}
          onPlayAgain={onPlayAgain}
          onExit={onExit}
          onHome={onHome}
        />
      </div>
    )
  }

  if (!session || !shown) return <GameV2Loading label="பலூன்கள் தயாராகின்றன... · Getting the balloons ready..." />

  const total = session.totalQuestions

  return (
    <div className="fixed inset-0 overflow-hidden select-none bg-gradient-to-b from-sky-400 via-sky-200 to-sky-50 touch-manipulation">
      <CelebrationLayer ref={fx} soundEnabled={soundEnabled} reducedMotion={reduced} fixed />
      <Scenery reduced={reduced} />

      {/* Top bar: leave, progress balloons, stars, sound */}
      <div className="absolute inset-x-0 top-0 z-30 flex items-center gap-2 p-2 sm:p-3">
        <button
          type="button"
          onClick={() => exit(onExit)}
          aria-label="விளையாட்டை விட்டு வெளியேறு · Leave the game"
          className="w-12 h-12 rounded-full bg-white/90 shadow-md flex items-center justify-center text-sky-800 active:scale-95"
        >
          <FiX className="w-6 h-6" />
        </button>
        <div className="flex-1 flex items-center justify-center gap-1 flex-wrap" aria-label={`கேள்வி ${Math.min(shown.index + 1, total)} / ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={`w-3 h-4 sm:w-3.5 sm:h-[18px] rounded-[50%] ${i < shown.index ? 'bg-amber-400' : i === shown.index ? 'bg-rose-500 ring-2 ring-white' : 'bg-white/70'}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-full bg-white/90 shadow-md px-3 h-12 text-amber-600 font-extrabold text-xl tabular-nums" aria-label={`${stars} நட்சத்திரங்கள் · stars`}>
          <FiStar className="w-6 h-6 fill-amber-400" /> {stars}
        </div>
        <button
          type="button"
          onClick={toggleSound}
          aria-label={soundEnabled ? 'ஒலியை நிறுத்து · Sound off' : 'ஒலி · Sound on'}
          className="w-12 h-12 rounded-full bg-white/90 shadow-md flex items-center justify-center text-sky-800 active:scale-95"
        >
          {soundEnabled ? <FiVolume2 className="w-6 h-6" /> : <FiVolumeX className="w-6 h-6" />}
        </button>
      </div>

      {/* The question */}
      <div className="absolute inset-x-0 top-16 sm:top-[72px] z-20 flex justify-center px-3">
        <div ref={cardRef} className="max-w-2xl w-full rounded-3xl bg-white/95 shadow-xl border-4 border-amber-300 px-4 py-3 sm:px-6 sm:py-4 flex items-center gap-3">
          <p className="flex-1 font-tamil text-lg sm:text-2xl font-bold text-slate-800 leading-snug text-center">{shown.question.prompt}</p>
          {(tamilVoice || audioUrl) && (
            <button
              type="button"
              onClick={() => (audioUrl ? audioRef.current?.play().catch(() => undefined) : speak())}
              aria-label="கேள் · Listen"
              className="shrink-0 w-14 h-14 rounded-full bg-amber-400 text-white shadow-md flex items-center justify-center active:scale-95"
            >
              <FiVolume2 className="w-7 h-7" />
            </button>
          )}
          {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}
        </div>
      </div>

      {/* The sky the balloons fly in */}
      <BalloonSky
        key={shown.index}
        top={skyTop}
        options={options}
        feedback={feedback}
        reduced={reduced}
        disabled={answering || !!feedback}
        onPop={pop}
      />

      {feedback?.kind === 'correct' && (
        <div className="absolute inset-x-0 z-30 flex justify-center pointer-events-none px-4" style={{ top: skyTop + 24 }}>
          <p
            aria-live="polite"
            className={`rounded-full bg-emerald-500 text-white shadow-xl border-4 border-white px-6 py-2 sm:px-8 sm:py-3 text-2xl sm:text-4xl font-extrabold ${
              reduced ? '' : 'animate-[praise-pop_0.45s_cubic-bezier(.2,1.6,.4,1)_both]'
            }`}
          >
            <span className="font-tamil">{praise[0]}</span> {praise[1]} ⭐
          </p>
          <style>{`@keyframes praise-pop { from { transform: scale(0.3); opacity: 0 } to { transform: scale(1); opacity: 1 } }`}</style>
        </div>
      )}
      {submitError && (
        <div className="absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <p className="rounded-2xl bg-white/95 px-4 py-2 text-sm font-semibold text-rose-700 shadow">{submitError}</p>
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
  options: BalloonOption[]
  feedback: Feedback
  reduced: boolean
  disabled: boolean
  onPop: (o: BalloonOption, el: HTMLElement) => void
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const frozen = !!feedback
  // Long answer words on a narrow screen: 2 wide lanes (2 balloons each)
  // instead of 4 thin ones, so the words stay big enough to read.
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  const longWords = options.some((o) => !o.imageUrl && visibleLength(o.label) > 4)
  const lanes = narrow && longWords && options.length > 2 ? 2 : options.length
  const width =
    lanes < options.length ? 'w-[clamp(130px,40vw,200px)]' : longWords ? 'w-[clamp(96px,21vw,200px)]' : 'w-[clamp(84px,21vw,180px)]'

  // Balloons move with a requestAnimationFrame loop writing transforms
  // straight to the DOM (no React re-render per frame). They stop where
  // they are while feedback shows, so the child can see what happened.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let t = 0
    const tick = (now: number) => {
      const dt = Math.min(64, now - last)
      last = now
      if (!frozen) t += dt
      options.forEach((_, i) => {
        const el = refs.current[i]
        if (!el) return
        const p = balloonPosition(i, options.length, t, reduced, lanes)
        el.style.left = `${p.x}%`
        el.style.top = `${p.y}%`
        el.style.transform = `translate(-50%, -50%) rotate(${p.tilt}deg)`
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [options, reduced, frozen, lanes])

  // While feedback shows, a balloon that went off-screen comes back into view
  const revealKey =
    feedback?.kind === 'wrong' ? options.find((o) => isRevealedAnswer(o, feedback.revealed))?.key ?? null : null

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-10 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent_0,black_56px)]"
      style={{ top }}
      role="group"
      aria-label="பலூன்கள் · Balloons"
    >
      {options.map((o, i) => {
        const [fill, dark] = BALLOON_COLORS[i % BALLOON_COLORS.length]
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
                popped ? 'scale-150 opacity-0' : wrong ? 'opacity-45 animate-[balloon-wobble_0.5s_ease-in-out_2]' : ''
              } ${reveal && !reduced ? 'animate-[balloon-bounce_0.7s_ease-in-out_infinite]' : ''}`}
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
            {reveal && (
              <span className="absolute left-1/2 -translate-x-1/2 -bottom-2 whitespace-nowrap rounded-full bg-white px-3 py-1 text-sm sm:text-base font-extrabold text-emerald-700 shadow-lg font-tamil">
                👆 இதோ! · Here it is!
              </span>
            )}
          </button>
        )
      })}
      <style>{`
        @keyframes balloon-wobble { 0%,100% { transform: rotate(0) } 25% { transform: rotate(-12deg) } 75% { transform: rotate(12deg) } }
        @keyframes balloon-bounce { 0%,100% { transform: scale(1) } 50% { transform: scale(1.12) } }
      `}</style>
    </div>
  )
}

// Shrinks a label just enough to fit inside its balloon: wide letters
// (ஔ, ஊ, ணா) take more room than narrow ones (க) at the same size.
function FitLabel({ className, children }: { className: string; children: string }) {
  const outer = useRef<HTMLSpanElement>(null)
  const inner = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const o = outer.current
    const i = inner.current
    if (!o || !i) return
    const fit = () => {
      i.style.transform = ''
      const scale = Math.min(1, o.clientWidth / Math.max(1, i.scrollWidth), o.clientHeight / Math.max(1, i.scrollHeight))
      if (scale < 1) i.style.transform = `scale(${scale})`
    }
    fit()
    // Re-fit once the Tamil web font has loaded (the fallback font measures
    // wider) and whenever the balloon changes size.
    document.fonts?.ready.then(fit).catch(() => undefined)
    const ro = new ResizeObserver(fit)
    ro.observe(o)
    return () => ro.disconnect()
  }, [children, className])
  return (
    <span ref={outer} className="flex w-full h-full items-center justify-center overflow-visible [container-type:size]">
      <span ref={inner} className={`inline-block text-center ${/\s/.test(children.trim()) ? 'whitespace-normal max-w-full' : 'whitespace-nowrap'} ${className}`}>
        {children}
      </span>
    </span>
  )
}

function BalloonShape({ fill, dark, glow }: { fill: string; dark: string; glow: boolean }) {
  return (
    <svg viewBox="0 0 100 140" className={`w-full h-full ${glow ? 'drop-shadow-[0_0_18px_rgba(250,204,21,0.95)]' : 'drop-shadow-[0_6px_6px_rgba(15,23,42,0.25)]'}`} aria-hidden>
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
          <div className="relative w-40 h-12">
            <span className="absolute left-0 bottom-0 w-40 h-10 rounded-full bg-white/90" />
            <span className="absolute left-6 bottom-3 w-16 h-16 rounded-full bg-white/90" />
            <span className="absolute left-16 bottom-4 w-20 h-20 rounded-full bg-white/90" />
          </div>
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

function StartScreen({ onStart, onExit }: { onStart: () => void; onExit: () => void }) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-gradient-to-b from-sky-400 via-sky-200 to-sky-50 flex items-center justify-center p-4">
      <Scenery reduced />
      <div className="relative z-10 max-w-md w-full rounded-[2rem] bg-white/95 shadow-2xl border-4 border-amber-300 p-6 text-center">
        <div className="flex justify-center gap-2 mb-2" aria-hidden>
          {BALLOON_COLORS.slice(0, 3).map(([fill, dark], i) => (
            <span key={i} className="w-14" style={{ transform: `translateY(${i === 1 ? -10 : 0}px)` }}>
              <BalloonShape fill={fill} dark={dark} glow={false} />
            </span>
          ))}
        </div>
        <h1 className="font-tamil text-3xl font-extrabold text-rose-600">பலூன் உடைப்போம்!</h1>
        <p className="text-xl font-bold text-sky-800">Balloon Pop</p>
        <p className="font-tamil mt-3 text-lg text-slate-700">சரியான விடையுள்ள பலூனைத் தொட்டு உடை!</p>
        <p className="text-slate-600">Tap the balloon with the right answer!</p>
        <button
          type="button"
          onClick={onStart}
          className="mt-5 w-full min-h-[64px] rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 text-white text-2xl font-extrabold shadow-[0_5px_0_#047857] active:translate-y-1 active:shadow-none"
        >
          <span className="font-tamil">தொடங்கு</span> · Start
        </button>
        <button type="button" onClick={onExit} className="mt-3 min-h-[44px] px-4 text-slate-500 font-semibold underline">
          <span className="font-tamil">பின் செல்</span> · Back
        </button>
      </div>
    </div>
  )
}

// A Tamil speech-synthesis voice if the device has one (many phones and
// Chrome on desktop do); null hides the read-aloud button.
function useTamilVoice(): SpeechSynthesisVoice | null {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null)
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const pick = () => setVoice(window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('ta')) ?? null)
    pick()
    window.speechSynthesis.addEventListener('voiceschanged', pick)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', pick)
  }, [])
  return voice
}
