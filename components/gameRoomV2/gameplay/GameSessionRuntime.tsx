'use client'

import { GameV2Loading, GameV2Error, GameV2Card } from '@/components/gameRoomV2'
import { GameHUD } from './GameHUD'
import { QuestionOverlay, type QuestionOverlayQuestion } from './QuestionOverlay'
import { GameResultsScreen } from './GameResultsScreen'
import { useSoundPreference } from './useSoundPreference'
import { useGameSessionState } from './useGameSessionState'
import { Bi, ta } from '@/components/gameRoomV2/Bi'

interface StatePayload {
  status: 'CREATED' | 'READY' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED'
  currentIndex: number
  totalQuestions: number
  score: number
  correctCount: number
  answeredCount: number
  lives: number
  maxLives: number
  currentStreak: number
  bestStreak: number
  questionTimeLimitSeconds: number
  xpEarned: number
  coinsEarned: number
  remainingSeconds: number | null
  question: QuestionOverlayQuestion | null
}

// THE reusable game session runtime -- every future engine (Tower
// Defense, Boss Battle, Racing, Treasure Quest, Classic Quiz, ...)
// mounts this exact component, supplying only presentational
// differences via its own wrapping UI if it wants them; the actual
// session lifecycle, polling, pause/resume, question delivery, scoring
// feedback, and Results screen are ALL shared here. This is the literal
// "every major game should share infrastructure" requirement --
// nothing about session/scoring/completion is reimplemented per engine.
//
// An engine that wants a different visual frame around the question
// (e.g. Tower Defense rendering a battlefield instead of a plain
// centered card) can compose its own layout around <QuestionOverlay>
// directly using the lower-level pieces this file itself is built
// from, but for any engine that doesn't need that, mounting
// GameSessionRuntime alone is a complete, working game loop.
export function GameSessionRuntime({
  sessionId,
  onExit,
  onPlayAgain,
}: {
  sessionId: string
  onExit: () => void
  onPlayAgain?: () => void
}) {
  const { soundEnabled, toggleSound } = useSoundPreference()
  const { state, error, result, pausing, poll, togglePause, exit } = useGameSessionState<StatePayload>({
    sessionId,
    soundEnabled,
  })

  async function handleTogglePause() {
    await togglePause()
  }

  async function handleExit() {
    await exit(onExit)
  }

  // The next /state poll (at most POLL_INTERVAL_MS away) picks up the
  // server's authoritative updated score/streak/lives/question -- this
  // callback exists for an engine that wants to react to the individual
  // result (e.g. a Boss Battle animating a hit), not to update shared
  // state itself, which always comes from polling.
  function handleAnswerResult() {
    poll()
  }

  if (error && !state) {
    return <GameV2Error description={error} onRetry={poll} />
  }

  if (!state) {
    return <GameV2Loading label={ta('loadingGame', true)} />
  }

  if (result) {
    return <GameResultsScreen result={result} onPlayAgain={onPlayAgain} onExit={onExit} />
  }

  if (state.status === 'ABANDONED') {
    return (
      <GameV2Card padding="lg" className="max-w-md w-full mx-auto text-center">
        <p className="text-2xl mb-2" aria-hidden>
          👋
        </p>
        <p className="font-extrabold text-gamev2ink-800 dark:text-gamev2ink-100"><Bi k="gameExited" /></p>
        <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400 mt-1"><Bi k="noRewardsExited" inline /></p>
      </GameV2Card>
    )
  }

  if (state.status === 'COMPLETED') {
    return <GameV2Loading label={ta('calculating', true)} />
  }

  return (
    <div className="w-full flex flex-col items-center gap-6 px-4 py-6">
      <GameHUD
        currentIndex={state.currentIndex}
        totalQuestions={state.totalQuestions}
        remainingSeconds={state.status === 'ACTIVE' ? state.remainingSeconds : null}
        questionTimeLimitSeconds={state.questionTimeLimitSeconds}
        currentStreak={state.currentStreak}
        lives={state.lives}
        maxLives={state.maxLives}
        xpEarned={state.xpEarned}
        coinsEarned={state.coinsEarned}
        paused={state.status === 'PAUSED'}
        soundEnabled={soundEnabled}
        onTogglePause={handleTogglePause}
        onToggleSound={toggleSound}
        onExit={handleExit}
      />

      {state.status === 'PAUSED' && (
        <GameV2Card padding="lg" className="max-w-sm w-full text-center">
          <p className="text-3xl mb-2" aria-hidden>
            ⏸️
          </p>
          <p className="font-extrabold text-gamev2ink-800 dark:text-gamev2ink-100"><Bi k="paused" /></p>
          <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400 mt-1">
            {pausing ? <span className="font-tamil">தொடர்கிறது...</span> : <><span className="font-tamil">நேரம் நிறுத்தப்பட்டுள்ளது. தயாரானதும் ▶ அழுத்துங்கள்.</span> <span className="opacity-70">Your timer is on hold.</span></>}
          </p>
        </GameV2Card>
      )}

      {state.status === 'ACTIVE' && state.question && (
        <QuestionOverlay
          sessionId={sessionId}
          question={state.question}
          questionIndex={state.currentIndex}
          remainingSeconds={state.remainingSeconds}
          onResult={handleAnswerResult}
        />
      )}
    </div>
  )
}
