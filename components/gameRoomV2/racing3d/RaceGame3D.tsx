'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FiPause, FiPlay, FiVolume2, FiVolumeX, FiLogOut, FiMusic, FiVideo, FiFlag } from 'react-icons/fi'
import { GameV2Error } from '@/components/gameRoomV2'
import { useGameV2Motion } from '@/components/gameRoomV2/useGameV2Motion'
import { QuestionOverlay, type QuestionOverlayQuestion, type AnswerResult, useSoundPreference, useMusicPreference, playSound, useGameSessionState, vibrate } from '@/components/gameRoomV2/gameplay'
import { useManagedTimeouts } from '@/components/gameRoomV2/gameplay/useManagedTimeouts'
import { getAudioContext } from '@/components/gameRoomV2/gameplay/playSound'
import { useQuestionGate } from '@/components/gameRoomV2/gameplay/useQuestionGate'
import { CelebrationLayer, type CelebrationHandle } from '@/components/gameRoomV2/celebration/CelebrationLayer'
import { AnswerReview } from '@/components/gameRoomV2/celebration/AnswerReview'
import { TouchControls } from '@/components/gameRoomV2/racing/TouchControls'
import { emptyControls, readControls, useDriveKeyboard } from '@/components/gameRoomV2/racing/useDriveInput'
import { RaceCelebration, fmtTime, type RaceSummary } from '@/components/gameRoomV2/racing/RaceCelebration'
import { formatAnswer } from '@/lib/gameRoomV2/answerReveal'
import { seedFromString } from '@/lib/gameRoomV2/gameplay/rng'
import type { BaseSessionStatePayload } from '@/lib/gameRoomV2/gameplay/sessionPolling'
import { TA } from '@/lib/gameRoomV2/i18n/ta'
import {
  TRACKS,
  POWERS,
  POWER_SLOTS,
  LAPS,
  STEP,
  MAX_SPEED,
  RIVALS,
  PLAYER_COLOR,
  createRace,
  stepRace,
  answerCheckpoint,
  resumeAfterQuestion,
  standings,
  placeOf,
  player,
  kmh,
  boosting,
  shielded,
  type RaceState,
  type RaceEvent,
  type Difficulty,
  type PowerId,
} from '@/lib/gameRoomV2/racing3d'
import { createRenderer, createResolutionGovernor, type CameraMode, type Renderer, type RenderView } from './render'
import { RaceMusic, RaceAmbience } from './music'
import { TrackPicker } from './TrackPicker'
import { PowerIcon } from './PowerIcon'

// Tamil Grand Prix (தமிழ்ப் பந்தயம்) -- solo. An immersive pseudo-3D
// arcade racer seen from behind the car (or the driver's seat): three laps
// against Kayal, Mugil and Aruvi on one of six tracks.
//
// Learning is part of the race: at each "தமிழ்ச் சாவடி" (Tamil checkpoint)
// the whole race freezes, the student answers a question (graded by the
// SERVER through QuestionOverlay -> /answer), a correct answer earns a
// power-up they fire when THEY choose, and a 3-2-1 countdown resumes.
// Driving still decides the race. XP, coins and analytics come only from
// the server (/complete); finishing place, coins picked up on the road and
// power-ups are in-race only and never sent anywhere.

interface StatePayload extends BaseSessionStatePayload {
  remainingSeconds: number | null
  question: QuestionOverlayQuestion | null
}

interface Hud {
  status: RaceState['status']
  place: number
  lap: number
  speed: number
  time: number
  slots: PowerId[]
  boost: number
  shield: number
  grip: number
  magnet: number
  coins: number
  checkpointsPassed: number
  over: boolean
  finished: boolean
  countdown: number
  offroad: boolean
  positions: { id: string; frac: number; color: string; isPlayer: boolean }[]
}

const ORD_TA = ['முதல்', 'இரண்டாம்', 'மூன்றாம்', 'நான்காம்']
const DIFFS: { id: Difficulty; blurb: string }[] = [
  { id: 'easy', blurb: 'பொறுமையான போட்டியாளர்கள்' },
  { id: 'normal', blurb: 'நெருக்கமான பந்தயம்' },
  { id: 'hard', blurb: 'வேகமான, கூர்மையான போட்டியாளர்கள்' },
]

function snap(s: RaceState): Hud {
  const p = player(s)
  return {
    status: s.status,
    place: placeOf(s, 'player'),
    lap: Math.min(LAPS, p.lap + 1),
    speed: kmh(p.speed),
    time: s.time,
    slots: [...s.slots],
    boost: Math.max(p.boostT, p.starT, p.burstT),
    shield: Math.max(p.shieldT, p.starT),
    grip: p.gripT,
    magnet: p.magnetT,
    coins: s.stats.coins,
    checkpointsPassed: s.nextCheckpoint,
    over: s.over,
    finished: p.finished,
    countdown: Math.ceil(s.status === 'countdown' ? s.countdown : s.resumeT),
    offroad: Math.abs(p.x) > 1,
    positions: s.cars.map((c) => ({ id: c.id, frac: Math.min(1, c.z / s.raceLength), color: c.color, isPlayer: c.isPlayer })),
  }
}

function readRecords(trackId: string, difficulty: Difficulty, time: number | null, bestLap: number | null): string[] {
  // Personal bests live on this device only -- never sent to the server.
  const out: string[] = []
  try {
    const key = `tamizhi.gp3d.best.${trackId}.${difficulty}`
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
    // storage unavailable
  }
  return out
}

export function RaceGame3D({ sessionId, onExit, onPlayAgain, onHome }: { sessionId: string; onExit: () => void; onPlayAgain?: () => void; onHome?: () => void }) {
  const [trackId, setTrackId] = useState(TRACKS[0].id)
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [camera, setCamera] = useState<CameraMode>('chase')
  const cameraRef = useRef<CameraMode>('chase')
  cameraRef.current = camera
  const raceRef = useRef<RaceState | null>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const governorRef = useRef(createResolutionGovernor())
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const controls = useRef(emptyControls())
  const [hud, setHud] = useState<Hud | null>(null)
  const [paused, setPaused] = useState(false)
  const [banner, setBanner] = useState<{ text: string; sub?: string; tone: 'gold' | 'teal' | 'orange' | 'purple'; id: number } | null>(null)
  const [award, setAward] = useState<{ power: PowerId | null; replaced: PowerId | null; review: { answer: string; right: string | null; explanation: string | null } | null; id: number } | null>(null)
  const [answeredIndex, setAnsweredIndex] = useState(-1)
  const [summary, setSummary] = useState<RaceSummary | null>(null)
  const [touchUi, setTouchUi] = useState(false)
  const bannerId = useRef(0)
  const lastBannerAt = useRef(0)
  const celebrate = useRef<CelebrationHandle>(null)
  const slotsRef = useRef<HTMLDivElement | null>(null)
  const reduced = !!useGameV2Motion().reduced
  const reducedRef = useRef(reduced)
  reducedRef.current = reduced
  const { soundEnabled, toggleSound } = useSoundPreference()
  const { musicEnabled, toggleMusic } = useMusicPreference()
  const soundRef = useRef(soundEnabled)
  soundRef.current = soundEnabled
  const schedule = useManagedTimeouts()
  const musicRef = useRef<RaceMusic | null>(null)
  const ambRef = useRef<RaceAmbience | null>(null)
  const { state: session, error, result, poll, exit } = useGameSessionState<StatePayload>({ sessionId, enabled: !!difficulty, soundEnabled })
  const track = useMemo(() => TRACKS.find((t) => t.id === trackId) ?? TRACKS[0], [trackId])

  // Touch controls on coarse pointers or the first touch.
  useEffect(() => {
    setTouchUi(window.matchMedia('(pointer: coarse)').matches)
    const onTouch = (e: PointerEvent) => {
      if (e.pointerType === 'touch') setTouchUi(true)
    }
    window.addEventListener('pointerdown', onTouch)
    return () => window.removeEventListener('pointerdown', onTouch)
  }, [])

  // Automated browser playtests (opt-in via localStorage) read the local
  // race to steer with real key presses. Client-side race state only --
  // nothing here reaches or affects the server.
  useEffect(() => {
    try {
      if (window.localStorage.getItem('tamizhi.e2e') === '1') (window as unknown as { __tamizhiRace3d?: unknown }).__tamizhiRace3d = raceRef
    } catch {
      // storage unavailable
    }
  }, [])

  const refresh = useCallback(() => {
    if (raceRef.current) setHud(snap(raceRef.current))
  }, [])

  const flash = useCallback(
    (text: string, tone: 'gold' | 'teal' | 'orange' | 'purple' = 'teal', force = false, sub?: string) => {
      const now = performance.now()
      if (!force && now - lastBannerAt.current < 1100) return
      lastBannerAt.current = now
      const id = ++bannerId.current
      setBanner({ text, sub, tone, id })
      schedule(() => setBanner((b) => (b?.id === id ? null : b)), 1900)
    },
    [schedule]
  )

  const handleEvents = useCallback(
    (events: RaceEvent[]) => {
      const snd = soundRef.current
      const s = raceRef.current
      for (const e of events) {
        switch (e.type) {
          case 'count':
            playSound('countdown', snd)
            break
          case 'go':
          case 'resumeGo':
            playSound('go', snd)
            flash(TA.go.ta, 'gold', true)
            musicRef.current?.setMood(s && s.cars[0].lap === LAPS - 1 ? 'boss' : 'battle')
            break
          case 'checkpoint':
            playSound('checkpoint', snd)
            musicRef.current?.setMood('prep')
            break
          case 'lap':
            flash(`${TA.lap.ta} ${e.lap + 1} / ${LAPS}`, 'teal', true, e.best ? 'புதிய சிறந்த சுற்று!' : `${fmtTime(e.time)}`)
            playSound('checkpoint', snd)
            break
          case 'finalLap':
            schedule(() => flash('இறுதிச் சுற்று!', 'orange', true, 'Final lap'), 1300)
            playSound('finalLap', snd)
            musicRef.current?.setMood('boss')
            break
          case 'overtake':
            flash(`முந்தினீர்கள்! ${ORD_TA[e.place - 1]} இடம்`, 'gold')
            playSound('overtake', snd)
            break
          case 'bump':
            playSound('hit', snd)
            break
          case 'crash':
            playSound('baseHit', snd)
            vibrate('incorrect', snd)
            flash('மோதல்!', 'orange', false, 'சாலைக்குத் திரும்புங்கள்')
            break
          case 'shieldHit':
            playSound('ability', snd)
            break
          case 'coin':
            playSound('coin', snd)
            break
          case 'power':
            playSound(e.id === 'shield' ? 'ability' : e.id === 'repair' ? 'heal' : 'boost', snd)
            vibrate('button', snd)
            flash(POWERS[e.id].tamilName, 'purple', true, POWERS[e.id].tamilHint)
            break
          case 'rivalBoost': {
            const r = RIVALS.find((x) => x.id === e.id)
            if (r) flash(`${r.tamilName} பாய்கிறார்!`, 'orange')
            break
          }
          case 'finish':
            playSound('finish', snd)
            vibrate('victory', snd)
            flash(TA.finish.ta, 'gold', true, `${ORD_TA[e.place - 1]} இடம் · ${fmtTime(e.time)}`)
            musicRef.current?.setMood('silent')
            musicRef.current?.sting(e.place <= 3 ? 'victory' : 'defeat')
            if (e.place === 1) celebrate.current?.victory({ message: 'முதல் இடம்!' })
            else if (e.place <= 3) celebrate.current?.burst('major')
            break
        }
      }
    },
    [flash, schedule]
  )

  // Build the real race once the session (question count) is known.
  const [raceBuilt, setRaceBuilt] = useState(false)
  useEffect(() => {
    if (!difficulty || !session || raceBuilt) return
    raceRef.current = createRace({ trackId, difficulty, seed: seedFromString(sessionId), questions: session.totalQuestions })
    setRaceBuilt(true)
    refresh()
  }, [difficulty, session, sessionId, raceBuilt, refresh, trackId])

  // Renderer per track (sprite atlas + horizon are built once).
  useEffect(() => {
    if (!raceBuilt) return
    const r = createRenderer(track, [PLAYER_COLOR, ...RIVALS.map((x) => x.color)])
    rendererRef.current = r
    return () => {
      r.dispose()
      rendererRef.current = null
    }
  }, [raceBuilt, track])

  // Question flow: a passed checkpoint owes a question.
  const answered = session?.currentIndex ?? 0
  const sessionDone = session?.status === 'COMPLETED' || !!result
  const remaining = session ? Math.max(0, session.totalQuestions - answered) : 0
  const atCheckpoint = hud?.status === 'question'
  const raceOver = !!hud?.over
  const wantQuestion = raceBuilt && !paused && !sessionDone && (atCheckpoint || (raceOver && remaining > 0))
  const { questionReady } = useQuestionGate({ sessionId, state: session, wantQuestion, poll, enabled: raceBuilt })
  const showQuestion = questionReady && !!session?.question && session.currentIndex > answeredIndex

  // A checkpoint with no question left (tiny sets): just carry on.
  useEffect(() => {
    const s = raceRef.current
    if (!s || s.status !== 'question' || !session) return
    if (remaining === 0 || sessionDone) {
      resumeAfterQuestion(s)
      refresh()
    }
  }, [atCheckpoint, remaining, sessionDone, session, refresh])

  // The main loop: fixed 60 Hz simulation on requestAnimationFrame, render
  // every frame, HUD at ~10 Hz. Stops when paused or the page is hidden.
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    const onVis = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
  const running = raceBuilt && !paused && !hidden
  useEffect(() => {
    if (!running) return
    let raf = 0
    const governor = governorRef.current
    let last = performance.now()
    let acc = 0
    let hudAcc = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const s = raceRef.current
      const canvas = canvasRef.current
      const r = rendererRef.current
      if (!s || !canvas || !r) return
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      acc += dt
      const c = controls.current
      while (acc >= STEP) {
        const k = readControls(c)
        const use = c.boostRequested
        c.boostRequested = false
        handleEvents(stepRace(s, { throttle: k.throttle, brake: k.brake, steer: k.steer, usePower: use }))
        acc -= STEP
      }
      // Draw.
      const dpr = governor.ratio(dt * 1000)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      const g = canvas.getContext('2d')
      if (!g) return
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      const p = player(s)
      const k = readControls(c)
      const view: RenderView = {
        track: s.track,
        road: s.road,
        camZ: p.z,
        camX: p.x,
        speedPct: p.speed / MAX_SPEED,
        steer: s.status === 'racing' ? k.steer : 0,
        cars: s.cars.map((car) => ({ id: car.id, z: car.z, x: car.x, color: car.color, isPlayer: car.isPlayer, boosting: boosting(car), shielded: shielded(car), label: car.isPlayer ? undefined : car.tamilName })),
        coins: s.coins,
        isCoinTaken: (lap, i) => s.taken.has(lap * 10000 + i),
        checkpoints: s.checkpoints.slice(s.nextCheckpoint),
        camera: cameraRef.current,
        time: now / 1000,
        boost: boosting(p),
        shield: shielded(p),
        offroad: Math.abs(p.x) > 1 && p.speed > 200,
        crash: Math.min(1, p.crashT / 0.8),
        magnet: p.magnetT > 0,
        reduced: reducedRef.current,
        finishDistance: s.raceLength,
      }
      r.draw(g, w, h, view)
      hudAcc += dt
      if (hudAcc > 0.1) {
        hudAcc = 0
        refresh()
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running, handleEvents, refresh])

  const togglePause = useCallback(() => {
    if (!raceBuilt || raceOver) return
    setPaused((v) => !v)
  }, [raceBuilt, raceOver])
  const driving = raceBuilt && !paused && hud?.status === 'racing'
  useDriveKeyboard({ controls, enabled: raceBuilt && !paused && !raceOver && !showQuestion, onPause: togglePause })

  // Camera toggle (C key).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'c' && !(e.target instanceof HTMLInputElement)) setCamera((c) => (c === 'chase' ? 'cockpit' : 'chase'))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEngine(raceRef, driving, soundEnabled)

  // Music + ambience: start on the player's click, duck under questions.
  function startAudio() {
    if (!musicRef.current) musicRef.current = new RaceMusic(track.music)
    musicRef.current.start()
    musicRef.current.setMood('prep')
    if (!ambRef.current) ambRef.current = new RaceAmbience(track.ambience)
    ambRef.current.start()
  }
  useEffect(
    () => () => {
      musicRef.current?.dispose()
      ambRef.current?.dispose()
    },
    []
  )
  useEffect(() => {
    musicRef.current?.setEnabled(musicEnabled)
    ambRef.current?.setEnabled(musicEnabled)
  }, [musicEnabled])
  useEffect(() => {
    const duck = !!showQuestion || paused
    musicRef.current?.duck(duck)
    ambRef.current?.duck(duck)
  }, [showQuestion, paused])
  useEffect(() => {
    musicRef.current?.setHidden(hidden)
    ambRef.current?.setHidden(hidden)
  }, [hidden])

  function handleAnswer(res: AnswerResult) {
    const s = raceRef.current
    if (!s || !session) return
    setAnsweredIndex(session.currentIndex)
    const atGate = s.status === 'question'
    const out = atGate ? answerCheckpoint(s, res.correct) : { power: null, replaced: null }
    const id = Date.now()
    if (res.correct) {
      const rewards = out.power ? [{ kind: 'power' as const, label: POWERS[out.power].tamilName }] : [{ kind: 'points' as const, amount: res.points }]
      celebrate.current?.correct({ streak: Math.max(1, s.streak), rewards, baseSoundPlayed: true, milestone: out.power === 'star' })
      // A second, smaller burst where the power-up lands in its slot.
      const slot = slotsRef.current?.getBoundingClientRect()
      if (slot && out.power) celebrate.current?.burst('small', { x: slot.left + slot.width / 2, y: slot.top + slot.height / 2 })
      setAward({ power: out.power, replaced: out.replaced, review: null, id })
      schedule(() => setAward((a) => (a?.id === id ? null : a)), 2600)
    } else {
      setAward({ power: null, replaced: null, review: { answer: formatAnswer(res.answer), right: res.correctAnswer ?? null, explanation: res.explanation ?? null }, id })
      schedule(() => setAward((a) => (a?.id === id ? null : a)), 7000)
    }
    refresh()
    poll()
  }

  // Race over and every question answered: build the podium summary.
  useEffect(() => {
    const s = raceRef.current
    if (!s || !raceOver || summary || remaining > 0) return
    const me = player(s)
    const place = placeOf(s, 'player')
    const records = readRecords(s.track.id, s.difficulty, me.finishTime, me.bestLap)
    if (s.stats.worstPlace === 4 && place <= 3 && s.stats.overtakes > 0) records.push('அற்புதமான மீள்வருகை!')
    if (s.stats.cleanLaps === LAPS) records.push('தவறில்லாத பந்தயம்!')
    if (s.stats.coins >= 40) records.push(`${s.stats.coins} நாணயங்கள் சேகரிப்பு!`)
    const t = window.setTimeout(
      () =>
        setSummary({
          standings: standings(s).map((c) => ({ id: c.id, name: c.isPlayer ? 'நீங்கள்' : c.tamilName, color: c.color, isPlayer: c.isPlayer, finishedAt: c.finishTime })),
          place,
          time: me.finishTime,
          bestLap: me.bestLap,
          overtakes: s.stats.overtakes,
          boostsUsed: s.stats.powersUsed,
          topSpeed: s.stats.topSpeed,
          bestStreak: s.streak,
          correct: s.stats.checkpointsCorrect,
          answered: s.stats.checkpointsAnswered,
          cleanLaps: s.stats.cleanLaps,
          comeback: s.stats.worstPlace === 4 && place <= 3,
          records,
        }),
      reduced ? 0 : 1600
    )
    return () => window.clearTimeout(t)
  }, [raceOver, summary, remaining, reduced])

  const leave = () => exit(onExit)
  const again = () => exit(onPlayAgain ?? onExit)

  if (error && !session && difficulty) return <GameV2Error description={error} onRetry={poll} />

  if (summary) {
    return (
      <RaceCelebration summary={summary} result={result} soundEnabled={soundEnabled} reducedMotion={reduced} onRaceAgain={onPlayAgain ? again : undefined} onNext={onHome} onBack={onHome ?? onExit} />
    )
  }

  if (!difficulty) {
    return (
      <TrackPicker
        trackId={trackId}
        onTrack={setTrackId}
        diffs={DIFFS}
        camera={camera}
        onCamera={setCamera}
        onStart={(d) => {
          playSound('button', soundRef.current)
          startAudio()
          setDifficulty(d)
        }}
      />
    )
  }

  const bannerTone = banner?.tone === 'gold' ? 'bg-gold-400 text-stone-900 border-white' : banner?.tone === 'orange' ? 'bg-terracotta-500 text-white border-white' : banner?.tone === 'purple' ? 'bg-purple-700 text-white border-gold-300' : 'bg-primary-700 text-white border-white'
  const counting = hud && (hud.status === 'countdown' || hud.status === 'resume') && hud.countdown > 0
  const nextPower = hud?.slots[0]

  return (
    <div className="fixed inset-0 overflow-hidden bg-stone-900 select-none" style={{ height: '100dvh' }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block touch-none" role="img" aria-label={`${track.tamilName} · ${track.name}`} />
      <CelebrationLayer ref={celebrate} soundEnabled={soundEnabled} reducedMotion={reduced} />

      {!raceBuilt && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="rounded-2xl bg-white/90 px-5 py-3 font-bold text-stone-700 shadow-lg font-tamil" role="status">
            கார்கள் தொடக்கக் கோட்டுக்கு...
          </p>
        </div>
      )}

      {/* ---------------- HUD ---------------- */}
      {hud && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2 sm:p-3 [padding-top:max(0.5rem,env(safe-area-inset-top))]">
          <div className="flex items-stretch gap-1.5 sm:gap-2">
            <div className="rounded-2xl bg-white/90 shadow-md px-2.5 sm:px-3 py-1.5 text-center min-w-[58px]" aria-label={`இடம் · Position ${hud.place} / 4`}>
              <p className="text-2xl sm:text-3xl font-black text-primary-700 leading-none tabular-nums">{hud.place}<span className="text-sm text-stone-400">/4</span></p>
              <p className="font-tamil text-[10px] font-bold text-stone-500">{TA.position.ta}</p>
            </div>
            <div className="rounded-2xl bg-white/90 shadow-md px-2.5 sm:px-3 py-1.5 text-center" aria-label={`சுற்று · Lap ${hud.lap} / ${LAPS}`}>
              <p className="text-lg sm:text-xl font-black text-stone-800 leading-none tabular-nums">{hud.lap}/{LAPS}</p>
              <p className="font-tamil text-[10px] font-bold text-stone-500">{TA.lap.ta}</p>
            </div>
            <div className="hidden sm:block rounded-2xl bg-white/90 shadow-md px-3 py-1.5 text-center">
              <p className="text-lg sm:text-xl font-black text-stone-800 leading-none tabular-nums">{fmtTime(hud.time)}</p>
              <p className="font-tamil text-[10px] font-bold text-stone-500">{TA.time.ta}</p>
            </div>
            <div className="rounded-2xl bg-gold-100/95 shadow-md px-2.5 py-1.5 text-center" aria-label={`நாணயங்கள் ${hud.coins}`}>
              <p className="text-lg font-black text-gold-800 leading-none tabular-nums">{hud.coins}</p>
              <p className="font-tamil text-[10px] font-bold text-gold-800">நாணயம்</p>
            </div>
          </div>
          <div className="pointer-events-auto flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => setCamera((c) => (c === 'chase' ? 'cockpit' : 'chase'))} aria-label="கேமரா மாற்று · Switch camera (C)" className="w-11 h-11 rounded-xl bg-white/90 shadow-md text-stone-700 flex items-center justify-center">
              <FiVideo className="w-5 h-5" />
            </button>
            <button type="button" onClick={toggleMusic} aria-pressed={musicEnabled} aria-label={`${TA.music.ta} · Music`} className={`hidden sm:flex w-11 h-11 rounded-xl shadow-md items-center justify-center ${musicEnabled ? 'bg-white/90 text-stone-700' : 'bg-white/60 text-stone-400'}`}>
              <FiMusic className="w-5 h-5" />
            </button>
            <button type="button" onClick={toggleSound} aria-pressed={soundEnabled} aria-label={`${TA.sounds.ta} · Sounds`} className="w-11 h-11 rounded-xl bg-white/90 shadow-md text-stone-700 flex items-center justify-center">
              {soundEnabled ? <FiVolume2 className="w-5 h-5" /> : <FiVolumeX className="w-5 h-5" />}
            </button>
            <button type="button" onClick={togglePause} aria-label={paused ? `${TA.resume.ta} · Resume` : `${TA.pause.ta} · Pause`} className="w-11 h-11 rounded-xl bg-white/90 shadow-md text-stone-700 flex items-center justify-center">
              {paused ? <FiPlay className="w-5 h-5" /> : <FiPause className="w-5 h-5" />}
            </button>
            <button type="button" onClick={leave} aria-label={`${TA.exitGame.ta} · Exit`} className="w-11 h-11 rounded-xl bg-white/90 shadow-md text-stone-700 flex items-center justify-center">
              <FiLogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      {hud && (
        <div className="pointer-events-none absolute inset-x-0 top-[4.25rem] sm:top-[4.75rem] z-20 flex justify-center px-3">
          <div className="relative h-3 w-full max-w-md rounded-full bg-black/35 border border-white/40" aria-hidden>
            {[1, 2].map((l) => (
              <span key={l} className="absolute top-0 bottom-0 w-px bg-white/60" style={{ left: `${(l / LAPS) * 100}%` }} />
            ))}
            <FiFlag className="absolute -right-4 -top-1 w-4 h-4 text-white" />
            {hud.positions.map((p) => (
              <span key={p.id} className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-white ${p.isPlayer ? 'w-4 h-4 z-10' : 'w-3 h-3'}`} style={{ left: `${p.frac * 100}%`, background: p.color }} />
            ))}
          </div>
        </div>
      )}

      {/* Speedometer + power slots. */}
      {hud && raceBuilt && (
        <div className={`pointer-events-none absolute z-20 ${touchUi ? 'right-2 top-[5.4rem] sm:top-[6rem] flex-row-reverse items-start' : 'right-3 bottom-3 items-end'} flex gap-2`}>
          <div ref={slotsRef} className="flex gap-1.5" aria-label="ஆற்றல்கள் · Power-ups">
            {Array.from({ length: POWER_SLOTS }, (_, i) => {
              const id = hud.slots[i]
              return (
                <div key={i} className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 shadow-lg flex flex-col items-center justify-center ${id ? 'bg-white border-gold-300' : 'bg-black/30 border-white/40'}`}>
                  {id ? (
                    <>
                      <PowerIcon id={id} className="w-7 h-7" />
                      <span className="font-tamil text-[9px] font-bold leading-tight text-stone-700 text-center px-0.5">{POWERS[id].tamilName}</span>
                    </>
                  ) : (
                    <span className="text-white/60 text-xs font-bold">{i + 1}</span>
                  )}
                </div>
              )
            })}
          </div>
          {!touchUi && nextPower && (
            <span className="mb-1 rounded-lg bg-black/50 px-2 py-1 text-[11px] font-bold text-white">
              <span className="font-tamil">பயன்படுத்த</span> SPACE
            </span>
          )}
          <div className="rounded-2xl bg-black/55 px-3 py-1.5 text-white text-center min-w-[84px]">
            <p className="text-2xl font-black tabular-nums leading-none">{hud.speed}</p>
            <p className="text-[10px] font-bold opacity-80">km/h</p>
            {(hud.boost > 0 || hud.shield > 0 || hud.grip > 0 || hud.magnet > 0) && (
              <div className="mt-1 flex justify-center gap-1">
                {hud.boost > 0 && <PowerIcon id="boost" className="w-4 h-4" />}
                {hud.shield > 0 && <PowerIcon id="shield" className="w-4 h-4" />}
                {hud.grip > 0 && <PowerIcon id="grip" className="w-4 h-4" />}
                {hud.magnet > 0 && <PowerIcon id="magnet" className="w-4 h-4" />}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Countdowns (start + resume after a checkpoint). */}
      <div aria-live="assertive" className="pointer-events-none absolute inset-x-0 top-[56%] z-30 flex justify-center">
        {counting && !showQuestion && (
          <p key={`${hud?.status}-${hud?.countdown}`} className="text-8xl sm:text-9xl font-black text-white drop-shadow-[0_6px_0_rgba(15,118,110,0.6)] animate-gamev2-count">
            {hud?.countdown}
          </p>
        )}
      </div>
      <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-[6.5rem] z-30 flex justify-center px-4">
        {banner && (
          <div key={banner.id} className={`rounded-3xl border-4 px-6 py-2 text-center shadow-2xl animate-gamev2-banner ${bannerTone}`}>
            <p className="font-tamil text-2xl sm:text-4xl font-black leading-tight">{banner.text}</p>
            {banner.sub && <p className="font-tamil text-sm sm:text-base font-bold opacity-90">{banner.sub}</p>}
          </div>
        )}
      </div>

      {/* Award / review after a checkpoint answer. */}
      {award && (
        <div className="pointer-events-none absolute inset-x-0 top-[27%] z-40 flex justify-center px-3">
          {award.review ? (
            <div className="pointer-events-auto w-full max-w-md">
              <AnswerReview yourAnswer={award.review.answer} correctAnswer={award.review.right} explanation={award.review.explanation} seed={award.id} onDismiss={() => setAward(null)} />
            </div>
          ) : award.power ? (
            <div className="rounded-3xl bg-white shadow-2xl border-4 border-gold-300 px-6 py-3 text-center animate-gamev2-pop-in">
              <p className="font-tamil text-sm font-bold text-stone-500">ஆற்றல் கிடைத்தது! · Power-up</p>
              <div className="mt-1 flex items-center justify-center gap-3">
                <PowerIcon id={award.power} className="w-10 h-10" />
                <div className="text-left">
                  <p className="font-tamil text-2xl font-black text-stone-900 leading-tight">{POWERS[award.power].tamilName}</p>
                  <p className="font-tamil text-sm text-stone-600">{POWERS[award.power].tamilHint}</p>
                </div>
              </div>
              <p className="mt-1 text-xs font-semibold text-stone-500">
                <span className="font-tamil">{touchUi ? 'ஆற்றல் பொத்தானைத் தொட்டுப் பயன்படுத்துங்கள்' : 'SPACE அழுத்திப் பயன்படுத்துங்கள்'}</span>
                {award.replaced && <span className="font-tamil"> · {POWERS[award.replaced].tamilName} மாற்றப்பட்டது</span>}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* Tamil checkpoint question. */}
      {(showQuestion || (raceOver && remaining > 0 && !sessionDone)) && (
        <>
          <div className="pointer-events-none absolute inset-0 z-30 bg-stone-900/30" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 z-40 flex justify-center p-2 sm:p-4 [padding-bottom:max(0.5rem,env(safe-area-inset-bottom))]">
            <div className="w-full max-w-xl max-h-[72dvh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-primary-100 p-3 sm:p-4 animate-gamev2-pop-in">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="font-tamil text-sm font-bold text-primary-700">
                  {raceOver ? 'மேடைக்கு முன் கடைசிச் சவால்' : 'தமிழ்ச் சாவடி · பந்தயம் நிறுத்தப்பட்டுள்ளது'}
                </p>
                {!raceOver && <span className="font-tamil rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-black text-gold-800">சரியான விடை = ஆற்றல்!</span>}
              </div>
              {showQuestion && session?.question ? (
                <QuestionOverlay variant="compact" sessionId={sessionId} question={session.question} questionIndex={session.currentIndex} remainingSeconds={session.remainingSeconds} onResult={handleAnswer} />
              ) : (
                <p className="py-6 text-center text-sm text-stone-500 font-tamil">கேள்வி ஏற்றப்படுகிறது...</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Touch controls (hidden while a question is open). */}
      {touchUi && raceBuilt && hud && !hud.finished && !showQuestion && !paused && (
        <TouchControls controls={controls} boostReady={hud.slots.length > 0} boosting={hud.boost > 0} disabled={paused || hud.status !== 'racing'} boostLabel={nextPower ? { ta: POWERS[nextPower].tamilName, en: POWERS[nextPower].name } : { ta: 'ஆற்றல்', en: 'Power' }} />
      )}

      {/* Pause. */}
      {paused && (
        <div className="absolute inset-0 z-50 bg-stone-900/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl p-5 text-center">
            <h2 className="font-tamil text-2xl font-black text-stone-800">{TA.paused.ta}</h2>
            <p className="font-tamil text-sm text-stone-500 mt-1">
              {track.tamilName} · {hud ? `${ORD_TA[hud.place - 1]} இடம் · ${TA.lap.ta} ${hud.lap}/${LAPS}` : ''}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={toggleMusic} aria-pressed={musicEnabled} className={`min-h-[48px] rounded-2xl border font-bold inline-flex items-center justify-center gap-2 ${musicEnabled ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-stone-300 text-stone-500'}`}>
                <FiMusic className="w-5 h-5" aria-hidden /> <span className="font-tamil">{TA.music.ta}</span> {musicEnabled ? '✓' : '✕'}
              </button>
              <button type="button" onClick={toggleSound} aria-pressed={soundEnabled} className={`min-h-[48px] rounded-2xl border font-bold inline-flex items-center justify-center gap-2 ${soundEnabled ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-stone-300 text-stone-500'}`}>
                {soundEnabled ? <FiVolume2 className="w-5 h-5" aria-hidden /> : <FiVolumeX className="w-5 h-5" aria-hidden />} <span className="font-tamil">{TA.sounds.ta}</span> {soundEnabled ? '✓' : '✕'}
              </button>
            </div>
            <div className="mt-2 grid gap-2">
              <button type="button" onClick={() => setPaused(false)} className="min-h-[52px] rounded-2xl bg-primary-700 hover:bg-primary-800 text-white font-extrabold text-lg inline-flex items-center justify-center gap-2">
                <FiPlay className="w-5 h-5" aria-hidden /> <span className="font-tamil">{TA.resume.ta}</span>
              </button>
              <button type="button" onClick={leave} className="min-h-[48px] rounded-2xl border border-stone-300 text-stone-700 font-semibold">
                <span className="font-tamil">{TA.exitGame.ta}</span>
              </button>
            </div>
            <div className="mt-4 text-left text-xs text-stone-500 space-y-1">
              <p>
                <span className="font-bold text-stone-700"><span className="font-tamil">விசைப்பலகை</span> · Keyboard:</span> W/↑ <span className="font-tamil">முடுக்கு</span> · S/↓ <span className="font-tamil">நிறுத்து</span> · A/D ←→ <span className="font-tamil">திருப்பு</span> · Space <span className="font-tamil">ஆற்றல்</span> · C <span className="font-tamil">கேமரா</span> · Esc
              </p>
              <p>
                <span className="font-bold text-stone-700"><span className="font-tamil">தொடுதிரை</span> · Touch:</span> <span className="font-tamil">இடப்புறம் திருப்பு · வலப்புறம் ஓட்டு / நிறுத்து / உந்து</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {raceBuilt && hud?.finished && !raceOver && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 z-20 flex justify-center">
          <p className="font-tamil rounded-2xl bg-white/90 px-4 py-2 font-bold text-stone-700 shadow">மற்றவர்கள் இலக்கைக் கடக்கக் காத்திருக்கிறோம்...</p>
        </div>
      )}
    </div>
  )
}

// A quiet engine note following the player's speed (no audio files).
function useEngine(stateRef: React.MutableRefObject<RaceState | null>, active: boolean, enabled: boolean) {
  useEffect(() => {
    if (!active || !enabled) return
    const c = getAudioContext()
    if (!c) return
    const master = c.createGain()
    master.gain.value = 0
    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 700
    const a = c.createOscillator()
    const b = c.createOscillator()
    a.type = 'sawtooth'
    b.type = 'square'
    a.connect(filter)
    b.connect(filter)
    filter.connect(master)
    master.connect(c.destination)
    a.start()
    b.start()
    const timer = window.setInterval(() => {
      const s = stateRef.current
      if (!s) return
      const p = player(s)
      const f = Math.min(1.35, p.speed / MAX_SPEED)
      const base = (46 + f * 100) * (boosting(p) ? 1.15 : 1)
      a.frequency.setTargetAtTime(base, c.currentTime, 0.08)
      b.frequency.setTargetAtTime(base * 0.502, c.currentTime, 0.08)
      filter.frequency.setTargetAtTime(480 + f * 900, c.currentTime, 0.1)
      master.gain.setTargetAtTime(s.status === 'racing' ? 0.016 + f * 0.02 : 0.006, c.currentTime, 0.15)
    }, 80)
    return () => {
      window.clearInterval(timer)
      master.gain.setTargetAtTime(0, c.currentTime, 0.05)
      window.setTimeout(() => {
        try {
          a.stop()
          b.stop()
        } catch {
          // already stopped
        }
        master.disconnect()
      }, 200)
    }
  }, [stateRef, active, enabled])
}
