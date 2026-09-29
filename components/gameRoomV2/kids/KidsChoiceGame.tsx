'use client'

import { useRef, type ReactNode } from 'react'
import { CelebrationLayer } from '@/components/gameRoomV2/celebration/CelebrationLayer'
import { choiceOptions, type ChoiceOption } from '@/lib/gameRoomV2/kids'
import { useKidsGame, type KidsFeedback, type KidsQuestionPayload } from './useKidsGame'
import { KidsTopBar, KidsQuestionCard, KidsStartScreen, KidsGameStates, PraiseBubble, useBelowCard } from './KidsUI'
import { ChoiceGrid, type TargetState } from './ChoiceGrid'

// The frame shared by the Little Learners "tap the right one" scenes whose
// targets stay put (Frog Jump, Busy Bee, Dinosaur Egg, Ice Cream Shop,
// Treasure Hunt, Build a House): start screen, loading/results, top bar,
// question card, praise and errors. A game supplies its scene, how a
// target looks, and a "stage" -- the character or reward that reacts
// (the frog, the bee, the growing house...).

export interface StageProps {
  stars: number
  index: number
  total: number
  feedback: KidsFeedback
  reduced: boolean
  // Where the child's tapped target is (so the frog/bee can go there)
  targetRect: DOMRect | null
  question: KidsQuestionPayload
  sessionId: string
  soundEnabled: boolean
}

export function KidsChoiceGame({
  sessionId,
  onExit,
  onPlayAgain,
  onHome,
  background,
  resultBackground,
  scenery,
  startArt,
  titleTa,
  titleEn,
  howTa,
  howEn,
  loadingLabel,
  resultLine,
  gridLabel,
  renderTarget,
  targetWidth,
  phoneTargetWidth,
  stage,
  stagePosition = 'above',
  feedbackMs,
  bob,
  questionContent,
}: {
  sessionId: string
  onExit: () => void
  onPlayAgain?: () => void
  onHome?: () => void
  background: string
  resultBackground: string
  scenery: (reduced: boolean) => ReactNode
  startArt: ReactNode
  titleTa: string
  titleEn: string
  howTa: string
  howEn: string
  loadingLabel: string
  resultLine: (correct: number) => string
  gridLabel: string
  renderTarget: (o: ChoiceOption, i: number, state: TargetState) => ReactNode
  targetWidth?: string
  phoneTargetWidth?: string
  stage?: (p: StageProps) => ReactNode
  stagePosition?: 'above' | 'below'
  feedbackMs?: { correct: number; wrong: number }
  bob?: boolean
  // Replaces the prompt text in the question card (Listen & Choose)
  questionContent?: (q: KidsQuestionPayload) => ReactNode
}) {
  const g = useKidsGame({ sessionId, feedbackMs })
  const cardRef = useRef<HTMLDivElement>(null)
  const top = useBelowCard(cardRef)
  const pickedRect = useRef<DOMRect | null>(null)

  if (!g.started) {
    return (
      <KidsStartScreen
        background={background}
        scenery={scenery(true)}
        art={startArt}
        titleTa={titleTa}
        titleEn={titleEn}
        howTa={howTa}
        howEn={howEn}
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
    background: resultBackground,
    loadingLabel,
    resultLine,
    fx: g.fx,
    soundEnabled: g.soundEnabled,
    reduced: g.reduced,
    onPlayAgain,
    onExit,
    onHome,
  })
  if (states || !g.session || !g.shown) return states

  const stageNode = stage?.({
    stars: g.stars,
    index: g.shown.index,
    total: g.session.totalQuestions,
    feedback: g.feedback,
    reduced: g.reduced,
    targetRect: g.feedback ? pickedRect.current : null,
    question: g.shown.question,
    sessionId,
    soundEnabled: g.soundEnabled,
  })

  return (
    <div className={`fixed inset-0 overflow-hidden select-none touch-manipulation ${background}`}>
      <CelebrationLayer ref={g.fx} soundEnabled={g.soundEnabled} reducedMotion={g.reduced} fixed />
      {scenery(g.reduced)}
      <KidsTopBar
        index={g.shown.index}
        total={g.session.totalQuestions}
        stars={g.stars}
        soundEnabled={g.soundEnabled}
        onToggleSound={g.toggleSound}
        onLeave={() => g.exit(onExit)}
      />
      <KidsQuestionCard question={g.shown.question} soundEnabled={g.soundEnabled} cardRef={cardRef}>
        {questionContent?.(g.shown.question)}
      </KidsQuestionCard>
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center justify-evenly px-3 pb-[3vh]" style={{ top }}>
        {stagePosition === 'above' && stageNode}
        <ChoiceGrid
          key={g.shown.index}
          options={choiceOptions(g.shown.question)}
          feedback={g.feedback}
          disabled={g.answering || !!g.feedback}
          reduced={g.reduced}
          label={gridLabel}
          width={targetWidth}
          phoneWidth={phoneTargetWidth}
          bob={bob}
          renderTarget={renderTarget}
          onPick={(o, el) => {
            pickedRect.current = el.getBoundingClientRect()
            g.submit(o.answer, o.key, el)
          }}
        />
        {stagePosition === 'below' && stageNode}
      </div>
      {g.feedback?.kind === 'correct' && <PraiseBubble praise={g.praise} top={top + 4} reduced={g.reduced} />}
      {g.submitError && (
        <div className="absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <p className="rounded-2xl bg-white/95 px-4 py-2 text-sm font-semibold text-rose-700 shadow">{g.submitError}</p>
        </div>
      )}
    </div>
  )
}
