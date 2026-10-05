'use client'

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { FiVolume2 } from 'react-icons/fi'
import { playSound } from '@/components/gameRoomV2/gameplay'
import type { CelebrationHandle } from '@/components/gameRoomV2/celebration/CelebrationLayer'
import { FitLabel, KidKeyframes, LABEL_SIZE, useNarrow, useSceneClock, useTamilVoice, type KidsQuestionPayload } from '@/components/gameRoomV2/kids'
import { KID_COLORS, labelSizeStep, PRAISE } from '@/lib/gameRoomV2/kids'
import { POINTS_PER_POP, popStream, popTarget, type Pop } from '@/lib/gameRoomV2/balloonPop/stream'
import { BalloonShape } from './BalloonShape'

// One "pop every <type>" round of Balloon Pop (a CATEGORIZE question).
// Balloons carrying every item -- the asked-for type and the others --
// keep floating up from the grass, one after another; the child pops the
// right ones. Each pop is checked by the server (/pop-check) for instant
// feedback; when the last balloon has floated away the round's pops go
// to /answer, which scores them. No timer, no lives: a missed balloon
// just floats away.

const SPAWN_MS = 1150
const RISE_MS = 8500

export interface RoundSummary {
  correct: number
  wrong: number
  missed: number
  points: number
  rightItems: string[]
  wrongItems: { item: string; category: string | null }[]
}

type BalloonState = 'flying' | 'checking' | 'right' | 'wrong' | 'gone'

export function PopRound({
  sessionId,
  index,
  question,
  top,
  cardRef,
  soundEnabled,
  reduced,
  fx,
  onPoints,
  onDone,
}: {
  sessionId: string
  index: number
  question: KidsQuestionPayload
  top: number
  cardRef: RefObject<HTMLDivElement>
  soundEnabled: boolean
  reduced: boolean
  fx: RefObject<CelebrationHandle>
  onPoints: (delta: number) => void
  onDone: (summary: RoundSummary) => void
}) {
  const items = useMemo(() => ((question.payload.items as string[]) ?? []).filter((x) => typeof x === 'string'), [question])
  const categories = useMemo(() => ((question.payload.categories as string[]) ?? []).filter((x) => typeof x === 'string'), [question])
  const target = popTarget(categories, index) ?? ''
  const stream = useMemo(() => popStream(items), [items])
  const narrow = useNarrow()
  // Stable per screen size: the scene clock restarts when its inputs change
  const lanes = useMemo(() => (narrow ? [18, 50, 82] : [12, 31, 50, 69, 88]), [narrow])

  const [states, setStates] = useState<BalloonState[]>(() => stream.map(() => 'flying'))
  const stateRef = useRef(states)
  stateRef.current = states
  const [tags, setTags] = useState<Record<number, string>>({})
  const [praise, setPraise] = useState<[string, string] | null>(null)
  const [ended, setEnded] = useState<RoundSummary | null>(null)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const popped = useRef<Pop[]>([])
  const pending = useRef(0)
  const local = useRef<RoundSummary>({ correct: 0, wrong: 0, missed: 0, points: 0, rightItems: [], wrongItems: [] })
  const submitted = useRef(false)
  const voice = useTamilVoice()

  const setState = (i: number, s: BalloonState) => setStates((prev) => (prev[i] === s ? prev : prev.map((x, j) => (j === i ? s : x))))

  // Lane per balloon: spread out, never the same lane twice in a row
  const laneOf = useMemo(() => {
    const out: number[] = []
    stream.forEach((_, i) => {
      let l = (i * 2 + Math.floor(i / lanes.length)) % lanes.length
      if (i > 0 && l === out[i - 1]) l = (l + 1) % lanes.length
      out.push(l)
    })
    return out
  }, [stream, lanes.length])

  useSceneClock(
    (t) => {
      stream.forEach((_, i) => {
        const el = refs.current[i]
        if (!el) return
        const age = t - i * SPAWN_MS
        const st = stateRef.current[i]
        if (age < 0) {
          el.style.visibility = 'hidden'
          return
        }
        const p = age / RISE_MS
        if (p >= 1 && st === 'flying') {
          setState(i, 'gone')
          return
        }
        if (st !== 'flying' && st !== 'checking' && st !== 'wrong') return
        const y = 108 - p * 135
        const sway = reduced ? 0 : Math.sin(age / 900 + i) * 2.5
        el.style.visibility = 'visible'
        el.style.left = `${lanes[laneOf[i]] + sway}%`
        el.style.top = `${y}%`
        el.style.transform = `translate(-50%, -50%) rotate(${reduced ? 0 : Math.sin(age / 700 + i) * 4}deg)`
      })
    },
    !!ended,
    [stream, reduced, lanes, laneOf, ended]
  )

  async function pop(i: number, el: HTMLElement) {
    if (stateRef.current[i] !== 'flying' || ended) return
    const b = stream[i]
    setState(i, 'checking')
    popped.current.push(b)
    pending.current++
    try {
      const res = await fetch(`/api/gameroom-v2/sessions/${sessionId}/pop-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionIndex: index, item: b.item }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || typeof data?.isTarget !== 'boolean') throw new Error()
      if (data.isTarget) {
        setState(i, 'right')
        local.current.correct++
        local.current.points += POINTS_PER_POP
        local.current.rightItems.push(b.item)
        onPoints(POINTS_PER_POP)
        const r = el.getBoundingClientRect()
        fx.current?.correct({ streak: local.current.correct, origin: { x: r.left + r.width / 2, y: r.top + r.height / 3 }, card: false })
        if (local.current.correct % 3 === 0) {
          setPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)])
          window.setTimeout(() => setPraise(null), 1200)
        }
      } else {
        setState(i, 'wrong')
        local.current.wrong++
        local.current.wrongItems.push({ item: b.item, category: data.category ?? null })
        if (data.category) setTags((t) => ({ ...t, [i]: data.category }))
        playSound('button', soundEnabled)
        window.setTimeout(() => setState(i, 'gone'), 1400)
      }
    } catch {
      // The server still scores this pop with the round; just let it go
      setState(i, 'gone')
    } finally {
      pending.current--
    }
  }

  // Round over once every balloon has been popped or floated away
  const allDone = states.every((s) => s === 'right' || s === 'gone')
  useEffect(() => {
    if (!allDone || submitted.current) return
    const wait = window.setInterval(async () => {
      if (pending.current > 0 || submitted.current) return
      submitted.current = true
      window.clearInterval(wait)
      let summary: RoundSummary = { ...local.current, missed: 0 }
      try {
        const res = await fetch(`/api/gameroom-v2/sessions/${sessionId}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionIndex: index, answer: { popped: popped.current } }),
        })
        const data = await res.json().catch(() => null)
        // The server's count is the one that counts
        if (res.ok && data?.pops) {
          summary = { ...summary, correct: data.pops.correct, wrong: data.pops.wrong, missed: data.pops.missed, points: typeof data.points === 'number' ? data.points : summary.points }
        }
      } catch {
        // /state will show where the game really is
      }
      setEnded(summary)
      window.setTimeout(() => onDone(summary), 2600)
    }, 150)
    return () => window.clearInterval(wait)
  }, [allDone, index, sessionId, onDone])

  function speak() {
    if (!soundEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const u = new SpeechSynthesisUtterance(`${target} பலூன்களை உடை!`)
    u.lang = 'ta-IN'
    if (voice) u.voice = voice
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  }
  useEffect(() => {
    speak()
    // Once per round
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, voice])

  const width = narrow ? 'w-[clamp(78px,24vw,110px)]' : 'w-[clamp(90px,11vw,150px)]'

  return (
    <>
      {/* What to pop */}
      <div ref={cardRef} className="absolute inset-x-0 top-16 sm:top-[72px] z-20 flex justify-center px-3">
        <div className="max-w-xl w-full rounded-3xl bg-white/95 shadow-xl border-4 border-white px-4 py-3 flex items-center gap-3">
          <span className="w-12 shrink-0" aria-hidden>
            <BalloonShape fill={KID_COLORS[0][0]} dark={KID_COLORS[0][1]} glow={false} />
          </span>
          <p className="flex-1 min-w-0 text-center">
            <span className="block font-tamil font-extrabold text-sky-900 text-2xl sm:text-3xl leading-snug">
              <span className="text-rose-600">{target}</span> பலூன்களை உடை!
            </span>
            <span className="block text-sm sm:text-base font-semibold text-sky-800/80">
              Pop every <span className="font-tamil">{target}</span> balloon!
            </span>
          </p>
          <button
            type="button"
            onClick={speak}
            aria-label="மீண்டும் கேள் · Hear it again"
            className="w-12 h-12 shrink-0 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center active:scale-95"
          >
            <FiVolume2 className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div
        className="absolute inset-x-0 bottom-0 z-10 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent_0,black_48px)]"
        style={{ top }}
        role="group"
        aria-label={`${target} பலூன்கள் · Balloons`}
      >
        {stream.map((b, i) => {
          const st = states[i]
          if (st === 'gone' && !tags[i]) return null
          const [fill, dark] = KID_COLORS[(i * 5) % KID_COLORS.length]
          return (
            <button
              key={`${b.item}#${b.copy}`}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              data-kids-choice
              data-pop-item={b.item}
              disabled={st !== 'flying' || !!ended}
              onClick={(e) => pop(i, e.currentTarget)}
              aria-label={b.item}
              className={`absolute ${width} aspect-[5/7] focus-visible:outline-none focus-visible:[&_svg]:drop-shadow-[0_0_10px_white] ${st === 'right' || st === 'gone' ? 'pointer-events-none' : ''}`}
              style={{ left: `${lanes[laneOf[i]]}%`, top: '110%', transform: 'translate(-50%, -50%)', visibility: 'hidden' }}
            >
              <span
                className={`relative block w-full h-full transition-[transform,opacity] duration-300 ${
                  st === 'right' ? 'scale-150 opacity-0' : st === 'wrong' ? 'opacity-60 animate-[kid-wobble_0.5s_ease-in-out_2]' : st === 'gone' ? 'opacity-0' : ''
                }`}
              >
                <BalloonShape fill={fill} dark={dark} glow={false} />
                <span className="absolute inset-x-[8%] top-[6%] h-[58%] flex items-center justify-center text-center">
                  <FitLabel className={`font-tamil font-extrabold text-white leading-tight [text-shadow:0_2px_0_rgba(0,0,0,0.35)] ${LABEL_SIZE[labelSizeStep(b.item)]}`}>
                    {b.item}
                  </FitLabel>
                </span>
              </span>
              {st === 'right' && (
                <span className="absolute left-1/2 top-1/3 -translate-x-1/2 text-2xl sm:text-3xl font-extrabold text-amber-500 [text-shadow:0_2px_0_white] animate-[pop-plus_0.9s_ease-out_both]" aria-hidden>
                  +{POINTS_PER_POP}
                </span>
              )}
              {st === 'wrong' && tags[i] && (
                <span className="absolute left-1/2 -bottom-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-3 py-1 text-sm font-bold text-sky-900 shadow font-tamil">
                  {tags[i]}
                </span>
              )}
            </button>
          )
        })}
        <KidKeyframes />
        <style>{`@keyframes pop-plus { from { transform: translate(-50%, 0) scale(.6); opacity: 0 } 30% { opacity: 1 } to { transform: translate(-50%, -70px) scale(1.1); opacity: 0 } }`}</style>
      </div>

      {praise && !ended && (
        <div className="absolute inset-x-0 z-30 flex justify-center pointer-events-none px-4" style={{ top: top + 16 }}>
          <p aria-live="polite" className="rounded-full bg-emerald-500 text-white shadow-xl border-4 border-white px-6 py-2 text-2xl sm:text-3xl font-extrabold">
            <span className="font-tamil">{praise[0]}</span> {praise[1]} ⭐
          </p>
        </div>
      )}

      {ended && (
        <div className="absolute inset-0 z-40 flex items-center justify-center px-4 bg-sky-900/20">
          <div className="max-w-sm w-full rounded-3xl bg-white shadow-2xl border-4 border-white p-6 text-center" role="status" aria-live="polite">
            <p className="font-tamil text-2xl font-extrabold text-sky-900">{ended.correct > 0 ? 'சூப்பர்!' : 'நன்று முயற்சி!'}</p>
            <p className="text-sm font-semibold text-sky-800/80 mb-4">{ended.correct > 0 ? 'Super popping!' : 'Good try!'}</p>
            <div className="grid grid-cols-3 gap-2">
              <RoundStat value={ended.correct} ta="சரி" en="Right" tone="text-emerald-600" />
              <RoundStat value={ended.wrong} ta="தவறு" en="Wrong" tone="text-rose-600" />
              <RoundStat value={ended.missed} ta="தவறவிட்டவை" en="Missed" tone="text-sky-700" />
            </div>
            <p className="mt-4 text-2xl font-extrabold text-amber-500 tabular-nums">+{ended.points} ⭐</p>
          </div>
        </div>
      )}
    </>
  )
}

function RoundStat({ value, ta, en, tone }: { value: number; ta: string; en: string; tone: string }) {
  return (
    <div className="rounded-2xl bg-sky-50 py-2">
      <p className={`text-3xl font-extrabold tabular-nums ${tone}`}>{value}</p>
      <p className="font-tamil text-xs font-semibold text-sky-900 leading-tight">{ta}</p>
      <p className="text-[11px] text-sky-800/70">{en}</p>
    </div>
  )
}
