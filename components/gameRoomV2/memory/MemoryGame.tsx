'use client'

import { useEffect, useState } from 'react'
import { GameV2Card, GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { GameResultsScreen, useSoundPreference, playSound, useGameSessionState } from '@/components/gameRoomV2/gameplay'
import { MemorySetupPicker } from './MemorySetupPicker'
import { MemoryBoard } from './MemoryBoard'
import { MemoryStatsBar } from './MemoryStatsBar'
import {
  createMemoryRound,
  isRoundComplete,
  flipCard,
  resolveFlippedPair,
  acknowledgeAttempt,
  buildRoundSubmission,
  getMemoryDifficultySettings,
  type MemoryRoundState,
  type MemoryDifficulty,
} from '@/lib/gameRoomV2/memory'

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

// Memory's top-level play screen. Like Matching/Word Ninja, this does
// NOT compose around QuestionOverlay/QuestionInput for the answering
// moment -- the flip-card grid is a genuinely different UI for the
// exact same MATCH question type MatchInput already renders as a
// two-column tap-to-select form. Both submit the identical
// Record<left, right> shape to the same POST /answer route, so
// gradeAnswer needs zero changes -- see
// lib/gameRoomV2/memory/round.ts's buildRoundSubmission. The round
// state (which cards are flipped/matched, moves, streak) is
// client-local ephemeral gameplay state, built fresh from each MATCH
// question's payload.left/payload.right (never duplicated/persisted
// separately); only question-answering progress and the real score/
// XP/coins ledger persist server-side via the unmodified session
// framework, which is also what feeds
// progression/achievements/analytics/mastery tracking after this
// engine's session completes.
export function MemoryGame({ sessionId, onExit, onPlayAgain }: { sessionId: string; onExit: () => void; onPlayAgain?: () => void }) {
  const [difficulty, setDifficulty] = useState<MemoryDifficulty | null>(null)
  const [round, setRound] = useState<MemoryRoundState | null>(null)
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
  // payload (the session's linked Question Set); Memory never invents
  // pair content itself.
  useEffect(() => {
    if (!difficulty || !sessionState || sessionState.status !== 'ACTIVE' || !sessionState.question) return
    setRound((prev) => {
      if (prev) return prev
      const left = sessionState.question!.payload.left ?? []
      const right = sessionState.question!.payload.right ?? []
      return createMemoryRound(left, right, `${sessionId}:${sessionState.question!.id}`)
    })
  }, [difficulty, sessionState, sessionId])

  // Once two cards are face up (flippedCardIds.length === 2), pause
  // briefly (Easy/Medium/Hard's own mismatchRevealMs -- longer on Easy
  // so there's real time to see and remember a mismatch) before
  // resolving the pair -- this deliberate beat IS the classic memory
  // game's "flip, look, then find out" pacing; resolving instantly
  // would rob the mismatch feedback of its purpose.
  useEffect(() => {
    if (!round || round.flippedCardIds.length !== 2 || !difficulty) return
    const settings = getMemoryDifficultySettings(difficulty)
    const [aId, bId] = round.flippedCardIds
    const a = round.cards.find((c) => c.id === aId)!
    const b = round.cards.find((c) => c.id === bId)!
    const willMatch = a.pairId === b.pairId
    const delay = willMatch ? 250 : settings.mismatchRevealMs
    const timeout = window.setTimeout(() => {
      setRound((prev) => {
        if (!prev) return prev
        const resolved = resolveFlippedPair(prev)
        playSound(resolved.lastAttempt?.correct ? 'correct' : 'incorrect', soundEnabled)
        return resolved
      })
    }, delay)
    return () => window.clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.flippedCardIds, difficulty, soundEnabled])

  // The attempt-feedback ring clears itself after a short beat,
  // mirroring every prior engine's one-shot acknowledgement pattern.
  useEffect(() => {
    if (!round?.lastAttempt) return
    const timeout = window.setTimeout(() => setRound((prev) => (prev ? acknowledgeAttempt(prev) : prev)), 500)
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
      .then(() => {
        playSound('complete', soundEnabled)
        setRound(null)
        setSubmitting(false)
        poll()
      })
      .catch(() => {
        setSubmitting(false)
        setSubmitError('Failed to submit your matches')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, sessionState, submitting, sessionId, poll, soundEnabled])

  function handleFlip(cardId: string) {
    setRound((prev) => (prev ? flipCard(prev, cardId) : prev))
  }

  async function handleTogglePause() {
    await togglePause()
  }

  async function handleExit() {
    await exit(onExit)
  }

  if (!difficulty) {
    return <MemorySetupPicker onStart={setDifficulty} />
  }

  if (error && !sessionState) return <GameV2Error description={error} onRetry={poll} />
  if (!sessionState) return <GameV2Loading label="Laying out the cards..." />
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

      <MemoryStatsBar moves={round.moves} currentStreak={round.currentStreak} />

      {sessionState.status === 'PAUSED' ? (
        <GameV2Card padding="md" className="w-full text-center">
          <p className="font-extrabold text-gamev2ink-800 dark:text-white">Round Paused</p>
          <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400 mt-1">Tap resume to keep flipping.</p>
        </GameV2Card>
      ) : (
        <MemoryBoard round={round} disabled={submitting} onFlip={handleFlip} />
      )}
    </div>
  )
}
