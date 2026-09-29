'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { FiX, FiVolume2, FiVolumeX, FiStar } from 'react-icons/fi'
import { GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { GameResultsScreen } from '@/components/gameRoomV2/gameplay'
import { CelebrationLayer, type CelebrationHandle } from '@/components/gameRoomV2/celebration/CelebrationLayer'
import type { GameResult } from '@/lib/gameRoomV2/domain'
import type { KidsQuestionPayload } from './useKidsGame'

// Shared look of the Little Learners games: the top bar (leave, progress,
// stars, sound), the question card with read-aloud, the start screen,
// results, the praise bubble and text that fits whatever it sits on.

// Label size as a share of its box's width (the box is a size container,
// see FitLabel). Here, not in lib/, because Tailwind only scans app/,
// components/ and pages/ for class names.
export const LABEL_SIZE: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'text-[52cqw]',
  2: 'text-[36cqw]',
  3: 'text-[26cqw]',
  4: 'text-[19cqw]',
  5: 'text-[15cqw]',
}

// Shrinks a label just enough to fit its box: wide letters (ஔ, ஊ, ணா)
// take more room than narrow ones (க) at the same size. Two-word labels
// may wrap onto two lines.
export function FitLabel({ className, children }: { className: string; children: string }) {
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
    // wider) and whenever the box changes size.
    document.fonts?.ready.then(fit).catch(() => undefined)
    const ro = new ResizeObserver(fit)
    ro.observe(o)
    return () => ro.disconnect()
  }, [children, className])
  return (
    <span ref={outer} className="flex w-full h-full items-center justify-center overflow-visible [container-type:size]">
      <span
        ref={inner}
        className={`inline-block text-center ${/\s/.test(children.trim()) ? 'whitespace-normal max-w-full' : 'whitespace-nowrap'} ${className}`}
      >
        {children}
      </span>
    </span>
  )
}

// A Tamil speech-synthesis voice if the device has one (many phones and
// Chrome on desktop do); null hides the read-aloud button.
export function useTamilVoice(): SpeechSynthesisVoice | null {
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

// True below 640px wide (phones), kept up to date on resize
export function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return narrow
}

// A requestAnimationFrame loop that calls `frame(tMs)` with the time the
// scene has been running, paused while `frozen` (feedback showing).
// Games write transforms straight to the DOM -- no React render per frame.
export function useSceneClock(frame: (tMs: number) => void, frozen: boolean, deps: unknown[]) {
  const frameRef = useRef(frame)
  frameRef.current = frame
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let t = 0
    const tick = (now: number) => {
      const dt = Math.min(64, now - last)
      last = now
      if (!frozen) t += dt
      frameRef.current(t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frozen, ...deps])
}

export function KidsTopBar({
  index,
  total,
  stars,
  soundEnabled,
  onToggleSound,
  onLeave,
  dotClass = 'rounded-[50%] w-3 h-4 sm:w-3.5 sm:h-[18px]',
}: {
  index: number
  total: number
  stars: number
  soundEnabled: boolean
  onToggleSound: () => void
  onLeave: () => void
  dotClass?: string
}) {
  return (
    <div className="absolute inset-x-0 top-0 z-30 flex items-center gap-2 p-2 sm:p-3">
      <button
        type="button"
        onClick={onLeave}
        aria-label="விளையாட்டை விட்டு வெளியேறு · Leave the game"
        className="w-12 h-12 rounded-full bg-white/90 shadow-md flex items-center justify-center text-sky-800 active:scale-95"
      >
        <FiX className="w-6 h-6" />
      </button>
      <div className="flex-1 flex items-center justify-center gap-1 flex-wrap" aria-label={`கேள்வி ${Math.min(index + 1, total)} / ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`${dotClass} ${i < index ? 'bg-amber-400' : i === index ? 'bg-rose-500 ring-2 ring-white' : 'bg-white/70'}`} />
        ))}
      </div>
      <div
        className="flex items-center gap-1 rounded-full bg-white/90 shadow-md px-3 h-12 text-amber-600 font-extrabold text-xl tabular-nums"
        aria-label={`${stars} நட்சத்திரங்கள் · stars`}
      >
        <FiStar className="w-6 h-6 fill-amber-400" /> {stars}
      </div>
      <button
        type="button"
        onClick={onToggleSound}
        aria-label={soundEnabled ? 'ஒலியை நிறுத்து · Sound off' : 'ஒலி · Sound on'}
        className="w-12 h-12 rounded-full bg-white/90 shadow-md flex items-center justify-center text-sky-800 active:scale-95"
      >
        {soundEnabled ? <FiVolume2 className="w-6 h-6" /> : <FiVolumeX className="w-6 h-6" />}
      </button>
    </div>
  )
}

// The question at the top. `children` replaces the plain prompt text (the
// Missing Letter game puts its drop box inside the sentence). The card's
// bottom edge is reported so the play area can start below it.
export function KidsQuestionCard({
  question,
  soundEnabled,
  cardRef,
  children,
}: {
  question: KidsQuestionPayload
  soundEnabled: boolean
  cardRef?: RefObject<HTMLDivElement>
  children?: ReactNode
}) {
  const tamilVoice = useTamilVoice()
  const audioUrl = typeof question.payload.audioUrl === 'string' ? (question.payload.audioUrl as string) : null
  const audioRef = useRef<HTMLAudioElement>(null)

  // Listening questions play their clip as each question appears
  useEffect(() => {
    if (audioUrl && soundEnabled) audioRef.current?.play().catch(() => undefined)
  }, [audioUrl, soundEnabled])

  const speak = () => {
    if (!tamilVoice) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(question.prompt)
    u.voice = tamilVoice
    u.lang = tamilVoice.lang
    u.rate = 0.85
    window.speechSynthesis.speak(u)
  }

  return (
    <div className="absolute inset-x-0 top-16 sm:top-[72px] z-20 flex justify-center px-3">
      <div ref={cardRef} className="max-w-2xl w-full rounded-3xl bg-white/95 shadow-xl border-4 border-amber-300 px-4 py-3 sm:px-6 sm:py-4 flex items-center gap-3">
        <div data-kids-question className="flex-1 font-tamil text-lg sm:text-2xl font-bold text-slate-800 leading-snug text-center">{children ?? question.prompt}</div>
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
  )
}

// Where the question card ends, kept current (the card's height changes
// with each question), so the play area can start just below it.
export function useBelowCard(cardRef: RefObject<HTMLDivElement>, fallback = 160): number {
  const [top, setTop] = useState(fallback)
  useLayoutEffect(() => {
    const el = cardRef.current
    if (!el) return
    const update = () => setTop(Math.round(el.getBoundingClientRect().bottom + 8))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  })
  return top
}

export function PraiseBubble({ praise, top, reduced }: { praise: [string, string]; top: number; reduced: boolean }) {
  return (
    <div className="absolute inset-x-0 z-30 flex justify-center pointer-events-none px-4" style={{ top }}>
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
  )
}

// Shown next to the right answer after a wrong one
export function HereItIs() {
  return (
    <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 whitespace-nowrap rounded-full bg-white px-3 py-1 text-sm sm:text-base font-extrabold text-emerald-700 shadow-lg font-tamil z-10">
      👆 இதோ!<span className="hidden sm:inline"> · Here it is!</span>
    </span>
  )
}

export function KidsStartScreen({
  background,
  art,
  titleTa,
  titleEn,
  howTa,
  howEn,
  onStart,
  onExit,
  scenery,
}: {
  background: string
  art: ReactNode
  titleTa: string
  titleEn: string
  howTa: string
  howEn: string
  onStart: () => void
  onExit: () => void
  scenery?: ReactNode
}) {
  return (
    <div className={`fixed inset-0 overflow-hidden ${background} flex items-center justify-center p-4`}>
      {scenery}
      <div className="relative z-10 max-w-md w-full rounded-[2rem] bg-white/95 shadow-2xl border-4 border-amber-300 p-6 text-center">
        <div className="flex justify-center mb-2" aria-hidden>
          {art}
        </div>
        <h1 className="font-tamil text-3xl font-extrabold text-rose-600">{titleTa}</h1>
        <p className="text-xl font-bold text-sky-800">{titleEn}</p>
        <p className="font-tamil mt-3 text-lg text-slate-700">{howTa}</p>
        <p className="text-slate-600">{howEn}</p>
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

// Loading / error / results screens, the same for every kids' game.
// Returns null while the game itself should render.
export function KidsGameStates({
  error,
  hasSession,
  result,
  poll,
  background,
  loadingLabel,
  resultLine,
  fx,
  soundEnabled,
  reduced,
  onPlayAgain,
  onExit,
  onHome,
}: {
  error: string | null
  hasSession: boolean
  result: GameResult | null
  poll: () => void
  background: string
  loadingLabel: string
  resultLine: (correct: number) => string
  fx: RefObject<CelebrationHandle>
  soundEnabled: boolean
  reduced: boolean
  onPlayAgain?: () => void
  onExit: () => void
  onHome?: () => void
}) {
  if (error && !hasSession) return <GameV2Error description={error} onRetry={poll} />
  if (result) {
    return (
      <div className={`min-h-screen w-full ${background} px-4 py-8`}>
        <CelebrationLayer ref={fx} soundEnabled={soundEnabled} reducedMotion={reduced} fixed />
        <GameResultsScreen
          result={result}
          headline="நீ ஒரு நட்சத்திரம்! · You're a star!"
          subline={resultLine(result.correctCount)}
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
  if (!hasSession) return <GameV2Loading label={loadingLabel} />
  return null
}

// Shared wobble (wrong tap) and bounce (the right answer) animations
export function KidKeyframes() {
  return (
    <style>{`
      @keyframes kid-wobble { 0%,100% { transform: rotate(0) } 25% { transform: rotate(-12deg) } 75% { transform: rotate(12deg) } }
      @keyframes kid-bounce { 0%,100% { transform: scale(1) } 50% { transform: scale(1.12) } }
    `}</style>
  )
}

export function Cloud() {
  return (
    <div className="relative w-40 h-12">
      <span className="absolute left-0 bottom-0 w-40 h-10 rounded-full bg-white/90" />
      <span className="absolute left-6 bottom-3 w-16 h-16 rounded-full bg-white/90" />
      <span className="absolute left-16 bottom-4 w-20 h-20 rounded-full bg-white/90" />
    </div>
  )
}
