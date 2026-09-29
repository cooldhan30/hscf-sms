'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CelebrationLayer } from '@/components/gameRoomV2/celebration/CelebrationLayer'
import {
  useKidsGame,
  useBelowCard,
  KidsTopBar,
  KidsQuestionCard,
  KidsStartScreen,
  KidsGameStates,
  PraiseBubble,
  FitLabel,
  KidKeyframes,
  LABEL_SIZE,
} from '@/components/gameRoomV2/kids'
import { useDragTiles } from '@/components/gameRoomV2/kids/useDragTiles'
import { orderTiles, revealedOrder, labelSizeStep, KID_COLORS, type OrderTile } from '@/lib/gameRoomV2/kids'

// Letter Parade (எழுத்து ஊர்வலம்) -- Little Learners, ages 4-9. A smiling
// caterpillar has one empty body segment per letter; the child puts the
// scrambled letters on it in order, left to right -- tapping a letter fills
// the next empty segment, or it can be dragged onto a segment; tapping a
// filled segment sends its letter back. When every segment is full the
// order is checked (on the server, /answer). Also plays word ordering
// (sentence building). No timer, no lives.

const GARDEN = 'bg-gradient-to-b from-sky-200 via-lime-50 to-lime-100'
const CHECK_DELAY_MS = 650

export function LetterParadeGame({
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
  const g = useKidsGame({ sessionId, feedbackMs: { correct: 1900, wrong: 3400 } })
  const cardRef = useRef<HTMLDivElement>(null)
  const top = useBelowCard(cardRef)

  const q = g.shown?.question
  const tiles = q ? orderTiles(q) : []
  const words = q?.questionType === 'ORDER_WORDS'
  // slots[i] = key of the tile on segment i (left to right), or null
  const [slots, setSlots] = useState<(string | null)[]>([])
  const shownIndex = g.shown?.index
  const tileCount = tiles.length
  useEffect(() => setSlots(Array(tileCount).fill(null)), [shownIndex, tileCount])

  const segRefs = useRef<(HTMLButtonElement | null)[]>([])
  const bodyRef = useRef<HTMLDivElement>(null)
  const disabled = g.answering || !!g.feedback

  const putOn = useCallback((key: string, at?: number) => {
    setSlots((prev) => {
      const next = prev.map((k) => (k === key ? null : k))
      const i = at ?? next.indexOf(null)
      if (i === -1 || i >= next.length) return prev
      next[i] = key // a letter already there goes back to the tray
      return next
    })
  }, [])
  const takeOff = (i: number) => setSlots((prev) => prev.map((k, j) => (j === i ? null : k)))

  const { drag, handlers } = useDragTiles({
    disabled,
    onTap: (key) => putOn(key),
    onDrop: (key, point) => {
      const i = segRefs.current.findIndex((el) => {
        if (!el) return false
        const r = el.getBoundingClientRect()
        return point.x >= r.left - 16 && point.x <= r.right + 16 && point.y >= r.top - 24 && point.y <= r.bottom + 24
      })
      if (i === -1) return false
      putOn(key, i)
      return true
    },
  })

  // Every segment full: check the order (a moment's pause so the child sees it)
  const full = slots.length > 0 && slots.every(Boolean)
  const submitRef = useRef(g.submit)
  submitRef.current = g.submit
  useEffect(() => {
    if (!full || disabled) return
    const t = window.setTimeout(() => {
      const labels = slots.map((k) => tiles.find((x) => x.key === k)?.label ?? '')
      submitRef.current(labels, 'parade', bodyRef.current)
    }, CHECK_DELAY_MS)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full, disabled, slots])

  if (!g.started) {
    return (
      <KidsStartScreen
        background={GARDEN}
        scenery={<Garden />}
        art={<CaterpillarArt />}
        titleTa="எழுத்து ஊர்வலம்!"
        titleEn="Letter Parade"
        howTa="எழுத்துகளை வரிசையாகக் கம்பளிப்பூச்சியின் மேல் வை!"
        howEn="Put the letters on the caterpillar in the right order!"
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
    background: GARDEN,
    loadingLabel: 'கம்பளிப்பூச்சி வருகிறது... · The caterpillar is coming...',
    resultLine: (n) => `${n} வரிசைகளைச் சரியாக அமைத்தாய் · You made ${n} right parades`,
    fx: g.fx,
    soundEnabled: g.soundEnabled,
    reduced: g.reduced,
    onPlayAgain,
    onExit,
    onHome,
  })
  if (states || !g.session || !g.shown || !q) return states

  const correct = g.feedback?.kind === 'correct'
  const wrong = g.feedback?.kind === 'wrong'
  const rightOrder = wrong && g.feedback?.kind === 'wrong' ? revealedOrder(g.feedback.revealed, tiles, q.questionType) : null
  // What each segment shows: the child's letters, or the right order after a wrong try
  const shown = rightOrder ?? slots
  const onBody = new Set(slots.filter(Boolean) as string[])
  // Segments plus a head 1.2 segments wide use up to ~90% of a phone's width
  const segSize = words ? undefined : `min(${Math.floor((88 / (tiles.length + 1.2)) * 10) / 10}vw, 104px)`

  return (
    <div className={`fixed inset-0 overflow-hidden select-none touch-manipulation ${GARDEN}`}>
      <CelebrationLayer ref={g.fx} soundEnabled={g.soundEnabled} reducedMotion={g.reduced} fixed />
      <Garden />
      <KidsTopBar
        index={g.shown.index}
        total={g.session.totalQuestions}
        stars={g.stars}
        soundEnabled={g.soundEnabled}
        onToggleSound={g.toggleSound}
        onLeave={() => g.exit(onExit)}
      />
      <KidsQuestionCard question={q} soundEnabled={g.soundEnabled} cardRef={cardRef} />

      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center justify-evenly px-3 pb-[4vh]" style={{ top }}>
        {/* the caterpillar: segments left to right, head at the front (right) */}
        <div
          ref={bodyRef}
          className={`flex items-center justify-center ${words ? 'flex-wrap gap-y-3' : ''} max-w-full`}
          role="group"
          aria-label="கம்பளிப்பூச்சி · Caterpillar"
        >
          {shown.map((key, i) => {
            const tile = tiles.find((t) => t.key === key)
            const [fill, dark] = KID_COLORS[i % KID_COLORS.length]
            return (
              <button
                key={i}
                ref={(el) => {
                  segRefs.current[i] = el
                }}
                type="button"
                data-kids-segment
                disabled={disabled || !tile}
                onClick={() => takeOff(i)}
                aria-label={tile ? `${i + 1}: ${tile.label}` : `${i + 1}: காலி · empty`}
                className={`relative -mx-1 flex items-center justify-center rounded-full border-4 transition-colors ${
                  words ? 'min-w-[5.5rem] h-16 sm:h-20 px-4 rounded-[2rem]' : 'aspect-square'
                } ${
                  rightOrder
                    ? 'bg-emerald-100 border-emerald-500 border-dashed text-emerald-800'
                    : tile
                      ? 'text-white border-white/70'
                      : drag
                        ? 'bg-lime-100 border-lime-500 border-dashed'
                        : 'bg-lime-50 border-lime-400 border-dashed'
                } ${correct && !g.reduced ? 'animate-[kid-bounce_0.5s_ease-in-out_3]' : ''} ${wrong && !rightOrder ? 'animate-[kid-wobble_0.5s_ease-in-out_2]' : ''}`}
                style={{
                  width: segSize,
                  background: tile && !rightOrder ? fill : undefined,
                  boxShadow: tile && !rightOrder ? `inset 0 -6px 0 ${dark}` : undefined,
                  animationDelay: correct ? `${i * 90}ms` : undefined,
                  zIndex: shown.length - i,
                }}
              >
                {tile ? (
                  words ? (
                    <span className="font-tamil font-extrabold text-lg sm:text-2xl whitespace-nowrap">{tile.label}</span>
                  ) : (
                    <span className="w-[78%] h-[78%]">
                      <FitLabel className={`font-tamil font-extrabold leading-tight ${rightOrder ? '' : '[text-shadow:0_2px_0_rgba(0,0,0,0.3)]'} ${LABEL_SIZE[labelSizeStep(tile.label)]}`}>
                        {tile.label}
                      </FitLabel>
                    </span>
                  )
                ) : (
                  <span className="font-extrabold text-lime-500 text-lg">{i + 1}</span>
                )}
                {/* little legs */}
                {!words && <span className="absolute -bottom-3 left-[30%] w-1.5 h-3 rounded bg-lime-700" aria-hidden />}
                {!words && <span className="absolute -bottom-3 right-[30%] w-1.5 h-3 rounded bg-lime-700" aria-hidden />}
              </button>
            )
          })}
          <CaterpillarHead happy={correct} size={segSize} words={!!words} />
        </div>

        {rightOrder && (
          <p className="font-tamil rounded-full bg-white px-4 py-1.5 font-extrabold text-emerald-700 shadow">👆 இதோ சரியான வரிசை! · Here&apos;s the right order!</p>
        )}

        {/* the letters to place */}
        <div className="flex flex-wrap items-end justify-center gap-3 sm:gap-4 max-w-3xl min-h-[80px]" role="group" aria-label="எழுத்துகள் · Letters">
          {tiles.map((t: OrderTile, i) => {
            const [fill, dark] = KID_COLORS[(i + 2) % KID_COLORS.length]
            const used = onBody.has(t.key) || !!rightOrder
            const dragging = drag?.key === t.key
            return (
              <button
                key={t.key}
                type="button"
                data-kids-choice
                disabled={disabled || used}
                aria-label={t.label}
                {...handlers(t.key)}
                className={`relative touch-none rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400 ${used ? 'invisible' : ''} ${dragging ? 'z-50' : ''}`}
                style={{
                  width: words ? undefined : 'clamp(64px, 17vw, 112px)',
                  transform: dragging ? `translate(${drag.dx}px, ${drag.dy}px) scale(1.08)` : undefined,
                  transition: dragging ? 'none' : 'transform 250ms ease-out',
                }}
              >
                <span
                  className={`flex items-center justify-center rounded-2xl text-white ${words ? 'h-16 sm:h-20 px-5' : 'w-full aspect-square'}`}
                  style={{ background: fill, boxShadow: `0 6px 0 ${dark}` }}
                >
                  {words ? (
                    <span className="font-tamil font-extrabold text-lg sm:text-2xl whitespace-nowrap [text-shadow:0_2px_0_rgba(0,0,0,0.3)]">{t.label}</span>
                  ) : (
                    <span className="w-[80%] h-[80%]">
                      <FitLabel className={`font-tamil font-extrabold leading-tight [text-shadow:0_2px_0_rgba(0,0,0,0.3)] ${LABEL_SIZE[labelSizeStep(t.label)]}`}>{t.label}</FitLabel>
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
        <p className="font-tamil text-sm sm:text-base font-semibold text-lime-800/80 text-center">
          தொட்டு அல்லது இழுத்து வை · Tap or drag the letters on, in order
        </p>
      </div>

      {correct && <PraiseBubble praise={g.praise} top={top + 4} reduced={g.reduced} />}
      {g.submitError && (
        <div className="absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <p className="rounded-2xl bg-white/95 px-4 py-2 text-sm font-semibold text-rose-700 shadow">{g.submitError}</p>
        </div>
      )}
      <KidKeyframes />
    </div>
  )
}

function CaterpillarHead({ happy, size, words }: { happy: boolean; size?: string; words: boolean }) {
  return (
    <div className="relative -ml-1 shrink-0" style={{ width: words ? 76 : `calc(${size} * 1.2)` }} aria-hidden>
      <svg viewBox="0 0 100 110" className="w-full">
        {/* antennae */}
        <path d="M36 22 Q 28 4 18 6" stroke="#3f6212" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M64 22 Q 72 4 82 6" stroke="#3f6212" strokeWidth="4" fill="none" strokeLinecap="round" />
        <circle cx="18" cy="6" r="5" fill="#f43f5e" />
        <circle cx="82" cy="6" r="5" fill="#f43f5e" />
        {/* head */}
        <circle cx="50" cy="58" r="42" fill="#84cc16" />
        <circle cx="50" cy="58" r="42" fill="none" stroke="#4d7c0f" strokeWidth="4" />
        <circle cx="36" cy="50" r="9" fill="#ffffff" />
        <circle cx="64" cy="50" r="9" fill="#ffffff" />
        <circle cx="38" cy="51" r="4.5" fill="#1e293b" />
        <circle cx="66" cy="51" r="4.5" fill="#1e293b" />
        <circle cx="26" cy="68" r="6" fill="#fda4af" opacity="0.7" />
        <circle cx="74" cy="68" r="6" fill="#fda4af" opacity="0.7" />
        <path d={happy ? 'M34 70 Q 50 88 66 70' : 'M38 74 Q 50 82 62 74'} stroke="#1e293b" strokeWidth="4" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  )
}

function CaterpillarArt() {
  return (
    <div className="flex items-center">
      {['அ', 'ஆ', 'இ'].map((l, i) => (
        <span
          key={l}
          className="-mx-1 w-12 h-12 rounded-full flex items-center justify-center text-white font-tamil font-extrabold text-xl border-4 border-white/70"
          style={{ background: KID_COLORS[i][0], boxShadow: `inset 0 -5px 0 ${KID_COLORS[i][1]}` }}
        >
          {l}
        </span>
      ))}
      <CaterpillarHead happy size="48px" words={false} />
    </div>
  )
}

function Garden() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      <div className="absolute right-[7%] top-[18%] w-20 h-20 rounded-full bg-yellow-300 shadow-[0_0_50px_18px_rgba(253,224,71,0.5)]" />
      {[
        ['5%', '#f472b6'],
        ['16%', '#facc15'],
        ['80%', '#a78bfa'],
        ['92%', '#fb7185'],
      ].map(([left, color], i) => (
        <span key={i} className="absolute bottom-[5vh] w-8 h-8" style={{ left }}>
          <span className="absolute left-1/2 top-full -translate-x-1/2 w-1 h-[5vh] bg-green-600" />
          <span className="absolute inset-0 rounded-full" style={{ background: color, boxShadow: `0 0 0 6px ${color}55` }} />
          <span className="absolute inset-2 rounded-full bg-yellow-200" />
        </span>
      ))}
      <div className="absolute inset-x-0 bottom-0 h-[5vh] bg-gradient-to-b from-green-400 to-green-500" />
    </div>
  )
}
