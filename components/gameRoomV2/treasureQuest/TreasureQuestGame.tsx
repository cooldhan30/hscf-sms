'use client'

import { useEffect, useState } from 'react'
import { GameV2Card, GameV2Button, GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { QuestionOverlay, type QuestionOverlayQuestion, GameResultsScreen, useSoundPreference, playSound, useGameSessionState } from '@/components/gameRoomV2/gameplay'
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
  const [showQuestion, setShowQuestion] = useState(false)
  const [showTreasureScreen, setShowTreasureScreen] = useState(false)
  const { soundEnabled } = useSoundPreference()
  const { state: sessionState, error, result, poll, togglePause, exit } = useGameSessionState<StatePayload>({
    sessionId,
    enabled: !!difficulty,
    soundEnabled,
  })

  useEffect(() => {
    if (exploration?.treasureFound && !showTreasureScreen) {
      setShowTreasureScreen(true)
      playSound('victory', soundEnabled)
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

  function handleStart(chosenDifficulty: TreasureQuestDifficulty) {
    setDifficulty(chosenDifficulty)
    setExploration(createInitialExploration(getTreasureQuestDifficultySettings(chosenDifficulty)))
  }

  function handleAnswerResult(res: { correct: boolean }) {
    // QuestionOverlay already played correct/incorrect the moment the
    // server responded, just before calling this callback.
    setShowQuestion(false)
    setExploration((prev) => {
      if (!prev || !difficulty) return prev
      const settings = getTreasureQuestDifficultySettings(difficulty)
      return res.correct ? applyCorrectAnswer(prev, settings) : applyWrongAnswer(prev, settings)
    })
    poll()
  }

  function handleEnterRoom(roomId: RoomId) {
    setExploration((prev) => (prev ? enterRoom(prev, roomId) : prev))
  }

  async function handleTogglePause() {
    await togglePause()
  }

  async function handleExit() {
    await exit(onExit)
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
