'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GameV2Loading, GameV2Error, GameV2Card } from '@/components/gameRoomV2'
import { GameHUD } from './GameHUD'
import { QuestionOverlay, type QuestionOverlayQuestion } from './QuestionOverlay'
import { GameResultsScreen } from './GameResultsScreen'
import { useSoundPreference } from './useSoundPreference'
import { playSound } from './playSound'
import type { GameResult } from '@/lib/gameRoomV2/domain'

const POLL_INTERVAL_MS = 2000

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
  const [state, setState] = useState<StatePayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GameResult | null>(null)
  const [pausing, setPausing] = useState(false)
  const { soundEnabled, toggleSound } = useSoundPreference()
  const lastCompletedSoundRef = useRef(false)

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/gameroom-v2/sessions/${sessionId}/state`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data) {
        setError(data?.error || 'Lost connection to the game')
        return
      }
      setError(null)
      setState(data)
    } catch {
      setError('Lost connection -- retrying...')
    }
  }, [sessionId])

  useEffect(() => {
    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [poll])

  // Once the session reaches COMPLETED, finalize it exactly once (see
  // complete/route.ts's idempotency guarantee) and fetch the full
  // Results payload -- this effect only fires the request the FIRST
  // time it observes COMPLETED, since `result` being set thereafter
  // prevents it from re-firing on subsequent polls.
  useEffect(() => {
    if (state?.status !== 'COMPLETED' || result) return

    if (!lastCompletedSoundRef.current) {
      lastCompletedSoundRef.current = true
      playSound('complete', soundEnabled)
    }

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
  }, [state?.status, result, sessionId, soundEnabled])

  async function handleTogglePause() {
    if (!state) return
    setPausing(true)
    const endpoint = state.status === 'PAUSED' ? 'resume' : 'pause'
    await fetch(`/api/gameroom-v2/sessions/${sessionId}/${endpoint}`, { method: 'POST' })
    setPausing(false)
    poll()
  }

  async function handleExit() {
    if (state && state.status !== 'COMPLETED' && state.status !== 'ABANDONED') {
      await fetch(`/api/gameroom-v2/sessions/${sessionId}/abandon`, { method: 'POST' })
    }
    onExit()
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
    return <GameV2Loading label="Loading game..." />
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
        <p className="font-extrabold text-gamev2ink-800 dark:text-gamev2ink-100">Game exited</p>
        <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400 mt-1">No rewards are given for an exited game.</p>
      </GameV2Card>
    )
  }

  if (state.status === 'COMPLETED') {
    return <GameV2Loading label="Calculating your results..." />
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
          <p className="font-extrabold text-gamev2ink-800 dark:text-gamev2ink-100">Paused</p>
          <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400 mt-1">
            {pausing ? 'Resuming...' : "Your timer is on hold. Tap play when you're ready."}
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
