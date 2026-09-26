'use client'

import { useEffect, useRef, useState } from 'react'
import { GameV2Card, GameV2Button, GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { QuestionOverlay, type QuestionOverlayQuestion, GameResultsScreen, useSoundPreference, playSound, useGameSessionState } from '@/components/gameRoomV2/gameplay'
import { RaceSetupPicker } from './RaceSetupPicker'
import { Track } from './Track'
import { MultiplayerFinishScreen } from './MultiplayerFinishScreen'
import { GrandPrixGame } from './GrandPrixGame'
import {
  liveRacersToRaceState,
  type RaceThemeId,
  type RacingDifficulty,
  type LiveRaceResponse,
} from '@/lib/gameRoomV2/racing'

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
  onHome?: () => void
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
export function RacingGame({ sessionId, onExit, onPlayAgain, onHome, liveSessionId, myParticipantId, fixedDifficulty }: RacingGameProps) {
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
  return <GrandPrixGame sessionId={sessionId} onExit={onExit} onPlayAgain={onPlayAgain} onHome={onHome} />
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
  //
  // Depends on the `raceFinished` BOOLEAN, never on liveRace itself:
  // every response is a new racers array, so depending on it re-ran this
  // effect after every poll -- which fired poll() again immediately,
  // turning the intended 1.5s cadence into back-to-back requests for
  // every student in the class.
  const raceFinished = !!liveRace && liveRace.racers.length > 0 && liveRace.racers.every((r) => r.finished)
  useEffect(() => {
    if (!themeId || sessionState?.status === 'PAUSED') return
    if (raceFinished) return

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
  }, [themeId, liveSessionId, sessionState?.status, raceFinished])

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
