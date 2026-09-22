'use client'

import { useCallback, useEffect, useState } from 'react'
import { GameV2Card, GameV2Button, GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { QuestionOverlay, type QuestionOverlayQuestion, GameResultsScreen, useSoundPreference, playSound } from '@/components/gameRoomV2/gameplay'
import { TreasureSetupPicker } from './TreasureSetupPicker'
import { RoomView } from './RoomView'
import { TreasureFoundScreen } from './TreasureFoundScreen'
import {
  createInitialExploration,
  applyCorrectAnswer,
  applyWrongAnswer,
  enterRoom,
  getTreasureQuestDifficultySettings,
  type ExplorationState,
  type TreasureQuestDifficulty,
  type RoomId,
} from '@/lib/gameRoomV2/treasureQuest'
import type { GameResult } from '@/lib/gameRoomV2/domain'

const POLL_INTERVAL_MS = 2000

interface StatePayload {
  status: 'CREATED' | 'READY' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED'
  currentIndex: number
  totalQuestions: number
  remainingSeconds: number | null
  question: QuestionOverlayQuestion | null
}

// Treasure Quest's top-level play screen -- composes around
// QuestionOverlay and the shared session API routes, the same pattern
// every prior custom-visual-layer V2 engine (Tower Defense, Racing,
// Boss Battle) establishes, rather than mounting GameSessionRuntime
// directly. Unlike those engines, there is no independent real-time
// simulation clock here -- room state only changes in response to an
// answer or a door click, both discrete player actions, so no
// setInterval tick loop is needed. The exploration state (current room,
// keys, clues) is client-local ephemeral gameplay state; only
// question-answering progress and the real XP/coins ledger persist
// server-side via the unmodified session framework.
export function TreasureQuestGame({ sessionId, onExit, onPlayAgain }: { sessionId: string; onExit: () => void; onPlayAgain?: () => void }) {
  const [difficulty, setDifficulty] = useState<TreasureQuestDifficulty | null>(null)
  const [exploration, setExploration] = useState<ExplorationState | null>(null)
  const [sessionState, setSessionState] = useState<StatePayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GameResult | null>(null)
  const [showQuestion, setShowQuestion] = useState(false)
  const [showTreasureScreen, setShowTreasureScreen] = useState(false)
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

  useEffect(() => {
    if (exploration?.treasureFound && !showTreasureScreen) {
      setShowTreasureScreen(true)
      playSound('complete', soundEnabled)
    }
  }, [exploration?.treasureFound, showTreasureScreen, soundEnabled])

  // A fresh question opportunity opens whenever the session has one
  // ready -- sourced exclusively from sessionState.question (the
  // session's linked Question Set); Treasure Quest never invents or
  // embeds question/room-puzzle content itself.
  useEffect(() => {
    if (!exploration || !sessionState || sessionState.status !== 'ACTIVE' || !sessionState.question) return
    if (exploration.treasureFound || showQuestion) return
    setShowQuestion(true)
  }, [exploration, sessionState, showQuestion])

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

  function handleStart(chosenDifficulty: TreasureQuestDifficulty) {
    setDifficulty(chosenDifficulty)
    setExploration(createInitialExploration(getTreasureQuestDifficultySettings(chosenDifficulty)))
  }

  function handleAnswerResult(res: { correct: boolean }) {
    setShowQuestion(false)
    setExploration((prev) => {
      if (!prev || !difficulty) return prev
      const settings = getTreasureQuestDifficultySettings(difficulty)
      playSound(res.correct ? 'correct' : 'incorrect', soundEnabled)
      return res.correct ? applyCorrectAnswer(prev, settings) : applyWrongAnswer(prev, settings)
    })
    poll()
  }

  function handleEnterRoom(roomId: RoomId) {
    setExploration((prev) => (prev ? enterRoom(prev, roomId) : prev))
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
    return <TreasureSetupPicker onStart={handleStart} />
  }

  if (error && !sessionState) return <GameV2Error description={error} onRetry={poll} />
  if (!sessionState || !exploration) return <GameV2Loading label="Unlocking the entrance..." />
  if (result) return <GameResultsScreen result={result} onPlayAgain={onPlayAgain} onExit={onExit} />

  if (showTreasureScreen) {
    return <TreasureFoundScreen cluesFound={exploration.cluesFound} onContinue={() => setShowTreasureScreen(false)} />
  }

  const questIsOver = exploration.treasureFound
  if (sessionState.status === 'COMPLETED' && !questIsOver) return <GameV2Loading label="Calculating your results..." />

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-4 px-4 py-6">
      <div className="w-full flex items-center justify-between">
        <button onClick={handleExit} className="text-sm font-bold text-gamev2ink-400 hover:text-gamev2coral-500">
          Exit
        </button>
        <span className="text-sm font-extrabold text-gamev2ink-800 dark:text-white">
          Question {Math.min(sessionState.currentIndex + 1, sessionState.totalQuestions)} of {sessionState.totalQuestions}
        </span>
        <button onClick={handleTogglePause} className="text-sm font-bold text-gamev2ink-400 hover:text-gamev2ink-700 dark:hover:text-white">
          {sessionState.status === 'PAUSED' ? 'Resume' : 'Pause'}
        </button>
      </div>

      <RoomView state={exploration} onEnterRoom={handleEnterRoom} />

      {exploration.treasureFound && !showTreasureScreen && (
        <GameV2Card padding="md" className="w-full text-center">
          <p className="font-extrabold text-gamev2mint-600 dark:text-gamev2mint-400">
            {'\u{1F4B0}'} Treasure found! Finish any remaining questions to see your full results.
          </p>
        </GameV2Card>
      )}

      {sessionState.status === 'PAUSED' && (
        <GameV2Card padding="md" className="w-full text-center">
          <p className="font-extrabold text-gamev2ink-800 dark:text-white">Quest Paused</p>
          <GameV2Button variant="spark" size="md" className="mt-3" onClick={handleTogglePause}>
            Resume
          </GameV2Button>
        </GameV2Card>
      )}

      {showQuestion && sessionState.question && sessionState.status === 'ACTIVE' && (
        <div className="w-full">
          <QuestionOverlay
            sessionId={sessionId}
            question={sessionState.question}
            questionIndex={sessionState.currentIndex}
            remainingSeconds={sessionState.remainingSeconds}
            onResult={handleAnswerResult}
          />
        </div>
      )}
    </div>
  )
}
