'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CelebrationLayer } from '@/components/gameRoomV2/celebration/CelebrationLayer'
import {
  useKidsGame,
  useBelowCard,
  KidsTopBar,
  KidsQuestionCard,
  KidsStartScreen,
  KidsGameStates,
  PraiseBubble,
  HereItIs,
  FitLabel,
  KidKeyframes,
  LABEL_SIZE,
} from '@/components/gameRoomV2/kids'
import { useDragTiles, pointInside } from '@/components/gameRoomV2/kids/useDragTiles'
import { choiceOptions, isRevealedAnswer, labelSizeStep, splitAtBlank, KID_COLORS, type ChoiceOption } from '@/lib/gameRoomV2/kids'

// Missing Letter (விடுபட்ட எழுத்து) -- Little Learners, ages 4-9. Many
// questions already have a gap in them ("அ, ஆ, இ, ___"); the gap becomes a
// dashed box and the answers become toy letter blocks. The child drags the
// right block into the gap -- or just taps it. Questions without a gap get
// a box of their own under the question. Grading stays on the server.

const PAPER = 'bg-gradient-to-b from-amber-100 via-yellow-50 to-orange-50'

export function MissingLetterGame({
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
  const g = useKidsGame({ sessionId, feedbackMs: { correct: 1600, wrong: 3000 } })
  const cardRef = useRef<HTMLDivElement>(null)
  const top = useBelowCard(cardRef)
  const dropRef = useRef<HTMLSpanElement>(null)
  // The block sitting in the gap right now (while it's being checked)
  const [placed, setPlaced] = useState<string | null>(null)
  // Every question starts with an empty gap (block keys repeat per question)
  const shownIndex = g.shown?.index
  useEffect(() => setPlaced(null), [shownIndex])

  const shownQuestion = g.shown?.question
  const options = useMemo(() => (shownQuestion ? choiceOptions(shownQuestion) : []), [shownQuestion])
  const place = useCallback(
    (key: string, el: HTMLElement) => {
      const o = options.find((x) => x.key === key)
      if (!o) return
      setPlaced(key)
      g.submit(o.answer, key, dropRef.current ?? el).then((r) => {
        // A wrong block goes back to the tray; the right one is shown instead
        if (!r?.isCorrect) setPlaced(null)
      })
    },
    [options, g]
  )
  const disabled = g.answering || !!g.feedback
  const { drag, handlers } = useDragTiles({
    disabled,
    onTap: place,
    onDrop: (key, point, el) => {
      if (!pointInside(dropRef.current, point)) return false
      place(key, el)
      return true
    },
  })

  if (!g.started) {
    return (
      <KidsStartScreen
        background={PAPER}
        scenery={<Doodles />}
        art={
          <div className="flex items-center gap-2 text-4xl font-tamil font-extrabold">
            {['அ', '?', 'இ'].map((l, i) => (
              <span
                key={i}
                className={`w-14 h-14 rounded-xl flex items-center justify-center ${i === 1 ? 'border-4 border-dashed border-sky-500 text-sky-500' : 'text-white shadow-[0_5px_0_rgba(0,0,0,0.2)]'}`}
                style={i === 1 ? undefined : { background: KID_COLORS[i][0] }}
              >
                {l}
              </span>
            ))}
          </div>
        }
        titleTa="விடுபட்ட எழுத்து!"
        titleEn="Missing Letter"
        howTa="சரியான எழுத்தை இழுத்துக் கட்டத்தில் வை!"
        howEn="Drag the right letter into the gap -- or just tap it!"
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
    background: PAPER,
    loadingLabel: 'எழுத்துக் கட்டைகள் தயாராகின்றன... · Getting the letter blocks ready...',
    resultLine: (n) => `${n} இடைவெளிகளைச் சரியாக நிரப்பினாய் · You filled ${n} gaps right`,
    fx: g.fx,
    soundEnabled: g.soundEnabled,
    reduced: g.reduced,
    onPlayAgain,
    onExit,
    onHome,
  })
  if (states || !g.session || !g.shown) return states

  const q = g.shown.question
  const parts = splitAtBlank(q.prompt)
  const correctKey = g.feedback?.kind === 'correct' ? g.feedback.key : null
  const revealKey = g.feedback?.kind === 'wrong' ? (options.find((o) => isRevealedAnswer(o, g.feedback?.kind === 'wrong' ? g.feedback.revealed : null))?.key ?? null) : null
  // In the gap: the block being checked, the right answer after a correct
  // drop, or (after a wrong one) the right answer shown in green
  const inGap = options.find((o) => o.key === (correctKey ?? placed ?? revealKey)) ?? null

  const gap = (
    <DropGap
      gapRef={dropRef}
      option={inGap}
      state={correctKey ? 'correct' : revealKey ? 'reveal' : drag ? 'target' : 'empty'}
      big={!parts}
      reduced={g.reduced}
    />
  )

  return (
    <div className={`fixed inset-0 overflow-hidden select-none touch-manipulation ${PAPER}`}>
      <CelebrationLayer ref={g.fx} soundEnabled={g.soundEnabled} reducedMotion={g.reduced} fixed />
      <Doodles />
      <KidsTopBar
        index={g.shown.index}
        total={g.session.totalQuestions}
        stars={g.stars}
        soundEnabled={g.soundEnabled}
        onToggleSound={g.toggleSound}
        onLeave={() => g.exit(onExit)}
      />
      <KidsQuestionCard question={q} soundEnabled={g.soundEnabled} cardRef={cardRef}>
        {parts ? (
          <>
            {parts.before}
            {gap}
            {parts.after}
          </>
        ) : undefined}
      </KidsQuestionCard>

      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center justify-evenly px-3 pb-[4vh]" style={{ top }}>
        {/* no gap in the question: the box sits here */}
        {!parts && gap}
        <div className="flex flex-wrap items-end justify-center gap-3 sm:gap-5 max-w-3xl" role="group" aria-label="எழுத்துக் கட்டைகள் · Letter blocks">
          {options.map((o, i) => {
            const [fill, dark] = KID_COLORS[i % KID_COLORS.length]
            const hidden = o.key === placed || o.key === correctKey
            const wrong = g.feedback?.kind === 'wrong' && g.feedback.key === o.key
            const reveal = revealKey === o.key
            const dragging = drag?.key === o.key
            return (
              <button
                key={o.key}
                type="button"
                data-kids-choice
                disabled={disabled}
                aria-label={o.label || `கட்டை ${i + 1} · Block ${i + 1}`}
                {...handlers(o.key)}
                className={`relative touch-none rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400 ${hidden ? 'invisible' : ''} ${dragging ? 'z-50' : reveal ? 'z-20' : ''}`}
                style={{
                  width: o.imageUrl || o.label.length <= 2 ? 'clamp(76px, 19vw, 130px)' : 'clamp(110px, 30vw, 220px)',
                  transform: dragging ? `translate(${drag.dx}px, ${drag.dy}px) scale(1.08)` : undefined,
                  transition: dragging ? 'none' : 'transform 250ms ease-out',
                }}
              >
                <span
                  className={`flex items-center justify-center w-full aspect-square rounded-2xl text-white ${o.imageUrl || o.label.length <= 2 ? '' : '!aspect-[2/1]'} ${
                    wrong ? 'opacity-45 animate-[kid-wobble_0.5s_ease-in-out_2]' : ''
                  } ${reveal && !g.reduced ? 'animate-[kid-bounce_0.7s_ease-in-out_infinite]' : ''} ${
                    reveal ? 'ring-4 ring-yellow-300 shadow-[0_0_24px_rgba(250,204,21,0.9)]' : ''
                  }`}
                  style={{ background: fill, boxShadow: `0 7px 0 ${dark}` }}
                >
                  {o.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- question-set image, arbitrary Storage URL
                    <img src={o.imageUrl} alt={o.label} className="w-[84%] h-[84%] object-cover rounded-xl" draggable={false} />
                  ) : (
                    <span className="w-[86%] h-[80%]">
                      <FitLabel className={`font-tamil font-extrabold leading-tight [text-shadow:0_2px_0_rgba(0,0,0,0.3)] ${LABEL_SIZE[labelSizeStep(o.label)]}`}>{o.label}</FitLabel>
                    </span>
                  )}
                </span>
                {reveal && <HereItIs />}
              </button>
            )
          })}
        </div>
        <p className="font-tamil text-sm sm:text-base font-semibold text-amber-800/80 text-center">இழுத்து வை அல்லது தொடு · Drag it in, or just tap it</p>
      </div>

      {g.feedback?.kind === 'correct' && <PraiseBubble praise={g.praise} top={top + 8} reduced={g.reduced} />}
      {g.submitError && (
        <div className="absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <p className="rounded-2xl bg-white/95 px-4 py-2 text-sm font-semibold text-rose-700 shadow">{g.submitError}</p>
        </div>
      )}
      <KidKeyframes />
    </div>
  )
}

// The gap: dashed while empty, glowing while a block is dragged, green
// with the letter when right, and green-dashed with the right answer after
// a wrong try.
function DropGap({
  gapRef,
  option,
  state,
  big,
  reduced,
}: {
  gapRef: React.RefObject<HTMLSpanElement>
  option: ChoiceOption | null
  state: 'empty' | 'target' | 'correct' | 'reveal'
  big: boolean
  reduced: boolean
}) {
  const size = big ? 'w-[clamp(110px,30vw,190px)] h-[clamp(96px,24vw,150px)] text-6xl' : 'min-w-[2.6em] h-[1.9em] mx-1 align-middle text-[1.5em]'
  const look =
    state === 'correct'
      ? 'bg-emerald-500 border-emerald-600 text-white border-solid'
      : state === 'reveal'
        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 border-dashed'
        : state === 'target'
          ? `bg-sky-100 border-sky-500 text-sky-500 border-dashed ${reduced ? '' : 'animate-pulse'}`
          : 'bg-white border-sky-400 text-sky-400 border-dashed'
  return (
    <span
      ref={gapRef}
      aria-label={option ? option.label : 'இடைவெளி · The gap'}
      className={`inline-flex items-center justify-center rounded-xl border-4 font-tamil font-extrabold px-2 transition-colors ${size} ${look}`}
    >
      {option ? (
        option.imageUrl ? (
          '🖼️'
        ) : big ? (
          <span className="w-[88%] h-[80%]">
            <FitLabel className={`font-tamil font-extrabold leading-tight ${LABEL_SIZE[labelSizeStep(option.label)]}`}>{option.label}</FitLabel>
          </span>
        ) : (
          option.label
        )
      ) : (
        '?'
      )}
    </span>
  )
}

function Doodles() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {[
        ['6%', '26%', '⭐', 'text-4xl'],
        ['88%', '22%', '✏️', 'text-4xl'],
        ['4%', '88%', '📚', 'text-4xl'],
        ['86%', '74%', '🌈', 'text-5xl'],
      ].map(([left, top, e, size], i) => (
        <span key={i} className={`absolute opacity-40 ${size}`} style={{ left, top }}>
          {e}
        </span>
      ))}
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(251,191,36,0.18)_1.5px,transparent_1.5px)] [background-size:26px_26px]" />
    </div>
  )
}
