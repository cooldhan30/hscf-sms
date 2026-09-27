'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FiLogOut, FiPause, FiPlay, FiVideo } from 'react-icons/fi'
import { GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { QuestionOverlay, type QuestionOverlayQuestion, type AnswerResult, GameResultsScreen, useSoundPreference, useMusicPreference, playSound, useGameSessionState } from '@/components/gameRoomV2/gameplay'
import { useGameV2Motion } from '@/components/gameRoomV2/useGameV2Motion'
import { CelebrationLayer, type CelebrationHandle } from '@/components/gameRoomV2/celebration/CelebrationLayer'
import { AnswerReview } from '@/components/gameRoomV2/celebration/AnswerReview'
import { MultiplayerFinishScreen } from './MultiplayerFinishScreen'
import { RaceGame3D } from '@/components/gameRoomV2/racing3d/RaceGame3D'
import { LiveRace3D } from '@/components/gameRoomV2/racing3d/LiveRace3D'
import { RaceMusic, RaceAmbience } from '@/components/gameRoomV2/racing3d/music'
import type { CameraMode } from '@/components/gameRoomV2/racing3d/render'
import { TRACKS } from '@/lib/gameRoomV2/racing3d'
import type { RacingDifficulty, LiveRaceResponse } from '@/lib/gameRoomV2/racing'
import { formatAnswer } from '@/lib/gameRoomV2/answerReveal'
import { seedFromString } from '@/lib/gameRoomV2/gameplay/rng'
import { ta } from '@/components/gameRoomV2/Bi'
import { TA } from '@/lib/gameRoomV2/i18n/ta'

// Live multiplayer polling is DELIBERATELY coarse: racer distance is
// meaningful, server-computed gameplay state, not per-frame animation,
// so it travels over ordinary HTTP polling at a human-perceptible
// cadence. LiveRace3D interpolates between polls so motion stays smooth.
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
  // Present only inside Live Classroom (LivePlayClient.tsx): switches to
  // the multiplayer race, where every racer's position comes from
  // /api/gameroom-v2/live/[id]/race (server-computed, never
  // client-simulated) and difficulty is fixed by the host.
  liveSessionId?: string
  myParticipantId?: string
  fixedDifficulty?: RacingDifficulty
}

// Tamil Grand Prix. Solo: the immersive pseudo-3D racer against Kayal,
// Mugil and Aruvi (components/gameRoomV2/racing3d/RaceGame3D). Live
// Classroom: the same driver-view world with REAL classmates only, whose
// positions are the server's replay of their graded answers.
export function RacingGame({ sessionId, onExit, onPlayAgain, onHome, liveSessionId, myParticipantId, fixedDifficulty }: RacingGameProps) {
  if (liveSessionId && myParticipantId) {
    return <MultiplayerRacingGame sessionId={sessionId} onExit={onExit} liveSessionId={liveSessionId} myParticipantId={myParticipantId} fixedDifficulty={fixedDifficulty} />
  }
  return <RaceGame3D sessionId={sessionId} onExit={onExit} onPlayAgain={onPlayAgain} onHome={onHome} />
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
  // Everyone in the class races the same track (picked from the session).
  const track = useMemo(() => TRACKS[seedFromString(liveSessionId) % TRACKS.length], [liveSessionId])
  const [ready, setReady] = useState(false)
  const [camera, setCamera] = useState<CameraMode>('chase')
  const [liveRace, setLiveRace] = useState<LiveRaceResponse | null>(null)
  const [showQuestion, setShowQuestion] = useState(false)
  const [review, setReview] = useState<{ answer: string; right: string | null; explanation: string | null; id: number } | null>(null)
  const { soundEnabled } = useSoundPreference()
  const { musicEnabled } = useMusicPreference()
  const reduced = !!useGameV2Motion().reduced
  const celebrate = useRef<CelebrationHandle>(null)
  const streak = useRef(0)
  const musicRef = useRef<RaceMusic | null>(null)
  const ambRef = useRef<RaceAmbience | null>(null)
  const raceFinishSoundPlayed = useRef(false)
  const lastAnsweredIndexRef = useRef(-1)
  const { state: sessionState, error, result, poll, togglePause, exit } = useGameSessionState<StatePayload>({ sessionId, enabled: ready, soundEnabled })

  // Poll the server-authoritative race view. Never while paused, and it
  // stops once everyone has finished. Depends on the `raceFinished`
  // BOOLEAN (not liveRace) so a new response doesn't re-trigger a poll.
  const raceFinished = !!liveRace && liveRace.racers.length > 0 && liveRace.racers.every((r) => r.finished)
  useEffect(() => {
    if (!ready || sessionState?.status === 'PAUSED') return
    if (raceFinished) return
    let cancelled = false
    async function pollRace() {
      const res = await fetch(`/api/gameroom-v2/live/${liveSessionId}/race`)
      const data = await res.json().catch(() => null)
      if (!cancelled && res.ok && data) setLiveRace(data)
    }
    pollRace()
    const interval = setInterval(pollRace, LIVE_POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [ready, liveSessionId, sessionState?.status, raceFinished])

  useEffect(() => {
    if (raceFinished && !raceFinishSoundPlayed.current && liveRace) {
      raceFinishSoundPlayed.current = true
      const place = liveRace.racers.findIndex((r) => r.participantId === myParticipantId) + 1
      playSound(place === 1 ? 'podium' : 'finish', soundEnabled)
      musicRef.current?.setMood('silent')
      musicRef.current?.sting(place <= 3 ? 'victory' : 'defeat')
      if (place === 1) celebrate.current?.victory({ message: 'முதல் இடம்!' })
    }
  }, [raceFinished, liveRace, myParticipantId, soundEnabled])

  // Same question-opportunity gate as before, keyed off the session's own
  // currentIndex so a poll landing mid-answer never reopens a question.
  useEffect(() => {
    if (!ready || !sessionState || sessionState.status !== 'ACTIVE' || !sessionState.question) return
    if (sessionState.currentIndex <= lastAnsweredIndexRef.current) return
    if (showQuestion) return
    setShowQuestion(true)
  }, [ready, sessionState, showQuestion])

  // Music: start on the Ready click; final lap mood when anyone is on lap 3.
  useEffect(() => () => {
    musicRef.current?.dispose()
    ambRef.current?.dispose()
  }, [])
  useEffect(() => {
    musicRef.current?.setEnabled(musicEnabled)
    ambRef.current?.setEnabled(musicEnabled)
  }, [musicEnabled])
  const leaderFrac = liveRace && liveRace.trackLength ? Math.max(0, ...liveRace.racers.map((r) => r.distance / liveRace.trackLength)) : 0
  useEffect(() => {
    if (!ready || raceFinished) return
    musicRef.current?.setMood(leaderFrac >= 2 / 3 ? 'boss' : 'battle')
  }, [ready, leaderFrac, raceFinished])

  function handleReady() {
    playSound('button', soundEnabled)
    musicRef.current = new RaceMusic(track.music)
    musicRef.current.start()
    musicRef.current.setMood('battle')
    ambRef.current = new RaceAmbience(track.ambience)
    ambRef.current.start()
    setReady(true)
  }

  function handleAnswerResult(res: AnswerResult) {
    lastAnsweredIndexRef.current = sessionState?.currentIndex ?? lastAnsweredIndexRef.current
    setShowQuestion(false)
    // The server recorded the answer; its boost (or not) shows up on the
    // NEXT /race poll. This client never predicts or applies it itself.
    if (res.correct) {
      streak.current += 1
      setReview(null)
      celebrate.current?.correct({ streak: streak.current, rewards: [{ kind: 'boost' }], baseSoundPlayed: true })
    } else {
      streak.current = 0
      const id = Date.now()
      setReview({ answer: formatAnswer(res.answer), right: res.correctAnswer ?? null, explanation: res.explanation ?? null, id })
      window.setTimeout(() => setReview((r) => (r?.id === id ? null : r)), 6000)
    }
    poll()
  }

  if (!ready || !fixedDifficulty) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-primary-50 to-white p-4">
        <div className="w-full max-w-md rounded-3xl bg-white shadow-xl border border-stone-200 p-5 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta-600">Live Classroom · Racing</p>
          <h1 className="font-tamil text-2xl font-black text-stone-900 mt-1">தமிழ்ப் பந்தயம்</h1>
          <p className="font-tamil text-lg font-bold text-primary-700">{track.tamilName}</p>
          <p className="mt-2 text-sm text-stone-600">
            <span className="font-tamil block text-stone-800">உங்கள் வகுப்புத் தோழர்களுடன் பந்தயம்! ஒவ்வொரு சரியான விடையும் உங்கள் காரை வேகமாக முன்னேற்றும்.</span>
            Race your classmates -- every correct answer speeds your car up.
          </p>
          <div className="mt-3 flex justify-center gap-2" role="radiogroup" aria-label="கேமரா · Camera">
            {(['chase', 'cockpit'] as CameraMode[]).map((c) => (
              <button key={c} type="button" role="radio" aria-checked={camera === c} onClick={() => setCamera(c)} className={`rounded-2xl border-2 px-3 py-2 ${camera === c ? 'border-primary-600 bg-primary-50' : 'border-stone-200'}`}>
                <FiVideo className="w-4 h-4 mx-auto text-stone-600" aria-hidden />
                <span className="font-tamil block text-xs font-bold text-stone-800">{c === 'chase' ? 'காருக்குப் பின்' : 'ஓட்டுநர் இருக்கை'}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={handleReady} disabled={!fixedDifficulty} className="mt-4 w-full min-h-[52px] rounded-2xl bg-primary-700 hover:bg-primary-800 disabled:opacity-50 text-white font-extrabold text-lg">
            <span className="font-tamil">பந்தயத்துக்குத் தயார்</span> <span className="text-sm opacity-80">· Ready</span>
          </button>
        </div>
      </div>
    )
  }

  if (error && !sessionState) return <GameV2Error description={error} onRetry={poll} />
  if (!sessionState || !liveRace) return <GameV2Loading label="தொடக்கக் கோட்டில் அணிவகுக்கிறோம்... · Lining up..." />
  if (result) return <GameResultsScreen result={result} onPlayAgain={undefined} onExit={onExit} />
  if (sessionState.status === 'COMPLETED' && raceFinished) return <GameV2Loading label={ta('calculating', true)} />
  if (raceFinished) return <MultiplayerFinishScreen racers={liveRace.racers} myParticipantId={myParticipantId} onExit={() => exit(onExit)} />

  const paused = sessionState.status === 'PAUSED'
  return (
    <LiveRace3D track={track} race={liveRace} myParticipantId={myParticipantId} camera={camera} paused={paused}>
      <CelebrationLayer ref={celebrate} soundEnabled={soundEnabled} reducedMotion={reduced} />
      <div className="pointer-events-auto absolute right-2 top-2 sm:right-3 sm:top-3 z-30 flex gap-1 [padding-top:env(safe-area-inset-top)]">
        <button type="button" onClick={() => setCamera((c) => (c === 'chase' ? 'cockpit' : 'chase'))} aria-label="கேமரா மாற்று · Switch camera" className="w-11 h-11 rounded-xl bg-white/90 shadow-md text-stone-700 flex items-center justify-center">
          <FiVideo className="w-5 h-5" />
        </button>
        <button type="button" onClick={() => togglePause()} aria-label={paused ? ta('resume', true) : ta('pause', true)} className="w-11 h-11 rounded-xl bg-white/90 shadow-md text-stone-700 flex items-center justify-center">
          {paused ? <FiPlay className="w-5 h-5" /> : <FiPause className="w-5 h-5" />}
        </button>
        <button type="button" onClick={() => exit(onExit)} aria-label={ta('exitGame', true)} className="w-11 h-11 rounded-xl bg-white/90 shadow-md text-stone-700 flex items-center justify-center">
          <FiLogOut className="w-5 h-5" />
        </button>
      </div>
      {paused && (
        <div className="absolute inset-0 z-40 bg-stone-900/50 flex items-center justify-center p-4">
          <div className="rounded-3xl bg-white shadow-2xl p-5 text-center max-w-sm w-full">
            <p className="font-tamil text-2xl font-black text-stone-800">பந்தயம் இடைநிறுத்தம்</p>
            <p className="text-sm text-stone-500">Race paused</p>
            <button type="button" onClick={() => togglePause()} className="mt-3 w-full min-h-[48px] rounded-2xl bg-primary-700 text-white font-bold">
              <span className="font-tamil">{TA.resume.ta}</span>
            </button>
          </div>
        </div>
      )}
      {review && (
        <div className="absolute inset-x-0 top-[28%] z-40 flex justify-center px-3">
          <div className="w-full max-w-md">
            <AnswerReview yourAnswer={review.answer} correctAnswer={review.right} explanation={review.explanation} seed={review.id} onDismiss={() => setReview(null)} />
          </div>
        </div>
      )}
      {showQuestion && sessionState.question && sessionState.status === 'ACTIVE' && (
        <div className="absolute inset-x-0 bottom-0 z-40 flex justify-center p-2 sm:p-4 [padding-bottom:max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="w-full max-w-xl max-h-[62dvh] overflow-y-auto rounded-3xl bg-white/97 shadow-2xl border border-primary-100 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="font-tamil text-sm font-bold text-primary-700">
                {TA.question.ta} {Math.min(sessionState.currentIndex + 1, sessionState.totalQuestions)}/{sessionState.totalQuestions}
              </p>
              <span className="font-tamil rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-black text-gold-800">சரியான விடை = உந்துதல்!</span>
            </div>
            <QuestionOverlay variant="compact" sessionId={sessionId} question={sessionState.question} questionIndex={sessionState.currentIndex} remainingSeconds={sessionState.remainingSeconds} onResult={handleAnswerResult} />
          </div>
        </div>
      )}
    </LiveRace3D>
  )
}
