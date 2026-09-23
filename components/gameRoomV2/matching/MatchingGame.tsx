'use client'

import { useEffect, useState } from 'react'
import { GameV2Card, GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { GameResultsScreen, useSoundPreference, playSound, useGameSessionState } from '@/components/gameRoomV2/gameplay'
import { MatchingSetupPicker } from './MatchingSetupPicker'
import { MatchingBoard } from './MatchingBoard'
import { MatchingStatsBar } from './MatchingStatsBar'
import {
  createMatchingRound,
  isRoundComplete,
  selectCard,
  acknowledgeAttempt,
  buildRoundSubmission,
  getMatchingDifficultySettings,
  roundTimeLimitForIndex,
  type MatchingRoundState,
  type MatchingDifficulty,
} from '@/lib/gameRoomV2/matching'

interface MatchQuestion {
  id: string
  prompt: string
  payload: { left?: string[]; right?: string[] }
}

interface StatePayload {
  status: 'CREATED' | 'READY' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED'
  currentIndex: number
  totalQuestions: number
  question: MatchQuestion | null
}

const ATTEMPT_FEEDBACK_MS = 700

// Matching's top-level play screen. Like Word Ninja, this does NOT
// compose around QuestionOverlay/QuestionInput for the answering
// moment -- the tap-to-pair grid is a genuinely different UI for the
// exact same MATCH question type MatchInput already renders as a
// two-column tap-to-select form. Both submit the identical
// Record<left, right> shape to the same POST /answer route, so
// gradeAnswer needs zero changes -- see
// lib/gameRoomV2/matching/round.ts's buildRoundSubmission. The round
// state (which cards are matched, moves, streak) is client-local
// ephemeral gameplay state, built fresh from each MATCH question's
// payload.left/payload.right (never duplicated/persisted separately);
// only question-answering progress and the real score/XP/coins ledger
// persist server-side via the unmodified session framework, which is
// also what feeds progression/achievements/analytics/mastery tracking
// after this engine's session completes.
export function MatchingGame({ sessionId, onExit, onPlayAgain }: { sessionId: string; onExit: () => void; onPlayAgain?: () => void }) {
  const [difficulty, setDifficulty] = useState<MatchingDifficulty | null>(null)
  const [round, setRound] = useState<MatchingRoundState | null>(null)
  const [roundSecondsRemaining, setRoundSecondsRemaining] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { soundEnabled } = useSoundPreference()
  const { state: sessionState, error: pollError, result, poll, togglePause, exit } = useGameSessionState<StatePayload>({
    sessionId,
    enabled: !!difficulty,
    soundEnabled,
  })
  const error = pollError || submitError

  // Starts a fresh round the moment a new MATCH question becomes
  // current -- pairs come exclusively from sessionState.question's
  // payload (the session's linked Question Set); Matching never
  // invents pair content itself.
  useEffect(() => {
    if (!difficulty || !sessionState || sessionState.status !== 'ACTIVE' || !sessionState.question) return
    setRound((prev) => {
      if (prev) return prev
      const left = sessionState.question!.payload.left ?? []
      const right = sessionState.question!.payload.right ?? []
      return createMatchingRound(left, right, `${sessionId}:${sessionState.question!.id}`)
    })
    const settings = getMatchingDifficultySettings(difficulty)
    setRoundSecondsRemaining((prev) => (prev !== null ? prev : roundTimeLimitForIndex(settings, sessionState.currentIndex)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty, sessionState?.question?.id])

  // Progressively-harder round timer -- ticks down once per second
  // while a timed difficulty round is in progress; reaching zero does
  // NOT fail the round (matching every other V2 engine's non-punitive
  // design), it simply stops decrementing, leaving the student free to
  // keep matching at their own pace.
  useEffect(() => {
    if (roundSecondsRemaining === null || roundSecondsRemaining <= 0 || sessionState?.status !== 'ACTIVE' || submitting) return
    const interval = window.setInterval(() => {
      setRoundSecondsRemaining((prev) => (prev !== null && prev > 0 ? prev - 1 : prev))
    }, 1000)
    return () => window.clearInterval(interval)
  }, [roundSecondsRemaining, sessionState?.status, submitting])

  // The attempt-feedback ring (matched/mismatched) clears itself after
  // a short beat, mirroring every prior engine's one-shot
  // acknowledgement pattern.
  useEffect(() => {
    if (!round?.lastAttempt) return
    const timeout = window.setTimeout(() => setRound((prev) => (prev ? acknowledgeAttempt(prev) : prev)), ATTEMPT_FEEDBACK_MS)
    return () => window.clearTimeout(timeout)
  }, [round?.lastAttempt])

  // Once every pair in the round is matched, submit the whole mapping
  // as this question's answer through the SAME /answer route every
  // other engine uses -- grading, points, XP/coins all happen exactly
  // as they do for a two-column MatchInput submission.
  useEffect(() => {
    if (!round || !sessionState?.question || !isRoundComplete(round) || submitting) return
    setSubmitting(true)
    const questionIndex = sessionState.currentIndex
    const answer = buildRoundSubmission(round)
    fetch(`/api/gameroom-v2/sessions/${sessionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionIndex, answer }),
    })
      .then((res) => res.json())
      .then((data) => {
        // One sound per round-clear, not two stacked on top of each
        // other: a wrong-somewhere-in-the-round result still gets its
        // own `incorrect` cue, but an all-correct round plays the
        // distinct `checkpoint` chime instead of layering `correct`
        // immediately under `complete` (this used to fire both).
        if (data?.isCorrect === false) {
          playSound('incorrect', soundEnabled)
        } else {
          playSound('checkpoint', soundEnabled)
        }
        setRound(null)
        setRoundSecondsRemaining(null)
        setSubmitting(false)
        poll()
      })
      .catch(() => {
        setSubmitting(false)
        setSubmitError('Failed to submit your matches')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, sessionState, submitting, sessionId, poll, soundEnabled])

  function handleSelect(cardId: string) {
    setRound((prev) => {
      if (!prev) return prev
      const next = selectCard(prev, cardId)
      if (next.lastAttempt) playSound(next.lastAttempt.correct ? 'correct' : 'incorrect', soundEnabled)
      return next
    })
  }

  async function handleTogglePause() {
    await togglePause()
  }

  async function handleExit() {
    await exit(onExit)
  }

  if (!difficulty) {
    return <MatchingSetupPicker onStart={setDifficulty} />
  }

  if (error && !sessionState) return <GameV2Error description={error} onRetry={poll} />
  if (!sessionState) return <GameV2Loading label="Shuffling the cards..." />
  if (result) return <GameResultsScreen result={result} onPlayAgain={onPlayAgain} onExit={onExit} />
  if (sessionState.status === 'COMPLETED') return <GameV2Loading label="Calculating your results..." />
  if (!round) return <GameV2Loading label="Dealing the next round..." />

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-4 px-4 py-6">
      <div className="w-full flex items-center justify-between">
        <button onClick={handleExit} className="text-sm font-bold text-gamev2ink-400 hover:text-gamev2coral-500">
          Exit
        </button>
        <span className="text-sm font-extrabold text-gamev2ink-800 dark:text-white">
          Round {Math.min(sessionState.currentIndex + 1, sessionState.totalQuestions)} of {sessionState.totalQuestions}
        </span>
        <button onClick={handleTogglePause} className="text-sm font-bold text-gamev2ink-400 hover:text-gamev2ink-700 dark:hover:text-white">
          {sessionState.status === 'PAUSED' ? 'Resume' : 'Pause'}
        </button>
      </div>

      <MatchingStatsBar moves={round.moves} currentStreak={round.currentStreak} roundSecondsRemaining={roundSecondsRemaining} />

      {sessionState.status === 'PAUSED' ? (
        <GameV2Card padding="md" className="w-full text-center">
          <p className="font-extrabold text-gamev2ink-800 dark:text-white">Round Paused</p>
          <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400 mt-1">Tap resume to keep matching.</p>
        </GameV2Card>
      ) : (
        <MatchingBoard round={round} disabled={submitting} onSelect={handleSelect} />
      )}
    </div>
  )
}
