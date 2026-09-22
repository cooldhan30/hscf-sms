'use client'

import { useCallback, useEffect, useState } from 'react'
import { GameV2Card, GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { GameResultsScreen, useSoundPreference, playSound } from '@/components/gameRoomV2/gameplay'
import { NinjaSetupPicker } from './NinjaSetupPicker'
import { NinjaBoard } from './NinjaBoard'
import {
  buildLanes,
  createInitialRound,
  tickRound,
  slashWord,
  isRoundReadyToSubmit,
  buildRoundSubmission,
  getWordNinjaDifficultySettings,
  type RoundState,
  type WordNinjaDifficulty,
} from '@/lib/gameRoomV2/wordNinja'
import type { GameResult } from '@/lib/gameRoomV2/domain'

const POLL_INTERVAL_MS = 2000
const SIM_INTERVAL_MS = 100

interface CategorizeQuestion {
  id: string
  prompt: string
  payload: { items?: string[]; categories?: string[] }
}

interface StatePayload {
  status: 'CREATED' | 'READY' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED'
  currentIndex: number
  totalQuestions: number
  question: CategorizeQuestion | null
}

// Word Ninja's top-level play screen. Unlike Tower Defense/Racing/Boss
// Battle/Treasure Quest, this engine does NOT compose around
// QuestionOverlay/QuestionInput for the actual answering moment -- the
// lane-slashing interaction is a genuinely different UI for the exact
// same CATEGORIZE question type CategorizeInput already renders as a
// dropdown form. Both submit the identical Record<item, category>
// shape to the same POST /answer route, so gradeAnswer needs zero
// changes -- see lib/gameRoomV2/wordNinja/round.ts's
// buildRoundSubmission. The flight/lane state (which words are in the
// air, which lane each has been slashed into) is client-local ephemeral
// gameplay state; only question-answering progress and the real
// XP/coins ledger persist server-side via the unmodified session
// framework.
export function WordNinjaGame({ sessionId, onExit, onPlayAgain }: { sessionId: string; onExit: () => void; onPlayAgain?: () => void }) {
  const [difficulty, setDifficulty] = useState<WordNinjaDifficulty | null>(null)
  const [round, setRound] = useState<RoundState | null>(null)
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null)
  const [sessionState, setSessionState] = useState<StatePayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GameResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null)
  const { soundEnabled } = useSoundPreference()

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/gameroom-v2/sessions/${sessionId}/state`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data) {
        setError(data?.error || 'Lost connection to the game')
        return
      }
      setError(null)
      setSessionState(data)
    } catch {
      setError('Lost connection -- retrying...')
    }
  }, [sessionId])

  useEffect(() => {
    if (!difficulty) return
    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [poll, difficulty])

  // Starts a fresh round of flying words the moment a new CATEGORIZE
  // question becomes current -- items/categories come exclusively from
  // sessionState.question (the session's linked Question Set); Word
  // Ninja never invents category content itself.
  useEffect(() => {
    if (!difficulty || !sessionState || sessionState.status !== 'ACTIVE' || !sessionState.question) return
    const items = sessionState.question.payload.items ?? []
    setRound((prev) => {
      if (prev) return prev
      return createInitialRound(items)
    })
  }, [difficulty, sessionState])

  // The round's own flight clock -- independent of the 2s session poll,
  // frozen while the session is paused or a submission is in flight.
  useEffect(() => {
    if (!round || !difficulty || submitting || sessionState?.status === 'PAUSED' || isRoundReadyToSubmit(round)) return
    const settings = getWordNinjaDifficultySettings(difficulty)
    const interval = setInterval(() => {
      setRound((prev) => (prev ? tickRound(prev, SIM_INTERVAL_MS, settings) : prev))
    }, SIM_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [round, difficulty, submitting, sessionState?.status])

  // Once every word in the round has been slashed into a lane, submit
  // the whole mapping as this question's answer through the SAME
  // /answer route every other engine uses -- grading, points, XP/coins
  // all happen exactly as they do for a dropdown-form CategorizeInput
  // submission.
  useEffect(() => {
    if (!round || !sessionState?.question || !isRoundReadyToSubmit(round) || submitting) return
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
        if (data?.isCorrect !== undefined) {
          setLastAnswerCorrect(data.isCorrect)
          playSound(data.isCorrect ? 'correct' : 'incorrect', soundEnabled)
        }
        setRound(null)
        setSelectedWordId(null)
        setSubmitting(false)
        poll()
      })
      .catch(() => {
        setSubmitting(false)
        setError('Failed to submit your answer')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, sessionState, submitting, sessionId, poll, soundEnabled])

  useEffect(() => {
    if (sessionState?.status !== 'COMPLETED' || result) return
    fetch(`/api/gameroom-v2/sessions/${sessionId}/complete`, { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
          return
        }
        setResult({
          sessionId: data.sessionId,
          score: data.score,
          accuracyPct: data.accuracyPct,
          correctCount: data.correctCount,
          incorrectCount: data.incorrectCount,
          totalQuestions: data.totalQuestions,
          xpEarned: data.xpEarned,
          coinsEarned: data.coinsEarned,
          bestStreak: data.bestStreak,
          skillsPracticed: data.skillsPracticed,
          responses: [],
        })
      })
      .catch(() => setError('Failed to load your results'))
  }, [sessionState?.status, result, sessionId])

  function handleSlash(wordId: string, category: string) {
    setRound((prev) => (prev ? slashWord(prev, wordId, category) : prev))
    setSelectedWordId(null)
  }

  async function handleTogglePause() {
    if (!sessionState) return
    const endpoint = sessionState.status === 'PAUSED' ? 'resume' : 'pause'
    await fetch(`/api/gameroom-v2/sessions/${sessionId}/${endpoint}`, { method: 'POST' })
    poll()
  }

  async function handleExit() {
    if (sessionState && sessionState.status !== 'COMPLETED' && sessionState.status !== 'ABANDONED') {
      await fetch(`/api/gameroom-v2/sessions/${sessionId}/abandon`, { method: 'POST' })
    }
    onExit()
  }

  if (!difficulty) {
    return <NinjaSetupPicker onStart={setDifficulty} />
  }

  if (error && !sessionState) return <GameV2Error description={error} onRetry={poll} />
  if (!sessionState) return <GameV2Loading label="Sharpening blades..." />
  if (result) return <GameResultsScreen result={result} onPlayAgain={onPlayAgain} onExit={onExit} />
  if (sessionState.status === 'COMPLETED') return <GameV2Loading label="Calculating your results..." />

  const categories = sessionState.question?.payload.categories ?? []
  const lanes = buildLanes(categories)

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

      {sessionState.question && (
        <GameV2Card padding="sm" className="w-full text-center">
          <p className="font-tamil text-lg font-extrabold text-gamev2ink-900 dark:text-white">{sessionState.question.prompt}</p>
        </GameV2Card>
      )}

      {sessionState.status === 'PAUSED' ? (
        <GameV2Card padding="md" className="w-full text-center">
          <p className="font-extrabold text-gamev2ink-800 dark:text-white">Paused</p>
        </GameV2Card>
      ) : round ? (
        <NinjaBoard
          lanes={lanes}
          activeWords={round.active}
          selectedWordId={selectedWordId}
          onSelectWord={setSelectedWordId}
          onSlash={handleSlash}
        />
      ) : (
        <GameV2Loading label={submitting ? 'Checking your answers...' : 'Waiting for the next round...'} />
      )}

      {lastAnswerCorrect !== null && !round && !submitting && (
        <p className={`text-sm font-bold ${lastAnswerCorrect ? 'text-gamev2mint-600 dark:text-gamev2mint-400' : 'text-gamev2coral-600 dark:text-gamev2coral-400'}`}>
          {lastAnswerCorrect ? 'All correct!' : 'Not quite -- some words landed in the wrong lane.'}
        </p>
      )}
    </div>
  )
}
