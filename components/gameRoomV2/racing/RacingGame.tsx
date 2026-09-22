'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GameV2Card, GameV2Button, GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { QuestionOverlay, type QuestionOverlayQuestion, GameResultsScreen, useSoundPreference, playSound } from '@/components/gameRoomV2/gameplay'
import { RaceSetupPicker } from './RaceSetupPicker'
import { Track } from './Track'
import {
  createInitialRace,
  applyAnswerEffect,
  tickRace,
  getRacingDifficultySettings,
  PLAYER_RACER_ID,
  type RaceState,
  type RaceThemeId,
  type RacingDifficulty,
} from '@/lib/gameRoomV2/racing'
import type { GameResult } from '@/lib/gameRoomV2/domain'

const POLL_INTERVAL_MS = 2000
const SIM_INTERVAL_MS = 100

interface StatePayload {
  status: 'CREATED' | 'READY' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED'
  currentIndex: number
  totalQuestions: number
  remainingSeconds: number | null
  question: QuestionOverlayQuestion | null
}

// Tamil Racing's top-level play screen -- composes around QuestionOverlay
// and the shared session API routes exactly like Tower Defense does,
// rather than mounting GameSessionRuntime directly, since a race track
// is its own visual frame around the same "SHOW QUESTION" contract. The
// race simulation (racer positions, boosts/penalties, theme) is
// client-local ephemeral gameplay state; only question-answering
// progress and the real XP/coins ledger persist server-side via the
// unmodified session framework.
export function RacingGame({ sessionId, onExit, onPlayAgain }: { sessionId: string; onExit: () => void; onPlayAgain?: () => void }) {
  const [themeId, setThemeId] = useState<RaceThemeId | null>(null)
  const [difficulty, setDifficulty] = useState<RacingDifficulty | null>(null)
  const [race, setRace] = useState<RaceState | null>(null)
  const [sessionState, setSessionState] = useState<StatePayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GameResult | null>(null)
  const [showQuestion, setShowQuestion] = useState(false)
  const { soundEnabled } = useSoundPreference()
  const completedSoundPlayed = useRef(false)
  const raceFinishSoundPlayed = useRef(false)

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

  // Local race simulation clock -- runs independently of the 2s session
  // poll for real-time racer movement. Frozen while a question is being
  // shown or the session is paused, and kept running after the
  // session's questions are exhausted so a shorter Question Set than
  // the race length doesn't strand an unfinished race (same reasoning
  // as Tower Defense's simulation clock).
  useEffect(() => {
    if (!race || !difficulty || showQuestion || sessionState?.status === 'PAUSED' || race.raceOver) return

    const settings = getRacingDifficultySettings(difficulty)
    const interval = setInterval(() => {
      setRace((prev) => (prev ? tickRace(prev, SIM_INTERVAL_MS, settings).state : prev))
    }, SIM_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [race, difficulty, showQuestion, sessionState?.status])

  useEffect(() => {
    if (race?.raceOver && !raceFinishSoundPlayed.current) {
      raceFinishSoundPlayed.current = true
      playSound(race.winnerId === PLAYER_RACER_ID ? 'complete' : 'incorrect', soundEnabled)
    }
  }, [race?.raceOver, race?.winnerId, soundEnabled])

  // A fresh question opportunity opens while the race is in progress --
  // sourced exclusively from sessionState.question (the session's
  // linked Question Set); Racing never invents or embeds question
  // content itself.
  useEffect(() => {
    if (!race || !sessionState || sessionState.status !== 'ACTIVE' || !sessionState.question) return
    if (race.raceOver || showQuestion) return
    setShowQuestion(true)
  }, [race, sessionState, showQuestion])

  useEffect(() => {
    if (sessionState?.status !== 'COMPLETED' || result) return
    if (!completedSoundPlayed.current) {
      completedSoundPlayed.current = true
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
  }, [sessionState?.status, result, sessionId, soundEnabled])

  function handleStart(theme: RaceThemeId, chosenDifficulty: RacingDifficulty) {
    setThemeId(theme)
    setDifficulty(chosenDifficulty)
    setRace(createInitialRace(getRacingDifficultySettings(chosenDifficulty)))
  }

  function handleAnswerResult(res: { correct: boolean }) {
    setShowQuestion(false)
    setRace((prev) => {
      if (!prev || !difficulty) return prev
      return applyAnswerEffect(prev, PLAYER_RACER_ID, res.correct, getRacingDifficultySettings(difficulty))
    })
    poll()
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

  function handleRestart() {
    setThemeId(null)
    setDifficulty(null)
    setRace(null)
    setResult(null)
    raceFinishSoundPlayed.current = false
  }

  if (!themeId || !difficulty) {
    return <RaceSetupPicker onStart={handleStart} />
  }

  if (error && !sessionState) return <GameV2Error description={error} onRetry={poll} />
  if (!sessionState || !race) return <GameV2Loading label="Lining up at the starting line..." />
  if (result) return <GameResultsScreen result={result} onPlayAgain={onPlayAgain} onExit={onExit} />

  const raceStillInPlay = !race.raceOver
  if (sessionState.status === 'COMPLETED' && !raceStillInPlay) return <GameV2Loading label="Calculating your results..." />

  if (race.raceOver) {
    const won = race.winnerId === PLAYER_RACER_ID
    return (
      <GameV2Card padding="lg" className="max-w-lg w-full mx-auto text-center">
        <div className="text-5xl mb-2" aria-hidden>
          {won ? '\u{1F3C6}' : '\u{1F3C1}'}
        </div>
        <h2 className="text-2xl font-extrabold text-gamev2ink-900 dark:text-white">{won ? 'You won the race!' : 'So close! Your rival edged you out.'}</h2>
        <p className="mt-2 text-sm text-gamev2ink-500 dark:text-gamev2ink-400">
          {won ? 'Your accuracy paid off on the track.' : 'Answer more questions correctly next time to pull ahead.'}
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <GameV2Button variant="spark" fullWidth onClick={handleRestart}>
            Race Again
          </GameV2Button>
          <GameV2Button variant="ghost" fullWidth onClick={handleExit}>
            Exit
          </GameV2Button>
        </div>
      </GameV2Card>
    )
  }

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

      <Track state={race} themeId={themeId} />

      {sessionState.status === 'PAUSED' && (
        <GameV2Card padding="md" className="w-full text-center">
          <p className="font-extrabold text-gamev2ink-800 dark:text-white">Race Paused</p>
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
