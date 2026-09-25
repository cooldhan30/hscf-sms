'use client'

import { useEffect, useState } from 'react'
import { GameV2Card, GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { GameResultsScreen, useSoundPreference, playSound, useGameSessionState } from '@/components/gameRoomV2/gameplay'
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
  const [submitting, setSubmitting] = useState(false)
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { soundEnabled } = useSoundPreference()
  const { state: sessionState, error: pollError, result, poll, togglePause, exit } = useGameSessionState<StatePayload>({
    sessionId,
    enabled: !!difficulty,
    soundEnabled,
  })
  const error = pollError || submitError

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
  // Keyed on a boolean, not the round object (which changes every tick,
  // and depending on it recreated this interval every 100ms).
  const flightRunning = !!round && !!difficulty && !submitting && sessionState?.status !== 'PAUSED' && !isRoundReadyToSubmit(round)
  useEffect(() => {
    if (!flightRunning || !difficulty) return
    const settings = getWordNinjaDifficultySettings(difficulty)
    const interval = setInterval(() => {
      setRound((prev) => (prev ? tickRound(prev, SIM_INTERVAL_MS, settings) : prev))
    }, SIM_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [flightRunning, difficulty])

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
        setSubmitError('Failed to submit your answer')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, sessionState, submitting, sessionId, poll, soundEnabled])

  function handleSlash(wordId: string, category: string) {
    setRound((prev) => (prev ? slashWord(prev, wordId, category) : prev))
    setSelectedWordId(null)
  }

  async function handleTogglePause() {
    await togglePause()
  }

  async function handleExit() {
    await exit(onExit)
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
          <p className="font-tamil leading-relaxed text-lg font-extrabold text-gamev2ink-900 dark:text-white">{sessionState.question.prompt}</p>
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
