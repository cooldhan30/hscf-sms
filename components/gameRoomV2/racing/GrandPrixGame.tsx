'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FiFlag, FiAward, FiZap, FiClock, FiPlay } from 'react-icons/fi'
import { GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { QuestionOverlay, type QuestionOverlayQuestion, GameResultsScreen, useSoundPreference, playSound, useGameSessionState, vibrate } from '@/components/gameRoomV2/gameplay'
import { useManagedTimeouts } from '@/components/gameRoomV2/gameplay/useManagedTimeouts'
import { useQuestionGate } from '@/components/gameRoomV2/gameplay/useQuestionGate'
import { ArenaHud } from '@/components/gameRoomV2/gameplay/ArenaHud'
import { GrandPrixTrack, type RaceClock } from './GrandPrixTrack'
import {
  createGp,
  stepGp,
  answerChallenge,
  activateBoost,
  canBoost,
  placeOf,
  standings,
  lapOf,
  LAPS,
  BOOST_COST_MIN,
  STEP_MS_GP,
  type GpState,
  type GpEvent,
} from '@/lib/gameRoomV2/racing/grandPrix'
import { RACING_DIFFICULTY_SETTINGS, type RacingDifficulty } from '@/lib/gameRoomV2/racing'
import { seedFromString } from '@/lib/gameRoomV2/gameplay/rng'
import type { BaseSessionStatePayload } from '@/lib/gameRoomV2/gameplay/sessionPolling'

// Solo Tamil Grand Prix. The race never stops for a question: checkpoint
// challenges appear while you drive, and answering well charges the boost
// you choose when to fire. The server grades every answer (QuestionOverlay
// -> /answer) and computes score/XP at /complete; the session is paused
// server-side between challenges (useQuestionGate) so the question clock
// only runs while a card is on screen.

interface StatePayload extends BaseSessionStatePayload {
  remainingSeconds: number | null
  question: QuestionOverlayQuestion | null
}

interface Hud {
  place: number
  lap: number
  meter: number
  boosting: boolean
  streak: number
  timeMs: number
  checkpointsPassed: number
  playerFinished: boolean
  raceOver: boolean
  standings: { id: string; name: string; color: string; isPlayer: boolean; finishedAt: number | null }[]
}

function snap(s: GpState): Hud {
  const me = s.racers[0]
  return {
    place: placeOf(s, me.id),
    lap: lapOf(me.dist),
    meter: Math.round(s.meter),
    boosting: s.boosting,
    streak: s.streak,
    timeMs: Math.max(0, s.timeMs),
    checkpointsPassed: s.checkpointsPassed,
    playerFinished: me.finishedAt !== null,
    raceOver: s.raceOver,
    standings: standings(s).map((r) => ({ id: r.id, name: r.name, color: r.color, isPlayer: r.isPlayer, finishedAt: r.finishedAt })),
  }
}

const ORDINAL = ['1st', '2nd', '3rd', '4th']
const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`

export function GrandPrixGame({ sessionId, onExit, onPlayAgain, onHome }: { sessionId: string; onExit: () => void; onPlayAgain?: () => void; onHome?: () => void }) {
  const [difficulty, setDifficulty] = useState<RacingDifficulty | null>(null)
  const gpRef = useRef<GpState | null>(null)
  const clockRef = useRef<RaceClock>({ lastStepAt: 0, running: false })
  const [hud, setHud] = useState<Hud | null>(null)
  const [userPaused, setUserPaused] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [answeredIndex, setAnsweredIndex] = useState(-1)
  const { soundEnabled, toggleSound } = useSoundPreference()
  const soundRef = useRef(soundEnabled)
  soundRef.current = soundEnabled
  const schedule = useManagedTimeouts()
  const { state: session, error, result, poll, exit } = useGameSessionState<StatePayload>({ sessionId, enabled: !!difficulty, soundEnabled })

  const refresh = useCallback(() => {
    if (gpRef.current) setHud(snap(gpRef.current))
  }, [])

  const flash = useCallback(
    (text: string, ms = 1400) => {
      setBanner(text)
      schedule(() => setBanner((cur) => (cur === text ? null : cur)), ms)
    },
    [schedule]
  )

  const handleEvents = useCallback(
    (events: GpEvent[]) => {
      const snd = soundRef.current
      for (const e of events) {
        if (e.type === 'countdown') {
          setCountdown(String(e.n))
          playSound('countdown', snd)
        } else if (e.type === 'go') {
          setCountdown('GO!')
          playSound('waveStart', snd)
          schedule(() => setCountdown(null), 700)
        } else if (e.type === 'lap') {
          flash(e.lap === LAPS ? 'Final lap!' : `Lap ${e.lap}`)
          playSound('checkpoint', snd)
        } else if (e.type === 'overtake') {
          flash(`Passed ${e.name}!`, 1000)
          playSound('streak', snd, 3)
        } else if (e.type === 'boostStart') {
          playSound('ability', snd)
        } else if (e.type === 'finish' && e.racerId === 'player') {
          flash(`You finished ${ORDINAL[e.place - 1]}!`, 2500)
          playSound(e.place === 1 ? 'victory' : 'checkpoint', snd)
          vibrate(e.place === 1 ? 'victory' : 'button', snd)
        }
      }
    },
    [flash, schedule]
  )

  useEffect(() => {
    if (!difficulty || !session || gpRef.current) return
    gpRef.current = createGp({ seed: seedFromString(sessionId), difficulty, totalQuestions: session.totalQuestions })
    refresh()
  }, [difficulty, session, sessionId, refresh])

  const answered = session?.currentIndex ?? 0
  const sessionDone = session?.status === 'COMPLETED' || !!result
  const pending = hud ? Math.max(0, hud.checkpointsPassed - answered) : 0
  const remaining = session ? Math.max(0, session.totalQuestions - answered) : 0
  const raceFinished = !!hud?.raceOver
  const wantQuestion = !!hud && !userPaused && !sessionDone && (pending > 0 || (raceFinished && remaining > 0))
  const { questionReady } = useQuestionGate({ sessionId, state: session, wantQuestion, poll, enabled: !!hud })
  const showQuestion = questionReady && !!session?.question && session.currentIndex > answeredIndex

  // Race loop (fixed 30 Hz steps on requestAnimationFrame; HUD ~8 Hz).
  const simRunning = !!hud && !hud.raceOver && !userPaused
  useEffect(() => {
    if (!simRunning) {
      clockRef.current.running = false
      return
    }
    let raf = 0
    let last = performance.now()
    let acc = 0
    let hudAcc = 0
    clockRef.current = { lastStepAt: last, running: true }
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const gp = gpRef.current
      if (!gp) return
      const dt = Math.min(250, now - last)
      last = now
      acc += dt
      let stepped = false
      while (acc >= STEP_MS_GP && !gp.raceOver) {
        handleEvents(stepGp(gp))
        acc -= STEP_MS_GP
        stepped = true
      }
      if (stepped) clockRef.current.lastStepAt = now
      hudAcc += dt
      if (hudAcc > 120 || gp.raceOver) {
        hudAcc = 0
        refresh()
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [simRunning, handleEvents, refresh])

  const boost = useCallback(() => {
    const gp = gpRef.current
    if (!gp) return
    const ev: GpEvent[] = []
    if (activateBoost(gp, ev)) handleEvents(ev)
    refresh()
  }, [handleEvents, refresh])

  // Space bar = boost (desktop).
  useEffect(() => {
    if (!simRunning) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        boost()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [simRunning, boost])

  function handleAnswer(res: { correct: boolean; points: number }) {
    const gp = gpRef.current
    if (!gp || !session) return
    setAnsweredIndex(session.currentIndex)
    const ev: GpEvent[] = []
    const charged = answerChallenge(gp, res, ev)
    setToast(res.correct ? `+${Math.round(charged)} boost${gp.streak >= 2 ? ` · combo x${gp.streak}` : ''}` : 'Spun out! -30 boost')
    schedule(() => setToast(null), 1500)
    refresh()
    poll()
  }

  const leave = () => exit(onExit)
  const again = () => exit(onPlayAgain ?? onExit)

  if (!difficulty) {
    return (
      <div className="w-full max-w-xl mx-auto px-4 py-6">
        <div className="rounded-3xl bg-gradient-to-b from-slate-800 to-slate-900 border border-white/10 p-6 text-white shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-yellow-300">Racing</p>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1">Tamil Grand Prix</h1>
          <p className="font-tamil leading-relaxed text-lg text-slate-300">தமிழ் பந்தயம்</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-200">
            <li>Three laps against Kayal, Mugil and Aruvi.</li>
            <li>Checkpoint challenges pop up as you drive. Correct answers charge your boost -- faster answers and combos charge more.</li>
            <li>Fire your boost (button or Space) at the right moment to overtake. A wrong answer costs some boost and a brief slowdown.</li>
          </ul>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Difficulty">
            {RACING_DIFFICULTY_SETTINGS.map((d) => (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={false}
                onClick={() => setDifficulty(d.id)}
                className="text-left rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 p-3 min-h-[44px]"
              >
                <p className="font-semibold">{d.label}</p>
                <p className="text-xs text-slate-300">{d.id === 'easy' ? 'Relaxed rivals' : d.id === 'normal' ? 'Evenly matched' : 'Fast, sharp rivals'}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error && !session) return <GameV2Error description={error} onRetry={poll} />
  if (!session || !hud || !gpRef.current) return <GameV2Loading label="Warming up the engines..." />
  const gp = gpRef.current

  if (raceFinished && result) {
    const place = placeOf(gp, 'player')
    const me = gp.racers[0]
    return (
      <div className="min-h-screen w-full bg-slate-950 px-4 py-8">
        <GameResultsScreen
          result={result}
          headline={place === 1 ? 'Victory -- 1st place!' : `You finished ${ORDINAL[place - 1]}`}
          subline={place === 1 ? 'Nobody could catch you.' : 'Answer faster to charge your boost sooner.'}
          gameStats={[
            { label: 'Place', value: `${ORDINAL[place - 1]} of 4` },
            { label: 'Race time', value: me.finishedAt !== null ? fmt(me.finishedAt) : '--' },
            { label: 'Boosts', value: gp.stats.boostsUsed },
            { label: 'Overtakes', value: gp.stats.overtakes },
            { label: 'Best combo', value: `x${gp.stats.bestStreak}` },
          ]}
          onPlayAgain={onPlayAgain ? again : undefined}
          onExit={onExit}
          onHome={onHome}
        />
      </div>
    )
  }

  const boostReady = canBoost(gp)

  return (
    <div className="min-h-screen w-full bg-slate-950 text-white">
      <ArenaHud
        stats={[
          { icon: FiAward, label: 'Position', value: `${ORDINAL[hud.place - 1]}/4`, tone: hud.place === 1 ? 'gold' : 'default' },
          { icon: FiFlag, label: 'Lap', value: `${hud.lap}/${LAPS}` },
          { icon: FiClock, label: 'Time', value: fmt(hud.timeMs) },
          ...(hud.streak >= 2 ? [{ icon: FiZap, label: 'Combo', value: `x${hud.streak}`, tone: 'good' as const }] : []),
        ]}
        paused={userPaused}
        onTogglePause={() => setUserPaused((p) => !p)}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        onExit={leave}
      />
      <div className="max-w-6xl mx-auto px-3 py-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative min-w-0">
          <GrandPrixTrack stateRef={gpRef} clockRef={clockRef} />
          <div aria-live="assertive" className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {countdown && <p className="text-6xl sm:text-8xl font-black text-yellow-300 drop-shadow-[0_4px_0_rgba(0,0,0,0.6)] animate-gamev2-pop-in">{countdown}</p>}
          </div>
          <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            {banner && <p className="rounded-2xl bg-slate-900/90 border border-white/20 px-5 py-2 text-lg font-bold animate-gamev2-pop-in">{banner}</p>}
          </div>
          {userPaused && (
            <div className="absolute inset-0 rounded-2xl bg-slate-950/70 flex items-center justify-center">
              <button type="button" onClick={() => setUserPaused(false)} className="inline-flex items-center gap-2 min-h-[52px] px-6 rounded-2xl bg-yellow-400 text-slate-900 font-bold text-lg">
                <FiPlay className="w-5 h-5" aria-hidden /> Resume
              </button>
            </div>
          )}

          {/* Boost meter + button: right under the track, reachable by thumb. */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                <span className="font-semibold">Boost</span>
                <span className="tabular-nums">{hud.meter}%</span>
              </div>
              <div className="h-4 rounded-full bg-white/10 overflow-hidden relative" aria-hidden>
                <div
                  className={`h-full rounded-full transition-[width] duration-150 ${hud.boosting ? 'bg-orange-400' : hud.meter >= BOOST_COST_MIN ? 'bg-yellow-400' : 'bg-slate-500'}`}
                  style={{ width: `${hud.meter}%` }}
                />
                <div className="absolute inset-y-0 border-l border-white/60" style={{ left: `${BOOST_COST_MIN}%` }} />
              </div>
            </div>
            <button
              type="button"
              onClick={boost}
              disabled={!boostReady}
              className={`min-w-[112px] min-h-[56px] rounded-2xl font-black text-lg tracking-wide transition-colors ${
                hud.boosting ? 'bg-orange-500 text-white' : 'bg-yellow-400 hover:bg-yellow-300 text-slate-900 disabled:bg-slate-700 disabled:text-slate-400'
              }`}
            >
              {hud.boosting ? 'BOOSTING' : 'BOOST'}
            </button>
          </div>
        </div>

        <aside className={`space-y-3 ${showQuestion ? 'order-first lg:order-none' : ''}`}>
          {toast && (
            <div role="status" className="rounded-xl bg-yellow-400 text-slate-900 px-3 py-2 text-sm font-bold text-center">
              {toast}
            </div>
          )}
          {(pending > 0 || (raceFinished && remaining > 0)) && !sessionDone && (
            <div className="rounded-2xl bg-slate-900/80 border border-yellow-300/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-yellow-300">
                {raceFinished ? 'Post your time -- last challenges' : 'Checkpoint challenge'}
              </p>
              <div className="mt-2">
                {showQuestion && session.question ? (
                  <QuestionOverlay variant="compact" sessionId={sessionId} question={session.question} questionIndex={session.currentIndex} remainingSeconds={session.remainingSeconds} onResult={handleAnswer} />
                ) : (
                  <GameV2Loading label="Next challenge..." />
                )}
              </div>
            </div>
          )}
          <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-3">
            <p className="text-sm font-semibold mb-2">Standings</p>
            <ol className="space-y-1.5">
              {hud.standings.map((r, i) => (
                <li key={r.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${r.isPlayer ? 'bg-yellow-400/15 font-bold' : ''}`}>
                  <span className="w-8 tabular-nums text-slate-400">{ORDINAL[i]}</span>
                  <span className="w-3 h-3 rounded-full" style={{ background: r.color }} aria-hidden />
                  <span className="flex-1">{r.name}</span>
                  {r.finishedAt !== null && <span className="text-xs text-slate-400 tabular-nums">{fmt(r.finishedAt)}</span>}
                </li>
              ))}
            </ol>
          </div>
          {raceFinished && remaining === 0 && !result && <GameV2Loading label="Calculating your results..." />}
        </aside>
      </div>
    </div>
  )
}
