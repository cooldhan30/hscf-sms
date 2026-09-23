'use client'

import { useEffect, useRef, useState } from 'react'
import { GameV2Card, GameV2Button, GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { QuestionOverlay, type QuestionOverlayQuestion, GameResultsScreen, useSoundPreference, playSound, useGameSessionState } from '@/components/gameRoomV2/gameplay'
import { RaceSetupPicker } from './RaceSetupPicker'
import { Track } from './Track'
import { MultiplayerFinishScreen } from './MultiplayerFinishScreen'
import {
  createInitialRace,
  applyAnswerEffect,
  tickRace,
  getRacingDifficultySettings,
  PLAYER_RACER_ID,
  liveRacersToRaceState,
  type RaceState,
  type RaceThemeId,
  type RacingDifficulty,
  type LiveRaceResponse,
} from '@/lib/gameRoomV2/racing'

const SIM_INTERVAL_MS = 100
// Live multiplayer polling is DELIBERATELY much coarser than the solo
// 100ms local tick -- racer distance is meaningful gameplay state, not
// per-frame animation, so it travels over ordinary HTTP polling at a
// human-perceptible cadence, never over Realtime on every physics
// step. Each client's own Track.tsx <motion.div> transition (a longer,
// smooth tween in multiplayer mode -- see below) is what makes
// movement look continuous BETWEEN these polls; the network only ever
// carries "where is everyone now," never "where is everyone this
// millisecond."
const LIVE_POLL_INTERVAL_MS = 1500

interface StatePayload {
  status: 'CREATED' | 'READY' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED'
  currentIndex: number
  totalQuestions: number
  remainingSeconds: number | null
  question: QuestionOverlayQuestion | null
}

interface RacingGameProps {
  sessionId: string
  onExit: () => void
  onPlayAgain?: () => void
  // Present only when mounted inside Live Classroom (see
  // LivePlayClient.tsx) -- switches the whole component into
  // multiplayer mode: every racer's position comes from polling
  // /api/gameroom-v2/live/[id]/race (server-computed, never
  // client-simulated) instead of this client's own local tickRace
  // loop, and difficulty is fixed by the host rather than chosen here.
  liveSessionId?: string
  myParticipantId?: string
  fixedDifficulty?: RacingDifficulty
}

// Tamil Racing's top-level play screen. Solo mode (no liveSessionId)
// is completely unchanged from before: composes around QuestionOverlay
// and the shared session API routes, with a client-local tickRace
// simulation against a single scripted rival. Multiplayer mode (a
// liveSessionId is present) shares the SAME QuestionOverlay/Track/
// theme-picker UI pieces but replaces the physics entirely -- see
// useLiveRacePolling below.
export function RacingGame({ sessionId, onExit, onPlayAgain, liveSessionId, myParticipantId, fixedDifficulty }: RacingGameProps) {
  if (liveSessionId && myParticipantId) {
    return (
      <MultiplayerRacingGame
        sessionId={sessionId}
        onExit={onExit}
        liveSessionId={liveSessionId}
        myParticipantId={myParticipantId}
        fixedDifficulty={fixedDifficulty}
      />
    )
  }
  return <SoloRacingGame sessionId={sessionId} onExit={onExit} onPlayAgain={onPlayAgain} />
}

// ============================================================
// SOLO -- unchanged behavior from before this pass.
// ============================================================
function SoloRacingGame({ sessionId, onExit, onPlayAgain }: { sessionId: string; onExit: () => void; onPlayAgain?: () => void }) {
  const [themeId, setThemeId] = useState<RaceThemeId | null>(null)
  const [difficulty, setDifficulty] = useState<RacingDifficulty | null>(null)
  const [race, setRace] = useState<RaceState | null>(null)
  const [showQuestion, setShowQuestion] = useState(false)
  const { soundEnabled } = useSoundPreference()
  const raceFinishSoundPlayed = useRef(false)
  const { state: sessionState, error, result, poll, togglePause, exit } = useGameSessionState<StatePayload>({
    sessionId,
    enabled: !!difficulty,
    soundEnabled,
  })

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
      playSound(race.winnerId === PLAYER_RACER_ID ? 'victory' : 'gameOver', soundEnabled)
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

  function handleStart(theme: RaceThemeId, chosenDifficulty: RacingDifficulty) {
    setThemeId(theme)
    setDifficulty(chosenDifficulty)
    setRace(createInitialRace(getRacingDifficultySettings(chosenDifficulty)))
  }

  function handleAnswerResult(res: { correct: boolean }) {
    // QuestionOverlay already played correct/incorrect the moment the
    // server responded, just before calling this callback.
    setShowQuestion(false)
    setRace((prev) => {
      if (!prev || !difficulty) return prev
      return applyAnswerEffect(prev, PLAYER_RACER_ID, res.correct, getRacingDifficultySettings(difficulty))
    })
    poll()
  }

  async function handleTogglePause() {
    await togglePause()
  }

  async function handleExit() {
    await exit(onExit)
  }

  function handleRestart() {
    setThemeId(null)
    setDifficulty(null)
    setRace(null)
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

// ============================================================
// MULTIPLAYER -- Live Classroom mode.
// ============================================================
function MultiplayerRacingGame({
  sessionId,
  onExit,
  liveSessionId,
  myParticipantId,
  fixedDifficulty,
}: {
  sessionId: string
  onExit: () => void
  liveSessionId: string
  myParticipantId: string
  fixedDifficulty?: RacingDifficulty
}) {
  const [themeId, setThemeId] = useState<RaceThemeId | null>(null)
  const [liveRace, setLiveRace] = useState<LiveRaceResponse | null>(null)
  const [showQuestion, setShowQuestion] = useState(false)
  const { soundEnabled } = useSoundPreference()
  const raceFinishSoundPlayed = useRef(false)
  const lastAnsweredIndexRef = useRef(-1)
  const { state: sessionState, error, result, poll, togglePause, exit } = useGameSessionState<StatePayload>({
    sessionId,
    enabled: !!themeId,
    soundEnabled,
  })

  // Polls the server-authoritative race view (every racer's
  // server-replayed distance -- see api/gameroom-v2/live/[id]/race/
  // route.ts) at a coarse, human-perceptible cadence. Never runs while
  // a question overlay is open (the same "movement pauses while
  // thinking" rule solo racing already has -- the server's own replay
  // naturally reflects this too, since no NEW answer lands mid-question)
  // and stops once the race is over.
  useEffect(() => {
    if (!themeId || sessionState?.status === 'PAUSED') return
    if (liveRace?.racers.every((r) => r.finished)) return

    let cancelled = false
    async function poll() {
      const res = await fetch(`/api/gameroom-v2/live/${liveSessionId}/race`)
      const data = await res.json().catch(() => null)
      if (!cancelled && res.ok && data) setLiveRace(data)
    }
    poll()
    const interval = setInterval(poll, LIVE_POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [themeId, liveSessionId, sessionState?.status, liveRace?.racers])

  useEffect(() => {
    const allFinished = liveRace && liveRace.racers.length > 0 && liveRace.racers.every((r) => r.finished)
    if (allFinished && !raceFinishSoundPlayed.current) {
      raceFinishSoundPlayed.current = true
      const me = liveRace!.racers.find((r) => r.participantId === myParticipantId)
      playSound(me?.finished ? 'complete' : 'gameOver', soundEnabled)
    }
  }, [liveRace, myParticipantId, soundEnabled])

  // Same question-opportunity gate as solo racing, keyed off the
  // session's own currentIndex so a poll landing mid-answer never
  // reopens a question this racer already answered.
  useEffect(() => {
    if (!themeId || !sessionState || sessionState.status !== 'ACTIVE' || !sessionState.question) return
    if (sessionState.currentIndex <= lastAnsweredIndexRef.current) return
    if (showQuestion) return
    setShowQuestion(true)
  }, [themeId, sessionState, showQuestion])

  function handleThemeChosen(theme: RaceThemeId) {
    setThemeId(theme)
  }

  function handleAnswerResult(res: { correct: boolean }) {
    void res
    lastAnsweredIndexRef.current = sessionState?.currentIndex ?? lastAnsweredIndexRef.current
    setShowQuestion(false)
    // QuestionOverlay already played correct/incorrect the moment the
    // server responded, just before calling this callback.
    // The server already recorded the answer and will reflect its
    // effect on the NEXT /race poll -- this client never predicts or
    // locally applies its own boost/penalty, unlike solo mode, so
    // every racer (including this one) only ever moves based on what
    // the server says actually happened.
    poll()
  }

  async function handleTogglePause() {
    await togglePause()
  }

  async function handleExit() {
    await exit(onExit)
  }

  if (!themeId || !fixedDifficulty) {
    return <RaceSetupPicker onStart={handleThemeChosen} fixedDifficulty={fixedDifficulty} />
  }

  if (error && !sessionState) return <GameV2Error description={error} onRetry={poll} />
  if (!sessionState || !liveRace) return <GameV2Loading label="Lining up at the starting line..." />
  if (result) return <GameResultsScreen result={result} onPlayAgain={undefined} onExit={onExit} />

  const allFinished = liveRace.racers.length > 0 && liveRace.racers.every((r) => r.finished)
  if (sessionState.status === 'COMPLETED' && allFinished) return <GameV2Loading label="Calculating your results..." />

  if (allFinished) {
    return <MultiplayerFinishScreen racers={liveRace.racers} myParticipantId={myParticipantId} onExit={handleExit} />
  }

  const trackState = liveRacersToRaceState(liveRace, myParticipantId)

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

      <Track state={trackState} themeId={themeId} live />

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
