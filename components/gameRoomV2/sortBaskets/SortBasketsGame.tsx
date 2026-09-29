'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CelebrationLayer } from '@/components/gameRoomV2/celebration/CelebrationLayer'
import {
  useKidsGame,
  useBelowCard,
  useDragTiles,
  pointInside,
  KidsTopBar,
  KidsQuestionCard,
  KidsStartScreen,
  KidsGameStates,
  PraiseBubble,
  KidKeyframes,
} from '@/components/gameRoomV2/kids'
import { sortItems, sortCategories, revealedSorting, KID_COLORS } from '@/lib/gameRoomV2/kids'

// Sort the Baskets (கூடையில் போடு) -- Little Learners, ages 4-9. Each
// CATEGORIZE question is one round: the items sit in a pile, the baskets
// are labelled with the categories (உயர்திணை / அஃறிணை, உயிர் / மெய் ...).
// Drag an item into a basket -- or tap the item, then tap the basket.
// Sorted items show as chips in their basket; tap a chip to take it back.
// When everything is sorted the round is checked on the server (all or
// nothing); a wrong round shows the right sorting in green.

const MARKET = 'bg-gradient-to-b from-orange-100 via-amber-50 to-lime-100'
const CHECK_DELAY_MS = 700
const BASKET_COLORS = ['#f97316', '#3b82f6', '#a855f7', '#10b981']

export function SortBasketsGame({
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
  const g = useKidsGame({ sessionId, feedbackMs: { correct: 1900, wrong: 3800 } })
  const cardRef = useRef<HTMLDivElement>(null)
  const top = useBelowCard(cardRef)
  const q = g.shown?.question
  const items = useMemo(() => (q ? sortItems(q) : []), [q])
  const baskets = useMemo(() => (q ? sortCategories(q) : []), [q])

  // item key -> basket index
  const [placed, setPlaced] = useState<Record<string, number>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const shownIndex = g.shown?.index
  useEffect(() => {
    setPlaced({})
    setSelected(null)
  }, [shownIndex])

  const basketRefs = useRef<(HTMLButtonElement | null)[]>([])
  const disabled = g.answering || !!g.feedback
  const put = (key: string, basket: number) => {
    setPlaced((p) => ({ ...p, [key]: basket }))
    setSelected(null)
  }
  const { drag, handlers } = useDragTiles({
    disabled,
    // Tap an item to pick it up (tap it again to put it down)
    onTap: (key) => setSelected((s) => (s === key ? null : key)),
    onDrop: (key, point) => {
      const b = basketRefs.current.findIndex((el) => pointInside(el, point, 20))
      if (b === -1) return false
      put(key, b)
      return true
    },
  })

  // Everything sorted: check the round
  const full = items.length > 0 && items.every((it) => placed[it.key] !== undefined)
  const submitRef = useRef(g.submit)
  submitRef.current = g.submit
  const areaRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!full || disabled) return
    const t = window.setTimeout(() => {
      const answer: Record<string, string> = {}
      for (const it of items) answer[it.label] = baskets[placed[it.key]]
      submitRef.current(answer, 'sort', areaRef.current)
    }, CHECK_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [full, disabled, items, baskets, placed])

  if (!g.started) {
    return (
      <KidsStartScreen
        background={MARKET}
        scenery={<Stall />}
        art={
          <div className="flex items-end gap-3">
            <Basket color={BASKET_COLORS[0]} className="w-20" />
            <Basket color={BASKET_COLORS[1]} className="w-20" />
          </div>
        }
        titleTa="கூடையில் போடு!"
        titleEn="Sort the Baskets"
        howTa="ஒவ்வொன்றையும் சரியான கூடையில் போடு!"
        howEn="Put each one in the right basket -- drag it, or tap it then tap the basket!"
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
    background: MARKET,
    loadingLabel: 'கூடைகள் தயாராகின்றன... · Getting the baskets ready...',
    resultLine: (n) => `${n} சுற்றுகளைச் சரியாக வகைப்படுத்தினாய் · You sorted ${n} rounds right`,
    fx: g.fx,
    soundEnabled: g.soundEnabled,
    reduced: g.reduced,
    onPlayAgain,
    onExit,
    onHome,
  })
  if (states || !g.session || !g.shown || !q) return states

  const correct = g.feedback?.kind === 'correct'
  const reveal = g.feedback?.kind === 'wrong' ? revealedSorting(g.feedback.revealed, items, baskets) : null
  const where = reveal ?? placed
  const pile = items.filter((it) => where[it.key] === undefined)

  return (
    <div className={`fixed inset-0 overflow-hidden select-none touch-manipulation ${MARKET}`}>
      <CelebrationLayer ref={g.fx} soundEnabled={g.soundEnabled} reducedMotion={g.reduced} fixed />
      <Stall />
      <KidsTopBar
        index={g.shown.index}
        total={g.session.totalQuestions}
        stars={g.stars}
        soundEnabled={g.soundEnabled}
        onToggleSound={g.toggleSound}
        onLeave={() => g.exit(onExit)}
      />
      <KidsQuestionCard question={q} soundEnabled={g.soundEnabled} cardRef={cardRef} />

      <div ref={areaRef} className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center justify-between px-2 pt-2 pb-[3vh]" style={{ top }}>
        {/* the pile of things to sort */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 max-w-3xl min-h-[64px]" role="group" aria-label="வகைப்படுத்த வேண்டியவை · Things to sort">
          {pile.map((it, i) => {
            const [fill, dark] = KID_COLORS[i % KID_COLORS.length]
            const isSel = selected === it.key
            const dragging = drag?.key === it.key
            return (
              <button
                key={it.key}
                type="button"
                data-kids-choice
                disabled={disabled}
                aria-label={it.label}
                aria-pressed={isSel}
                {...handlers(it.key)}
                className={`touch-none rounded-2xl px-4 h-14 sm:h-16 min-w-[4.5rem] font-tamil font-extrabold text-lg sm:text-2xl text-white whitespace-nowrap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400 ${
                  dragging ? 'z-50' : ''
                }`}
                style={{
                  background: fill,
                  // The selection ring lives in the same box-shadow as the 3D edge
                  // (an inline shadow would hide a Tailwind ring class)
                  boxShadow: isSel ? `0 0 0 5px #fde047, 0 10px 0 ${dark}` : `0 6px 0 ${dark}`,
                  transform: dragging ? `translate(${drag.dx}px, ${drag.dy}px) scale(1.08)` : isSel ? 'translateY(-8px) scale(1.06)' : undefined,
                  transition: dragging ? 'none' : 'transform 220ms ease-out',
                  textShadow: '0 2px 0 rgba(0,0,0,0.25)',
                }}
              >
                {it.label}
              </button>
            )
          })}
          {pile.length === 0 && !g.feedback && <p className="font-tamil font-bold text-amber-800">சரிபார்க்கிறோம்... · Checking...</p>}
        </div>

        {selected && <p className="font-tamil text-sm sm:text-base font-bold text-amber-800">இப்போது ஒரு கூடையைத் தொடு · Now tap a basket</p>}
        {reveal && (
          <p className="font-tamil rounded-full bg-white px-4 py-1.5 font-extrabold text-emerald-700 shadow">👆 இதோ சரியான வகைகள்! · Here&apos;s the right sorting!</p>
        )}

        {/* the baskets */}
        <div className="grid w-full max-w-4xl gap-2 sm:gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(1, baskets.length)}, minmax(0, 1fr))` }}>
          {baskets.map((cat, b) => {
            const inside = items.filter((it) => where[it.key] === b)
            const color = BASKET_COLORS[b % BASKET_COLORS.length]
            return (
              <button
                key={cat}
                ref={(el) => {
                  basketRefs.current[b] = el
                }}
                type="button"
                disabled={disabled || !selected}
                onClick={() => selected && put(selected, b)}
                aria-label={`கூடை: ${cat} · Basket: ${cat}`}
                data-kids-basket
                className={`relative flex flex-col items-center rounded-3xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400 ${
                  selected || drag ? 'ring-4 ring-sky-300 ring-offset-2 ring-offset-transparent' : ''
                } ${correct && !g.reduced ? 'animate-[kid-bounce_0.5s_ease-in-out_3]' : ''}`}
              >
                {/* what's in it */}
                <span className="flex flex-wrap-reverse justify-center gap-1 min-h-[44px] px-1 mb-[-10px] z-10">
                  {inside.map((it) => (
                    <span
                      key={it.key}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!disabled) setPlaced((p) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== it.key)))
                      }}
                      className={`rounded-xl px-2 py-1 font-tamil font-extrabold text-sm sm:text-base shadow ${
                        reveal ? 'bg-emerald-100 text-emerald-800 border-2 border-dashed border-emerald-500' : 'bg-white text-slate-800'
                      } ${g.feedback?.kind === 'wrong' && !reveal ? 'animate-[kid-wobble_0.5s_ease-in-out_2]' : ''}`}
                    >
                      {it.label}
                    </span>
                  ))}
                </span>
                <Basket color={color} className="w-full max-w-[220px]" />
                <span className="absolute bottom-[14%] inset-x-[12%] rounded-xl bg-white/90 px-1 py-1 font-tamil font-extrabold text-sm sm:text-xl text-slate-800 leading-tight break-words">
                  {cat}
                </span>
              </button>
            )
          })}
        </div>
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

function Basket({ color, className }: { color: string; className?: string }) {
  return (
    <svg viewBox="0 0 160 110" className={className} aria-hidden>
      <path d="M40 30 Q 80 -8 120 30" stroke={color} strokeWidth="8" fill="none" strokeLinecap="round" />
      <path d="M8 30 H152 L136 104 H24 Z" fill={color} />
      <path d="M8 30 H152" stroke="#78350f" strokeWidth="6" strokeLinecap="round" opacity="0.5" />
      <path d="M20 50 H140 M24 70 H136 M28 88 H132" stroke="#ffffff" strokeWidth="3" opacity="0.35" />
      <path d="M44 34 L50 100 M80 34 V102 M116 34 L110 100" stroke="#ffffff" strokeWidth="3" opacity="0.35" />
    </svg>
  )
}

function Stall() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      <div className="absolute inset-x-0 top-0 h-[64px] bg-[repeating-linear-gradient(90deg,#fb923c_0_40px,#fef3c7_40px_80px)] opacity-70" />
      <div className="absolute inset-x-0 bottom-0 h-[6vh] bg-gradient-to-b from-lime-400 to-lime-500" />
    </div>
  )
}
