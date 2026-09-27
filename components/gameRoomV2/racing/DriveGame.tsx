'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FiPause, FiPlay, FiVolume2, FiVolumeX, FiLogOut, FiRotateCcw, FiCheckCircle, FiXCircle } from 'react-icons/fi'
import { GameV2Error } from '@/components/gameRoomV2'
import { useGameV2Motion } from '@/components/gameRoomV2/useGameV2Motion'
import { QuestionOverlay, type QuestionOverlayQuestion, type AnswerResult, useSoundPreference, playSound, useGameSessionState, vibrate } from '@/components/gameRoomV2/gameplay'
import { useManagedTimeouts } from '@/components/gameRoomV2/gameplay/useManagedTimeouts'
import { useQuestionGate } from '@/components/gameRoomV2/gameplay/useQuestionGate'
import { DriveCanvas } from './DriveCanvas'
import { TouchControls } from './TouchControls'
import { emptyControls, readControls, useDriveKeyboard } from './useDriveInput'
import { useEngineSound } from './useEngineSound'
import { RaceCelebration, fmtTime, type RaceSummary } from './RaceCelebration'
import {
  createDrive,
  stepDrive,
  applyAnswer,
  drainEvents,
  canBoost,
  recover,
  wrongWay,
  player,
  standings,
  placeOf,
  kmh,
  LAPS,
  BOOST_MIN,
  STEP_S,
  QUESTION_TIME_SCALE,
  type DriveDifficulty,
  type DriveEvent,
  type DriveState,
} from '@/lib/gameRoomV2/racing/drive'
import { formatAnswer } from '@/lib/gameRoomV2/answerReveal'
import { seedFromString } from '@/lib/gameRoomV2/gameplay/rng'
import type { BaseSessionStatePayload } from '@/lib/gameRoomV2/gameplay/sessionPolling'
import { Bi, ta } from '@/components/gameRoomV2/Bi'
import { TA } from '@/lib/gameRoomV2/i18n/ta'

// Tamil Grand Prix: a real top-down arcade racer. The student drives
// (arrows / WASD, or the on-screen pad and pedals), races three rivals
// over three laps, and finishes wherever their driving puts them.
// Learning gates on the track open a compact Tamil question -- the world
// slows to a crawl and the car steers itself meanwhile -- and correct
// answers charge the boost the student fires themselves.
//
// Server-authoritative as before: QuestionOverlay posts each answer to
// /answer (graded there), useQuestionGate pauses the session whenever no
// question is on screen, and XP/coins/achievements come from /complete.
// Finishing position is in-match only and never sent to the server.

interface StatePayload extends BaseSessionStatePayload {
  remainingSeconds: number | null
  question: QuestionOverlayQuestion | null
}

interface Hud {
  place: number
  lap: number
  speed: number
  meter: number
  boosting: boolean
  streak: number
  time: number
  wrongWay: boolean
  stuck: boolean
  started: boolean
  finished: boolean
  raceOver: boolean
  gatesPassed: number
  standings: { id: string; name: string; color: string; isPlayer: boolean }[]
}

const ORD = ['1st', '2nd', '3rd', '4th']
const ORD_TA = ['முதல்', 'இரண்டாம்', 'மூன்றாம்', 'நான்காம்']
const DIFFS: { id: DriveDifficulty; label: string; blurb: string }[] = [
  { id: 'easy', label: 'Easy', blurb: 'பொறுமையான போட்டியாளர்கள்' },
  { id: 'normal', label: 'Normal', blurb: 'நெருக்கமான பந்தயம்' },
  { id: 'hard', label: 'Hard', blurb: 'வேகமான, கூர்மையான போட்டியாளர்கள்' },
]

function snap(s: DriveState, stuckFor: number): Hud {
  const me = player(s)
  return {
    place: placeOf(s, 'player'),
    lap: Math.min(LAPS, Math.max(1, me.lap + 1)),
    speed: kmh(me.speed),
    meter: Math.round(s.meter),
    boosting: s.boosting || me.boostT > 0,
    streak: s.streak,
    time: Math.max(0, s.time),
    wrongWay: wrongWay(s),
    stuck: stuckFor > 2.2,
    started: s.started,
    finished: me.finishedAt !== null,
    raceOver: s.raceOver,
    gatesPassed: s.nextGate,
    standings: standings(s).map((c) => ({ id: c.id, name: c.isPlayer ? 'You' : c.name, color: c.color, isPlayer: c.isPlayer })),
  }
}

function readRecords(difficulty: DriveDifficulty, time: number | null, bestLap: number | null): string[] {
  // Personal bests live on this device only (a convenience, never a
  // reward): nothing here is sent to the server.
  const out: string[] = []
  try {
    const key = `tamizhi.gp.best.${difficulty}`
    const prev = JSON.parse(window.localStorage.getItem(key) || '{}') as { time?: number; lap?: number }
    const next = { ...prev }
    if (time !== null && (prev.time === undefined || time < prev.time)) {
      if (prev.time !== undefined) out.push('புதிய சிறந்த நேரம்!')
      next.time = time
    }
    if (bestLap !== null && (prev.lap === undefined || bestLap < prev.lap)) {
      if (prev.lap !== undefined) out.push('புதிய சிறந்த சுற்று!')
      next.lap = bestLap
    }
    window.localStorage.setItem(key, JSON.stringify(next))
  } catch {
    // Storage unavailable: no records, the race is unaffected.
  }
  return out
}

export function DriveGame({ sessionId, onExit, onPlayAgain, onHome }: { sessionId: string; onExit: () => void; onPlayAgain?: () => void; onHome?: () => void }) {
  const [difficulty, setDifficulty] = useState<DriveDifficulty | null>(null)
  const driveRef = useRef<DriveState | null>(null)
  const controls = useRef(emptyControls())
  const [hud, setHud] = useState<Hud | null>(null)
  const [paused, setPaused] = useState(false)
  const [banner, setBanner] = useState<{ text: string; tone: 'gold' | 'teal' | 'orange'; id: number } | null>(null)
  const [count, setCount] = useState<{ text: string; id: number } | null>(null)
  const [feedback, setFeedback] = useState<{ correct: boolean; gain: number; answer: string; right: string | null; explanation: string | null; id: number } | null>(null)
  const [answeredIndex, setAnsweredIndex] = useState(-1)
  const [summary, setSummary] = useState<RaceSummary | null>(null)
  const [touchUi, setTouchUi] = useState(false)
  const [portraitPhone, setPortraitPhone] = useState(false)
  const stuckFor = useRef(0)
  const bannerId = useRef(0)
  const lastBannerAt = useRef(0)
  const reduced = !!useGameV2Motion().reduced
  const { soundEnabled, toggleSound } = useSoundPreference()
  const soundRef = useRef(soundEnabled)
  soundRef.current = soundEnabled
  const schedule = useManagedTimeouts()
  const { state: session, error, result, poll, exit } = useGameSessionState<StatePayload>({ sessionId, enabled: !!difficulty, soundEnabled })

  // A preview race sits on the grid behind the difficulty picker.
  if (!driveRef.current) driveRef.current = createDrive({ seed: seedFromString(sessionId), difficulty: 'normal', questions: 0 })

  // Touch UI when the device has a coarse pointer (tablets, phones) or
  // the first touch arrives.
  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)')
    const orient = () => setPortraitPhone(window.innerHeight > window.innerWidth && window.innerWidth < 600)
    setTouchUi(coarse.matches)
    orient()
    const onTouch = (e: PointerEvent) => {
      if (e.pointerType === 'touch') setTouchUi(true)
    }
    window.addEventListener('pointerdown', onTouch)
    window.addEventListener('resize', orient)
    return () => {
      window.removeEventListener('pointerdown', onTouch)
      window.removeEventListener('resize', orient)
    }
  }, [])

  // Automated browser playtests (opt-in via localStorage) read the local
  // simulation to steer with real key presses. Client-side race state
  // only -- nothing here reaches or affects the server.
  useEffect(() => {
    try {
      if (window.localStorage.getItem('tamizhi.e2e') === '1') (window as unknown as { __tamizhiRace?: unknown }).__tamizhiRace = driveRef
    } catch {
      // storage unavailable
    }
  }, [])

  const refresh = useCallback(() => {
    if (driveRef.current) setHud(snap(driveRef.current, stuckFor.current))
  }, [])

  const flash = useCallback(
    (text: string, tone: 'gold' | 'teal' | 'orange' = 'teal', force = false) => {
      const now = performance.now()
      if (!force && now - lastBannerAt.current < 1100) return
      lastBannerAt.current = now
      const id = ++bannerId.current
      setBanner({ text, tone, id })
      schedule(() => setBanner((b) => (b?.id === id ? null : b)), 1800)
    },
    [schedule]
  )

  const handleEvents = useCallback(
    (events: DriveEvent[]) => {
      const snd = soundRef.current
      for (const e of events) {
        if (e.type === 'countdown') {
          setCount({ text: String(e.n), id: Date.now() + e.n })
          playSound('countdown', snd)
        } else if (e.type === 'go') {
          setCount({ text: TA.go.ta, id: Date.now() })
          playSound('go', snd)
          schedule(() => setCount(null), 900)
        } else if (e.type === 'lap' && e.carId === 'player') {
          if (e.lap < LAPS - 1) flash(`${TA.lap.ta} ${e.lap + 1} / ${LAPS}`, 'teal', true)
          if (e.best && e.lap > 1) schedule(() => flash('புதிய சிறந்த சுற்று!', 'gold', true), 1300)
        } else if (e.type === 'finalLap') {
          flash('இறுதிச் சுற்று!', 'orange', true)
          playSound('finalLap', snd)
        } else if (e.type === 'overtake') {
          flash(`அருமையான முந்துதல்! ${ORD_TA[e.place - 1]} இடம்`, 'gold')
          playSound('overtake', snd)
        } else if (e.type === 'boostReady') {
          flash('உந்துதல் தயார்!', 'orange')
        } else if (e.type === 'boostStart') {
          playSound('boost', snd)
          vibrate('button', snd)
        } else if (e.type === 'bump' && e.hard) {
          playSound('baseHit', snd)
          vibrate('incorrect', snd)
        } else if (e.type === 'finish' && e.carId === 'player') {
          flash(TA.finish.ta, 'gold', true)
          playSound('finish', snd)
          vibrate('victory', snd)
        }
      }
    },
    [flash, schedule]
  )

  // Build the real race once the session (question count) is known.
  const [raceBuilt, setRaceBuilt] = useState(false)
  useEffect(() => {
    if (!difficulty || !session || raceBuilt) return
    driveRef.current = createDrive({ seed: seedFromString(sessionId), difficulty, questions: session.totalQuestions })
    setRaceBuilt(true)
    refresh()
  }, [difficulty, session, sessionId, raceBuilt, refresh])

  // Question flow: a passed learning gate owes a question.
  const answered = session?.currentIndex ?? 0
  const sessionDone = session?.status === 'COMPLETED' || !!result
  const remaining = session ? Math.max(0, session.totalQuestions - answered) : 0
  const pending = hud ? Math.max(0, hud.gatesPassed - answered) : 0
  const raceOver = !!hud?.raceOver
  const wantQuestion = raceBuilt && !paused && !sessionDone && (pending > 0 || (raceOver && remaining > 0))
  const { questionReady } = useQuestionGate({ sessionId, state: session, wantQuestion, poll, enabled: raceBuilt })
  const showQuestion = questionReady && !!session?.question && session.currentIndex > answeredIndex

  // While a question is on screen: slow-motion world, car on autopilot.
  useEffect(() => {
    const s = driveRef.current
    if (!s || !raceBuilt) return
    const slow = showQuestion || (pending > 0 && !raceOver)
    s.timeScale = slow ? QUESTION_TIME_SCALE : 1
    s.autopilot = slow
  }, [showQuestion, pending, raceOver, raceBuilt])

  // Race loop: fixed 60 Hz steps on requestAnimationFrame; HUD ~10 Hz.
  const simRunning = raceBuilt && !paused && !raceOver
  useEffect(() => {
    if (!simRunning) return
    let raf = 0
    let last = performance.now()
    let acc = 0
    let hudAcc = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const s = driveRef.current
      if (!s) return
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      acc += dt
      const c = controls.current
      if (c.recoverRequested) {
        c.recoverRequested = false
        if (s.started && player(s).finishedAt === null) recover(s)
      }
      while (acc >= STEP_S && !s.raceOver) {
        const { throttle, brake, steer } = readControls(c)
        const boost = c.boostRequested
        c.boostRequested = false
        handleEvents(stepDrive(s, { throttle, brake, steer, boost }))
        acc -= STEP_S
      }
      const me = player(s)
      const stuckNow = s.started && me.finishedAt === null && !s.autopilot && ((Math.abs(me.speed) < 25 && me.offRoad) || wrongWay(s))
      stuckFor.current = stuckNow ? stuckFor.current + dt : 0
      hudAcc += dt
      if (hudAcc > 0.1 || s.raceOver) {
        hudAcc = 0
        refresh()
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [simRunning, handleEvents, refresh])

  const togglePause = useCallback(() => {
    if (!raceBuilt || raceOver) return
    setPaused((p) => !p)
  }, [raceBuilt, raceOver])
  useDriveKeyboard({ controls, enabled: raceBuilt && !paused && !raceOver, onPause: togglePause })
  useEngineSound(driveRef, simRunning && !!hud?.started, soundEnabled)

  function handleAnswer(res: AnswerResult) {
    const s = driveRef.current
    if (!s || !session) return
    setAnsweredIndex(session.currentIndex)
    const gain = applyAnswer(s, { correct: res.correct, points: res.points })
    handleEvents(drainEvents(s))
    const id = Date.now()
    setFeedback({ correct: res.correct, gain: Math.round(gain), answer: formatAnswer(res.answer), right: res.correctAnswer ?? null, explanation: res.explanation ?? null, id })
    schedule(() => setFeedback((f) => (f?.id === id ? null : f)), res.correct ? 1900 : 5200)
    if (res.correct && s.streak >= 3) schedule(() => flash(`${s.streak} ANSWER STREAK!`, 'gold'), 400)
    refresh()
    poll()
  }

  // Once the race is over and every question is answered, build the
  // summary for the podium (standings are final at this point).
  useEffect(() => {
    const s = driveRef.current
    if (!s || !raceOver || summary || remaining > 0) return
    const me = player(s)
    const place = placeOf(s, 'player')
    const records = readRecords(s.difficulty, me.finishedAt, me.bestLap)
    if (s.stats.worstPlace === 4 && place <= 3 && s.stats.overtakes > 0) records.push('அற்புதமான மீள்வருகை!')
    if (s.stats.cleanLaps === LAPS) records.push('தவறில்லாத பந்தயம்!')
    else if (s.stats.cleanLaps > 0) records.push(`${s.stats.cleanLaps} தவறில்லாச் சுற்றுகள்`)
    const t = window.setTimeout(
      () =>
        setSummary({
          standings: standings(s).map((c) => ({ id: c.id, name: c.name, color: c.color, isPlayer: c.isPlayer, finishedAt: c.finishedAt })),
          place,
          time: me.finishedAt,
          bestLap: me.bestLap,
          overtakes: s.stats.overtakes,
          boostsUsed: s.stats.boostsUsed,
          topSpeed: s.stats.topSpeed,
          bestStreak: s.stats.bestStreak,
          correct: s.stats.correct,
          answered: s.stats.answered,
          cleanLaps: s.stats.cleanLaps,
          comeback: s.stats.worstPlace === 4 && place <= 3,
          records,
        }),
      reduced ? 0 : 1200
    )
    return () => window.clearTimeout(t)
  }, [raceOver, summary, remaining, reduced])

  const leave = () => exit(onExit)
  const again = () => exit(onPlayAgain ?? onExit)

  if (error && !session && difficulty) return <GameV2Error description={error} onRetry={poll} />

  if (summary) {
    return (
      <RaceCelebration
        summary={summary}
        result={result}
        soundEnabled={soundEnabled}
        reducedMotion={reduced}
        onRaceAgain={onPlayAgain ? again : undefined}
        onNext={onHome}
        onBack={onHome ?? onExit}
      />
    )
  }

  const s = driveRef.current
  const me = s ? player(s) : null
  const boostReady = !!s && canBoost(s)
  const bannerTone = banner?.tone === 'gold' ? 'bg-gold-400 text-stone-900' : banner?.tone === 'orange' ? 'bg-terracotta-500 text-white' : 'bg-primary-700 text-white'

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#6fb34d] font-sans select-none">
      <DriveCanvas stateRef={driveRef} reducedMotion={reduced} />

      {/* HUD */}
      {raceBuilt && hud && (
        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2 sm:p-3 pointer-events-none [padding-top:max(0.5rem,env(safe-area-inset-top))]">
          <div className="flex items-stretch gap-1.5 sm:gap-2 pointer-events-auto">
            <div className="rounded-2xl bg-white/90 shadow-md px-2.5 sm:px-3 py-1.5 text-center min-w-[56px]" aria-label={`${ta('position', true)}: ${hud.place} / 4`}>
              <p className="text-2xl sm:text-3xl font-black text-primary-700 leading-none tabular-nums">
                {hud.place}
                <span className="text-sm align-top">{ORD[hud.place - 1].slice(1)}</span>
              </p>
              <p className="text-[10px] font-bold tracking-wide text-stone-500 font-tamil">{TA.position.ta} /4</p>
            </div>
            <div className="rounded-2xl bg-white/90 shadow-md px-2.5 sm:px-3 py-1.5 text-center" aria-label={`${ta('lap', true)}: ${hud.lap} / ${LAPS}`}>
              <p className="text-lg sm:text-xl font-black text-stone-800 leading-none tabular-nums">
                {hud.lap}/{LAPS}
              </p>
              <p className="text-[10px] font-bold tracking-wide text-stone-500 font-tamil">{TA.lap.ta}</p>
            </div>
            <div className="hidden sm:block rounded-2xl bg-white/90 shadow-md px-3 py-1.5 text-center">
              <p className="text-lg sm:text-xl font-black text-stone-800 leading-none tabular-nums">{hud.speed}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">km/h</p>
            </div>
            <div className="rounded-2xl bg-white/90 shadow-md px-2.5 sm:px-3 py-1.5 w-24 sm:w-40" aria-label={`உந்துதல் · Boost ${hud.meter}%`}>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-stone-500">
                <span className="font-tamil normal-case">உந்துதல்</span>
                <span className="tabular-nums">{hud.streak >= 2 ? `x${hud.streak}` : `${hud.meter}%`}</span>
              </div>
              <div className="mt-1 h-3 rounded-full bg-stone-200 overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-[width] duration-150 ${hud.boosting ? 'bg-terracotta-500' : hud.meter >= BOOST_MIN ? 'bg-gold-400' : 'bg-stone-400'}`}
                  style={{ width: `${hud.meter}%` }}
                />
                <div className="absolute inset-y-0 border-l-2 border-white" style={{ left: `${BOOST_MIN}%` }} />
              </div>
              {!touchUi && <p className="font-tamil mt-0.5 text-[10px] text-stone-500">{hud.boosting ? 'பாய்கிறது!' : hud.meter >= BOOST_MIN ? 'SPACE அழுத்துங்கள்' : 'விடையளித்து நிரப்புங்கள்'}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1 pointer-events-auto shrink-0">
            <span className="hidden md:inline rounded-xl bg-white/90 shadow-md px-2.5 py-1 text-sm font-bold tabular-nums text-stone-700">{fmtTime(hud.time)}</span>
            <button type="button" onClick={togglePause} aria-label={paused ? ta('resume', true) : ta('pause', true)} className="w-11 h-11 rounded-xl bg-white/90 shadow-md text-stone-700 flex items-center justify-center">
              {paused ? <FiPlay className="w-5 h-5" /> : <FiPause className="w-5 h-5" />}
            </button>
            <button type="button" onClick={toggleSound} aria-label={soundEnabled ? ta('muteSound', true) : ta('soundOn', true)} className="w-11 h-11 rounded-xl bg-white/90 shadow-md text-stone-700 flex items-center justify-center">
              {soundEnabled ? <FiVolume2 className="w-5 h-5" /> : <FiVolumeX className="w-5 h-5" />}
            </button>
            <button type="button" onClick={leave} aria-label={ta('exitGame', true)} className="w-11 h-11 rounded-xl bg-white/90 shadow-md text-stone-700 flex items-center justify-center">
              <FiLogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Countdown and event banners */}
      <div aria-live="assertive" className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
        {count && (
          <p key={count.id} className={`font-black drop-shadow-[0_6px_0_rgba(15,118,110,0.45)] animate-gamev2-count ${count.text === TA.go.ta ? 'text-7xl sm:text-9xl text-gold-400 font-tamil' : 'text-8xl sm:text-9xl text-white'}`}>
            {count.text}
          </p>
        )}
      </div>
      <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-[4.5rem] z-20 flex justify-center px-4">
        {banner && (
          <p key={banner.id} className={`font-tamil rounded-2xl px-5 py-2 text-lg sm:text-2xl font-black tracking-wide shadow-lg animate-gamev2-banner ${bannerTone}`}>
            {banner.text}
          </p>
        )}
      </div>
      {hud && !showQuestion && (hud.wrongWay || hud.stuck) && !hud.finished && (
        <div className="absolute inset-x-0 top-40 z-20 flex justify-center">
          <button
            type="button"
            onClick={() => {
              controls.current.recoverRequested = true
            }}
            className="rounded-2xl bg-white shadow-lg px-4 py-2 font-bold text-terracotta-700 inline-flex items-center gap-2 min-h-[44px]"
          >
            <FiRotateCcw className="w-4 h-4" aria-hidden /> <span className="font-tamil">{hud.wrongWay ? 'தவறான திசை!' : 'சிக்கிக்கொண்டீர்களா?'} {touchUi ? 'தொட்டு மீட்டமையுங்கள்' : 'R அழுத்தி மீட்டமையுங்கள்'}</span>
          </button>
        </div>
      )}

      {/* Answer feedback: never blocks driving. */}
      {feedback && (
        <div className="absolute inset-x-0 top-[8rem] z-30 flex justify-center px-3 pointer-events-none">
          <div role="status" className={`pointer-events-auto max-w-md w-full rounded-2xl shadow-xl border-2 px-4 py-3 bg-white ${feedback.correct ? 'border-primary-400' : 'border-terracotta-300'}`}>
            <p className={`flex items-center gap-2 text-lg font-black ${feedback.correct ? 'text-primary-700' : 'text-terracotta-700'}`}>
              {feedback.correct ? <FiCheckCircle className="w-5 h-5" aria-hidden /> : <FiXCircle className="w-5 h-5" aria-hidden />}
              <span className="font-tamil">{feedback.correct ? `${TA.correct.ta} +${feedback.gain} உந்துதல்` : TA.notQuite.ta}</span>
            </p>
            {!feedback.correct && (
              <div className="mt-1 text-sm text-stone-700 space-y-0.5">
                <p>
                  <span className="font-tamil">{TA.yourAnswer.ta}:</span> <span className="font-tamil font-semibold">{feedback.answer}</span>
                </p>
                {feedback.right && (
                  <p>
                    <span className="font-tamil">{TA.correctAnswer.ta}:</span> <span className="font-tamil font-bold text-primary-800">{feedback.right}</span>
                  </p>
                )}
                {feedback.explanation && <p className="font-tamil leading-relaxed text-stone-600">{feedback.explanation}</p>}
              </div>
            )}
            <button type="button" onClick={() => setFeedback(null)} className="sr-only">
              மூடு · Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Tamil checkpoint question */}
      {(showQuestion || (raceOver && remaining > 0 && !sessionDone)) && (
        <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center p-3 sm:p-5 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="w-full max-w-lg max-h-[84vh] overflow-y-auto rounded-3xl bg-white/95 shadow-2xl border border-primary-100 p-3 sm:p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-700 mb-1">
              <span className="font-tamil normal-case tracking-normal text-sm">{raceOver ? 'மேடைக்கு முன் கடைசிச் சவால்' : 'தமிழ்ச் சோதனைச் சாவடி -- விடையளித்து உந்துதலை நிரப்புங்கள்'}</span>
            </p>
            {showQuestion && session?.question ? (
              <QuestionOverlay variant="compact" sessionId={sessionId} question={session.question} questionIndex={session.currentIndex} remainingSeconds={session.remainingSeconds} onResult={handleAnswer} />
            ) : (
              <p className="text-sm text-stone-500 py-4 text-center font-tamil">கேள்வி ஏற்றப்படுகிறது...</p>
            )}
          </div>
        </div>
      )}

      {/* Touch controls (hidden while a question is open: the car drives itself). */}
      {touchUi && raceBuilt && hud?.started && !hud.finished && !showQuestion && !paused && (
        <TouchControls controls={controls} boostReady={boostReady} boosting={!!hud.boosting} disabled={paused || showQuestion} />
      )}

      {portraitPhone && raceBuilt && hud && !hud.started && (
        <p className="absolute inset-x-0 bottom-4 z-20 text-center text-sm font-semibold text-white drop-shadow"><span className="font-tamil">குறிப்பு: சிறந்த காட்சிக்குத் தொலைபேசியைப் பக்கவாட்டில் திருப்புங்கள்.</span></p>
      )}

      {/* Pause menu */}
      {paused && (
        <div className="absolute inset-0 z-40 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl p-5 text-center">
            <h2 className="text-2xl font-black text-stone-800"><Bi k="paused" /></h2>
            <p className="text-sm text-stone-500 mt-1">
              <span className="font-tamil">{ORD_TA[(hud?.place ?? 4) - 1]} இடம் · {TA.lap.ta} {hud?.lap}/{LAPS}</span>
            </p>
            <div className="mt-4 grid gap-2">
              <button type="button" onClick={() => setPaused(false)} className="min-h-[52px] rounded-2xl bg-primary-700 hover:bg-primary-800 text-white font-extrabold text-lg inline-flex items-center justify-center gap-2">
                <FiPlay className="w-5 h-5" aria-hidden /> <Bi k="resume" inline />
              </button>
              <button type="button" onClick={leave} className="min-h-[48px] rounded-2xl border border-stone-300 text-stone-700 font-semibold">
                <Bi k="exitGame" inline />
              </button>
            </div>
            <div className="mt-4 text-left text-xs text-stone-500 space-y-1">
              <p>
                <span className="font-bold text-stone-700"><span className="font-tamil">விசைப்பலகை</span> · Keyboard:</span> arrows or W A S D to drive · Space boost · R reset · Esc pause
              </p>
              <p>
                <span className="font-bold text-stone-700"><span className="font-tamil">தொடுதிரை</span> · Touch:</span> left pad steers · GAS / BRAKE / BOOST on the right
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Start: a light Tamizhi panel over the cars waiting on the grid. */}
      {!difficulty && (
        <div className="absolute inset-0 z-30 flex items-end justify-center p-3 sm:p-6 bg-gradient-to-t from-stone-900/35 via-transparent to-transparent">
          <div className="w-full max-w-md rounded-3xl bg-white/95 shadow-2xl border border-white p-4 sm:p-5 animate-gamev2-pop-in">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta-600">Game Room · Racing</p>
                <h1 className="font-tamil text-2xl font-black text-stone-900 leading-tight">தமிழ்ப் பந்தயம்</h1>
              </div>
              <p className="text-sm text-primary-700 font-bold">Tamil Grand Prix</p>
            </div>
            <p className="mt-1 text-sm text-stone-600"><span className="font-tamil block text-stone-800">கயல், முகில், அருவி ஆகியோருடன் 3 சுற்றுகள். பச்சை நிறத் தமிழ் வாயில்கள் வழியே ஓட்டுங்கள் -- சரியான விடைகள் உந்துதலை நிரப்பும்.</span>3 laps against Kayal, Mugil and Aruvi. Drive through the teal Tamil gates -- right answers charge your boost.</p>
            <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label={ta('difficulty', true)}>
              {DIFFS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  role="radio"
                  aria-checked={false}
                  onClick={() => {
                    playSound('button', soundRef.current)
                    setDifficulty(d.id)
                  }}
                  className="rounded-2xl border-2 border-stone-200 hover:border-primary-500 hover:bg-primary-50 px-2 py-2.5 min-h-[64px] text-center transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
                >
                  <span className="block font-tamil font-extrabold text-stone-900">{TA[d.id].ta}</span>
                  <span className="block text-[11px] font-bold text-stone-500">{d.label}</span>
                  <span className="block font-tamil text-[11px] text-stone-500 leading-tight">{d.blurb}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-stone-500">
              {touchUi ? 'Steer with the left pad, hold GAS, tap BOOST.' : 'Arrows / WASD to drive · Space to boost · Esc to pause.'}
            </p>
          </div>
        </div>
      )}
      {difficulty && !raceBuilt && (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <p className="rounded-2xl bg-white/90 px-5 py-3 font-bold text-stone-700 shadow-lg" role="status">
            <span className="font-tamil">கார்கள் தொடக்கக் கோட்டுக்கு...</span>
          </p>
        </div>
      )}
      {me && raceBuilt && hud?.finished && !raceOver && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 z-20 flex justify-center">
          <p className="rounded-2xl bg-white/90 px-4 py-2 font-bold text-stone-700 shadow font-tamil">மற்றவர்கள் இலக்கைக் கடக்கக் காத்திருக்கிறோம்...</p>
        </div>
      )}
    </div>
  )
}
