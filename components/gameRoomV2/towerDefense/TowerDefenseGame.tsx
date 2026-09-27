'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FiPause, FiPlay, FiVolume2, FiVolumeX, FiLogOut, FiFastForward, FiZap, FiCheckCircle, FiXCircle, FiShield } from 'react-icons/fi'
import { GiTwoCoins, GiCastle, GiScrollUnfurled, GiCrossedSwords, GiSnowflake1, GiDrum, GiHammerNails, GiFallingRocks, GiCrown } from 'react-icons/gi'
import { GameV2Error } from '@/components/gameRoomV2'
import { useGameV2Motion } from '@/components/gameRoomV2/useGameV2Motion'
import { QuestionOverlay, type QuestionOverlayQuestion, type AnswerResult, useSoundPreference, playSound, useGameSessionState, vibrate } from '@/components/gameRoomV2/gameplay'
import { useManagedTimeouts } from '@/components/gameRoomV2/gameplay/useManagedTimeouts'
import { useQuestionGate } from '@/components/gameRoomV2/gameplay/useQuestionGate'
import { DifficultyPicker } from './DifficultyPicker'
import { Battlefield, type Fx, type StepClock } from './Battlefield'
import { BuildMenu, TowerInspector, type Anchor } from './TowerShop'
import { EnemyPreview } from './ArtPreview'
import { TdResults } from './TdResults'
import { computeLayout, toScreen } from './layout'
import {
  ABILITIES,
  ENEMY_DEFINITIONS,
  STEP_MS,
  createTd,
  planRun,
  seedFromString,
  step,
  startWave,
  placeTower,
  upgradeTower,
  sellTower,
  setTargeting,
  activateAbility,
  abilityReady,
  grantAnswerReward,
  summarizeWave,
  isBossWave,
  isMiniBossWave,
  type TdState,
  type TdEvent,
  type TowerTypeId,
  type TargetingMode,
  type AbilityId,
  type TowerDefenseDifficulty,
} from '@/lib/gameRoomV2/towerDefense'
import { formatAnswer } from '@/lib/gameRoomV2/answerReveal'
import type { BaseSessionStatePayload } from '@/lib/gameRoomV2/gameplay/sessionPolling'

// Tower Defense -- the full-viewport game. The battlefield canvas IS the
// screen; everything else floats over it: Tamizhi-styled HUD chips at the
// top, a wave tray and ability bar at the bottom, contextual build menu
// and tower inspector next to what you tapped, and the Tamil challenge
// as a docked learning panel.
//
// Loop: PREP (answer the wave's Tamil challenges -> coins + scrolls; build
// and upgrade) -> WAVE (enemies march; towers fight; abilities) -> ... ->
// final boss wave -> VICTORY or DEFEAT. The simulation, grading and
// rewards are unchanged: answers are graded by the server (QuestionOverlay
// -> /answer), the session is paused server-side while no question is on
// screen (useQuestionGate), and XP/coins/achievements come from /complete.

interface StatePayload extends BaseSessionStatePayload {
  remainingSeconds: number | null
  question: QuestionOverlayQuestion | null
}

interface Hud {
  phase: TdState['phase']
  wave: number
  totalWaves: number
  coins: number
  baseHp: number
  maxBaseHp: number
  charges: number
  streak: number
  enemiesLeft: number
  towers: number
  timeMs: number
  cooldowns: Record<AbilityId, number>
  boss: { hp: number; maxHp: number; enraged: boolean; mini: boolean } | null
}

function snapshot(td: TdState): Hud {
  const boss = td.enemies.find((e) => e.isBoss)
  return {
    phase: td.phase,
    wave: td.wave,
    totalWaves: td.totalWaves,
    coins: td.coins,
    baseHp: td.baseHp,
    maxBaseHp: td.maxBaseHp,
    charges: td.charges,
    streak: td.streak,
    enemiesLeft: td.enemies.length + td.spawnQueue.length,
    towers: td.towers.length,
    timeMs: td.timeMs,
    cooldowns: { ...td.cooldowns },
    boss: boss ? { hp: boss.hp, maxHp: boss.maxHp, enraged: boss.enraged, mini: boss.maxHp < 2500 } : null,
  }
}

const ABILITY_ICON: Record<AbilityId, typeof GiSnowflake1> = { freeze: GiSnowflake1, rally: GiDrum, repair: GiHammerNails, strike: GiFallingRocks }
const ABILITY_TINT: Record<AbilityId, string> = { freeze: 'bg-sky-500', rally: 'bg-terracotta-500', repair: 'bg-emerald-500', strike: 'bg-stone-600' }
const TUTORIAL_KEY = 'tamizhi.td.tutorial.v1'

type Banner = { title: string; sub?: string; tone: 'wave' | 'boss' | 'good' | 'danger'; id: number }

function useViewport() {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const read = () => {
      const vv = window.visualViewport
      setSize({ w: Math.round(vv?.width ?? window.innerWidth), h: Math.round(vv?.height ?? window.innerHeight) })
    }
    read()
    window.addEventListener('resize', read)
    window.visualViewport?.addEventListener('resize', read)
    return () => {
      window.removeEventListener('resize', read)
      window.visualViewport?.removeEventListener('resize', read)
    }
  }, [])
  return size
}

export function TowerDefenseGame({ sessionId, onExit, onPlayAgain, onHome }: { sessionId: string; onExit: () => void; onPlayAgain?: () => void; onHome?: () => void }) {
  const [difficulty, setDifficulty] = useState<TowerDefenseDifficulty | null>(null)
  const tdRef = useRef<TdState | null>(null)
  const planRef = useRef<number[] | null>(null)
  const fxRef = useRef<Fx[]>([])
  const clockRef = useRef<StepClock>({ lastStepAt: 0, running: false, speed: 1 })
  const coinChipRef = useRef<HTMLElement | null>(null)
  const [built, setBuilt] = useState(false)
  const [hud, setHud] = useState<Hud | null>(null)
  const [version, setVersion] = useState(0)
  const [selectedPadId, setSelectedPadId] = useState<string | null>(null)
  const [userPaused, setUserPaused] = useState(false)
  const [speed, setSpeed] = useState<1 | 2>(1)
  const [strikeMode, setStrikeMode] = useState(false)
  const [banner, setBanner] = useState<Banner | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [reward, setReward] = useState<{ text: string; id: number } | null>(null)
  const [feedback, setFeedback] = useState<{ correct: boolean; answer: string; right: string | null; explanation: string | null; id: number } | null>(null)
  const [answeredIndex, setAnsweredIndex] = useState(-1)
  const [hurt, setHurt] = useState(0)
  const [outcome, setOutcome] = useState<'victory' | 'defeat' | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [tutorial, setTutorial] = useState<'build' | 'auto' | 'learn' | null>(null)
  const bannerId = useRef(0)
  const reduced = !!useGameV2Motion().reduced
  const view = useViewport()
  const layout = useMemo(() => (view ? computeLayout(view.w, view.h) : null), [view])
  const { soundEnabled, toggleSound } = useSoundPreference()
  const soundRef = useRef(soundEnabled)
  soundRef.current = soundEnabled
  const schedule = useManagedTimeouts()
  const { state: session, error, result, poll, exit } = useGameSessionState<StatePayload>({ sessionId, enabled: !!difficulty, soundEnabled })

  // The world is visible from the first frame: a preview battle on the
  // same (seeded) map sits behind the opening overlay.
  if (!tdRef.current) tdRef.current = createTd({ seed: seedFromString(sessionId), difficulty: 'normal', totalWaves: 6 })

  const refreshHud = useCallback(() => {
    if (tdRef.current) setHud(snapshot(tdRef.current))
  }, [])

  const showBanner = useCallback(
    (b: Omit<Banner, 'id'>, ms = 1800) => {
      const id = ++bannerId.current
      setBanner({ ...b, id })
      schedule(() => setBanner((cur) => (cur?.id === id ? null : cur)), ms)
    },
    [schedule]
  )

  // Simulation events -> visuals and sound.
  const handleEvents = useCallback(
    (events: TdEvent[]) => {
      const fx = fxRef.current
      const snd = soundRef.current
      let structural = false
      for (const e of events) {
        switch (e.type) {
          case 'shot':
            playSound(e.towerType === 'yanai' ? 'cannon' : e.towerType === 'kuri' ? 'arrow' : 'spear', snd)
            break
          case 'hit':
            fx.push({ kind: 'hit', x: e.x, y: e.y })
            break
          case 'splash':
            fx.push({ kind: 'splash', x: e.x, y: e.y, radius: e.radius })
            break
          case 'frostPulse':
            fx.push({ kind: 'frost', x: e.x, y: e.y, radius: e.radius })
            playSound('frostBell', snd)
            break
          case 'kill':
            fx.push({ kind: 'kill', x: e.x, y: e.y, enemy: e.kind, reward: e.reward })
            playSound('coin', snd)
            break
          case 'leak':
            fx.push({ kind: 'leak', x: 0, y: 0 })
            setHurt((n) => n + 1)
            playSound('baseHit', snd)
            vibrate('incorrect', snd)
            break
          case 'bossSpawn':
            if (e.mini) {
              showBanner({ title: 'IRUL CAPTAIN', sub: 'A tougher foe -- focus your fire', tone: 'boss' }, 2400)
            } else {
              fx.push({ kind: 'bossWarn' })
              showBanner({ title: 'IRUL KING', sub: 'BOSS WAVE -- it summons minions and enrages when hurt', tone: 'boss' }, 3000)
            }
            playSound('bossWarning', snd)
            break
          case 'bossSummon':
            fx.push({ kind: 'summon', x: e.x, y: e.y })
            break
          case 'enrage':
            fx.push({ kind: 'enrage', x: e.x, y: e.y })
            showBanner({ title: 'ENRAGED!', sub: 'The Irul King moves faster', tone: 'danger' }, 2000)
            playSound('enrage', snd)
            break
          case 'waveStart':
            if (!e.boss) showBanner({ title: `WAVE ${e.wave}`, sub: 'Here they come!', tone: 'wave' }, 1500)
            playSound('waveStart', snd)
            break
          case 'waveCleared':
            fx.push({ kind: 'waveClear' })
            showBanner({ title: 'WAVE CLEARED!', sub: `+${e.bonus} coins`, tone: 'good' }, 2000)
            playSound('waveClear', snd)
            structural = true
            break
          case 'victory':
            fx.push({ kind: 'victory' })
            setOutcome('victory')
            showBanner({ title: 'VICTORY!', sub: 'The fort stands!', tone: 'good' }, 2800)
            playSound('victory', snd)
            vibrate('victory', snd)
            structural = true
            break
          case 'defeat':
            setOutcome('defeat')
            showBanner({ title: 'THE FORT FELL', sub: 'Rebuild your defence and try again', tone: 'danger' }, 2800)
            playSound('gameOver', snd)
            structural = true
            break
          case 'build':
            fx.push({ kind: 'build', x: e.x, y: e.y })
            playSound('build', snd)
            structural = true
            break
          case 'upgrade':
            fx.push({ kind: 'upgrade', x: e.x, y: e.y })
            playSound('upgrade', snd)
            structural = true
            break
          case 'sell':
            fx.push({ kind: 'sell', x: e.x, y: e.y })
            playSound('coin', snd)
            structural = true
            break
          case 'ability':
            if (e.ability === 'freeze') {
              fx.push({ kind: 'freeze' })
              playSound('frostBell', snd)
            } else if (e.ability === 'rally') {
              fx.push({ kind: 'rally' })
              playSound('drum', snd)
            } else if (e.ability === 'repair') {
              fx.push({ kind: 'repair' })
              playSound('heal', snd)
            } else if (e.x !== undefined && e.y !== undefined) {
              fx.push({ kind: 'strike', x: e.x, y: e.y })
              playSound('stoneRain', snd)
            }
            break
          default:
            break
        }
      }
      if (fx.length > 300) fx.splice(0, fx.length - 300)
      if (structural) setVersion((v) => v + 1)
    },
    [showBanner]
  )

  // Create the real battle once the session (question count) is known.
  useEffect(() => {
    if (!difficulty || !session || built) return
    const plan = planRun(session.totalQuestions)
    let c = 0
    planRef.current = plan.questionsBeforeWave.map((q) => (c += q))
    tdRef.current = createTd({ seed: seedFromString(sessionId), difficulty, totalWaves: plan.totalWaves })
    setBuilt(true)
    refreshHud()
    setVersion((v) => v + 1)
    try {
      if (window.localStorage.getItem(TUTORIAL_KEY) !== 'done') setTutorial('build')
    } catch {
      // storage unavailable: no tutorial
    }
  }, [difficulty, session, sessionId, built, refreshHud])

  const phase = hud?.phase
  const answered = session?.currentIndex ?? 0
  const sessionDone = session?.status === 'COMPLETED' || !!result
  const battleOver = phase === 'victory' || phase === 'defeat'
  const dueNow = hud && planRef.current && phase === 'prep' ? Math.max(0, planRef.current[hud.wave - 1] - answered) : 0
  const remainingQuestions = session ? Math.max(0, session.totalQuestions - answered) : 0
  const wantQuestion = built && !!hud && !userPaused && !sessionDone && ((phase === 'prep' && dueNow > 0) || (battleOver && remainingQuestions > 0))
  const { questionReady } = useQuestionGate({ sessionId, state: session, wantQuestion, poll, enabled: built })
  const showQuestion = questionReady && !!session?.question && session.currentIndex > answeredIndex
  const challengeOpen = (phase === 'prep' && dueNow > 0 && !sessionDone) || (battleOver && remainingQuestions > 0)

  // Simulation loop: fixed 30 Hz steps on requestAnimationFrame; the HUD
  // snapshot refreshes ~8x a second (never per frame).
  const simRunning = built && !!hud && hud.phase === 'wave' && !userPaused
  useEffect(() => {
    if (!simRunning) {
      clockRef.current.running = false
      return
    }
    let raf = 0
    let last = performance.now()
    let acc = 0
    let hudAcc = 0
    clockRef.current = { lastStepAt: last, running: true, speed }
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const td = tdRef.current
      if (!td) return
      const dt = Math.min(250, now - last)
      last = now
      acc += dt * speed
      let stepped = false
      while (acc >= STEP_MS && td.phase === 'wave') {
        handleEvents(step(td))
        acc -= STEP_MS
        stepped = true
      }
      if (stepped) clockRef.current.lastStepAt = now
      hudAcc += dt
      if (hudAcc > 120 || td.phase !== 'wave') {
        hudAcc = 0
        refreshHud()
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [simRunning, speed, handleEvents, refreshHud])

  const act = useCallback(
    (fn: (td: TdState, ev: TdEvent[]) => { ok: boolean; reason?: string }) => {
      const td = tdRef.current
      if (!td) return false
      const ev: TdEvent[] = []
      const r = fn(td, ev)
      if (!r.ok && r.reason) {
        setToast(r.reason)
        schedule(() => setToast(null), 1600)
      }
      handleEvents(ev)
      refreshHud()
      return r.ok
    },
    [handleEvents, refreshHud, schedule]
  )

  const finishTutorial = useCallback(() => {
    setTutorial(null)
    try {
      window.localStorage.setItem(TUTORIAL_KEY, 'done')
    } catch {
      // ignore
    }
  }, [])

  const fireAbility = useCallback(
    (id: AbilityId) => {
      const def = ABILITIES.find((a) => a.id === id)!
      const td = tdRef.current
      if (!td || !abilityReady(td, id)) return
      setSelectedPadId(null)
      if (def.needsTarget) setStrikeMode(true)
      else act((t, ev) => activateAbility(t, id, null, ev))
    },
    [act]
  )

  // Keyboard: 1-4 abilities, Esc pause.
  useEffect(() => {
    if (!built || battleOver) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Escape') {
        if (strikeMode) setStrikeMode(false)
        else if (selectedPadId) setSelectedPadId(null)
        else setUserPaused((p) => !p)
        return
      }
      const n = Number(e.key)
      if (n >= 1 && n <= 4 && hud?.phase === 'wave') fireAbility(ABILITIES[n - 1].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [built, battleOver, strikeMode, selectedPadId, hud?.phase, fireAbility])

  // After the battle: the celebration plays, then the results slide in
  // (once any last questions are answered and the server has finalised).
  useEffect(() => {
    if (!outcome || showResults || remainingQuestions > 0 || !sessionDone) return
    schedule(() => setShowResults(true), reduced ? 300 : outcome === 'victory' ? 2600 : 2000)
  }, [outcome, showResults, remainingQuestions, sessionDone, reduced, schedule])

  function handleAnswer(res: AnswerResult) {
    const td = tdRef.current
    if (!td || !session) return
    setAnsweredIndex(session.currentIndex)
    const ev: TdEvent[] = []
    const r = grantAnswerReward(td, res, ev)
    const id = Date.now()
    if (res.correct) {
      setReward({ text: `+${r.coins} COINS${r.charges ? ` · +${r.charges} SCROLL${r.charges > 1 ? 'S' : ''}` : ''}`, id })
      fxRef.current.push({ kind: 'coinsFromHud', amount: r.coins })
      playSound('coin', soundRef.current)
      schedule(() => setReward((x) => (x?.id === id ? null : x)), 1800)
    }
    setFeedback({ correct: res.correct, answer: formatAnswer(res.answer), right: res.correctAnswer ?? null, explanation: res.explanation ?? null, id })
    schedule(() => setFeedback((f) => (f?.id === id ? null : f)), res.correct ? 1600 : 5000)
    if (tutorial === 'learn') finishTutorial()
    refreshHud()
    poll()
  }

  // Tutorial progression.
  useEffect(() => {
    if (tutorial === 'build' && hud && hud.towers > 0) {
      setTutorial('auto')
      schedule(() => setTutorial((t) => (t === 'auto' ? 'learn' : t)), 2600)
    }
  }, [tutorial, hud, schedule])

  const leave = () => exit(onExit)
  const again = () => exit(onPlayAgain ?? onExit)

  if (error && !session && difficulty) return <GameV2Error description={error} onRetry={poll} />

  const td = tdRef.current
  const selectedPad = selectedPadId ? td.map.pads.find((p) => p.id === selectedPadId) : null
  const selectedTower = selectedPadId ? td.towers.find((t) => t.padId === selectedPadId) ?? null : null
  const anchor: Anchor | null =
    layout && selectedPad ? { ...(() => { const p = toScreen(layout, selectedPad.x, selectedPad.y); return { x: p.sx, y: p.sy } })(), viewW: layout.width, viewH: layout.height, cell: layout.cell } : null
  const invitePad = tutorial === 'build' && layout ? [...td.map.pads].sort((a, b) => Math.abs(a.x - 4) + Math.abs(a.y - 3) - (Math.abs(b.x - 4) + Math.abs(b.y - 3)))[0] : null
  const invitePos = invitePad && layout ? toScreen(layout, invitePad.x, invitePad.y) : null
  const nextWave = summarizeWave(td.nextWave)
  const bossNext = hud ? isBossWave(hud.wave, hud.totalWaves) || isMiniBossWave(hud.wave, hud.totalWaves) : false
  const canStartWave = !!hud && hud.phase === 'prep' && (dueNow === 0 || sessionDone)
  const narrow = (layout?.width ?? 1000) < 640
  const bannerStyle =
    banner?.tone === 'boss'
      ? 'bg-gradient-to-b from-purple-700 to-purple-900 text-white border-gold-400'
      : banner?.tone === 'danger'
        ? 'bg-gradient-to-b from-rose-600 to-rose-800 text-white border-rose-200'
        : banner?.tone === 'good'
          ? 'bg-gradient-to-b from-primary-500 to-primary-700 text-white border-gold-300'
          : 'bg-white text-stone-900 border-primary-200'

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#79bd57] font-sans text-stone-900 select-none" style={{ height: '100dvh' }}>
      {layout && (
        <Battlefield
          stateRef={tdRef}
          fxRef={fxRef}
          clockRef={clockRef}
          layout={layout}
          version={version}
          selectedPadId={selectedPadId}
          strikeMode={strikeMode}
          invitePadId={invitePad?.id ?? null}
          coinTargetRef={coinChipRef}
          reducedMotion={reduced}
          outcome={outcome}
          onPadClick={(padId) => {
            if (!built || battleOver) return
            playSound('button', soundRef.current)
            setSelectedPadId((cur) => (cur === padId ? null : padId))
          }}
          onFieldClick={(point) => {
            if (act((t, ev) => activateAbility(t, 'strike', point, ev))) setStrikeMode(false)
          }}
          onEmptyClick={() => setSelectedPadId(null)}
        />
      )}

      {/* ---------------- HUD (floats over the world) ---------------- */}
      {built && hud && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2 sm:p-3 [padding-top:max(0.5rem,env(safe-area-inset-top))]">
          <div className="pointer-events-auto flex flex-wrap items-center gap-1 sm:gap-2 max-w-[60%]">
            <div className="flex items-center gap-1.5 rounded-2xl bg-white/90 shadow-md px-2.5 sm:px-3 py-2">
              <GiCrossedSwords className="w-5 h-5 text-terracotta-600" aria-hidden />
              <span className="sr-only">Wave:</span>
              <span className="text-sm sm:text-base font-extrabold tabular-nums">
                {hud.wave}/{hud.totalWaves}
              </span>
            </div>
            <div ref={(el) => { coinChipRef.current = el }} className="relative flex items-center gap-1.5 rounded-2xl bg-white/90 shadow-md px-3 py-2">
              <GiTwoCoins className="w-5 h-5 text-gold-600" aria-hidden />
              <span className="sr-only">Coins:</span>
              <span key={hud.coins} className="inline-block text-sm sm:text-base font-extrabold tabular-nums text-gold-800 animate-gamev2-bump">
                {hud.coins}
              </span>
              {reward && (
                <span key={reward.id} className="absolute left-1/2 top-full mt-1 whitespace-nowrap rounded-full bg-gold-400 px-2.5 py-1 text-xs font-black text-stone-900 shadow animate-gamev2-float-up">
                  {reward.text}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl bg-white/90 shadow-md px-3 py-2" title="Scrolls power your abilities -- earn them with Tamil answers">
              <GiScrollUnfurled className="w-5 h-5 text-primary-700" aria-hidden />
              <span className="sr-only">Scrolls:</span>
              <span className="text-sm sm:text-base font-extrabold tabular-nums text-primary-800">{hud.charges}</span>
            </div>
            {hud.streak >= 2 && (
              <div className="hidden md:flex items-center gap-1 rounded-2xl bg-gold-400 shadow-md px-3 py-2 animate-gamev2-pop-in">
                <FiZap className="w-4 h-4" aria-hidden />
                <span className="sr-only">Answer streak:</span>
                <span className="text-sm font-black">x{hud.streak}</span>
              </div>
            )}
          </div>

          {/* Fort health (and the boss bar when a boss is on the field). */}
          <div className="pointer-events-auto hidden md:flex flex-col items-center gap-1.5 absolute left-1/2 -translate-x-1/2 top-2 sm:top-3">
            <FortChip hp={hud.baseHp} max={hud.maxBaseHp} hurt={hurt} />
            {hud.boss && <BossBar boss={hud.boss} />}
          </div>

          <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}
              aria-label={`Game speed ${speed}x`}
              aria-pressed={speed === 2}
              className={`h-11 min-w-[44px] px-2 rounded-2xl shadow-md flex items-center justify-center gap-0.5 text-sm font-extrabold ${speed === 2 ? 'bg-gold-400 text-stone-900' : 'bg-white/90 text-stone-700'}`}
            >
              <FiFastForward className="w-4 h-4" aria-hidden />
              {speed}x
            </button>
            <button type="button" onClick={() => setUserPaused((p) => !p)} aria-label={userPaused ? 'Resume' : 'Pause'} className="w-11 h-11 rounded-2xl bg-white/90 shadow-md text-stone-700 flex items-center justify-center">
              {userPaused ? <FiPlay className="w-5 h-5" /> : <FiPause className="w-5 h-5" />}
            </button>
            <button type="button" onClick={toggleSound} aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'} className="w-11 h-11 rounded-2xl bg-white/90 shadow-md text-stone-700 flex items-center justify-center">
              {soundEnabled ? <FiVolume2 className="w-5 h-5" /> : <FiVolumeX className="w-5 h-5" />}
            </button>
            <button type="button" onClick={leave} aria-label="Exit game" className="w-11 h-11 rounded-2xl bg-white/90 shadow-md text-stone-700 flex items-center justify-center">
              <FiLogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      {/* Fort + boss on phones: under the chips. */}
      {built && hud && (
        <div className="pointer-events-none absolute inset-x-0 top-[3.6rem] z-20 flex md:hidden flex-col items-center gap-1">
          <div className="flex items-center gap-1.5">
            <FortChip hp={hud.baseHp} max={hud.maxBaseHp} hurt={hurt} />
            {hud.streak >= 2 && (
              <div className="flex items-center gap-1 rounded-2xl bg-gold-400 shadow-md px-2.5 py-1.5">
                <FiZap className="w-4 h-4" aria-hidden />
                <span className="text-sm font-black">x{hud.streak}</span>
              </div>
            )}
          </div>
          {hud.boss && <BossBar boss={hud.boss} />}
        </div>
      )}

      {/* ---------------- Banners ---------------- */}
      <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-[26%] z-30 flex justify-center px-4">
        {banner && (
          <div key={banner.id} className={`rounded-3xl border-4 px-6 sm:px-10 py-3 sm:py-4 text-center shadow-2xl animate-gamev2-banner ${bannerStyle}`} style={{ animationDuration: '2.8s' }}>
            {banner.tone === 'boss' && <GiCrown className="w-8 h-8 mx-auto text-gold-300" aria-hidden />}
            <p className="text-3xl sm:text-5xl font-black tracking-wide leading-none">{banner.title}</p>
            {banner.sub && <p className="mt-1 text-sm sm:text-base font-semibold opacity-90">{banner.sub}</p>}
          </div>
        )}
      </div>
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 top-[40%] z-30 flex justify-center">
          <p role="status" className="rounded-2xl bg-white px-4 py-2 font-bold text-terracotta-700 shadow-xl">
            {toast}
          </p>
        </div>
      )}

      {/* ---------------- Contextual build menu / inspector ---------------- */}
      {anchor && !selectedTower && hud?.phase !== 'victory' && hud?.phase !== 'defeat' && (
        <BuildMenu
          anchor={anchor}
          coins={hud?.coins ?? 0}
          onBuild={(type: TowerTypeId) => {
            if (act((t, ev) => placeTower(t, selectedPadId!, type, ev))) setSelectedPadId(null)
          }}
          onClose={() => setSelectedPadId(null)}
        />
      )}
      {anchor && selectedTower && !battleOver && (
        <TowerInspector
          anchor={anchor}
          tower={selectedTower}
          coins={hud?.coins ?? 0}
          onUpgrade={() => act((t, ev) => upgradeTower(t, selectedTower.id, ev))}
          onSell={() => {
            act((t, ev) => sellTower(t, selectedTower.id, ev))
            setSelectedPadId(null)
          }}
          onTargeting={(mode: TargetingMode) => act((t) => setTargeting(t, selectedTower.id, mode))}
          onClose={() => setSelectedPadId(null)}
        />
      )}

      {/* ---------------- Tutorial callouts ---------------- */}
      {tutorial === 'build' && invitePos && !selectedPadId && !challengeOpen && (
        <Callout x={invitePos.sx} y={invitePos.sy - (layout?.cell ?? 60) * 0.7} onSkip={finishTutorial}>
          Tap here to build your first tower
        </Callout>
      )}
      {tutorial === 'auto' && (
        <div className="pointer-events-none absolute inset-x-0 top-[40%] z-30 flex justify-center">
          <p className="rounded-2xl bg-white px-5 py-3 font-extrabold text-primary-800 shadow-xl animate-gamev2-pop-in">Great! Towers attack automatically.</p>
        </div>
      )}

      {/* ---------------- Tamil challenge (docked learning panel) ---------------- */}
      {built && challengeOpen && (
        <>
          <div className="pointer-events-none absolute inset-0 z-20 bg-stone-900/15" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center p-2 sm:p-4 [padding-bottom:max(0.5rem,env(safe-area-inset-bottom))]">
            <div className="w-full max-w-xl max-h-[70dvh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-primary-100 p-3 sm:p-4 animate-gamev2-pop-in">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-700 flex items-center gap-1.5">
                  <GiScrollUnfurled className="w-4 h-4" aria-hidden />
                  {battleOver ? 'Bank your progress' : `Tamil challenge · ${dueNow} before wave ${hud?.wave}`}
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-black text-gold-800">
                  <GiTwoCoins className="w-3.5 h-3.5" aria-hidden /> +30 &amp; a scroll
                </span>
              </div>
              {tutorial === 'learn' && <p className="mb-1 text-xs font-semibold text-terracotta-700">Answer Tamil challenges between waves to strengthen your defence.</p>}
              {showQuestion && session?.question ? (
                <QuestionOverlay variant="compact" sessionId={sessionId} question={session.question} questionIndex={session.currentIndex} remainingSeconds={session.remainingSeconds} onResult={handleAnswer} />
              ) : (
                <p className="py-6 text-center text-sm text-stone-500">Unrolling the next scroll...</p>
              )}
            </div>
          </div>
        </>
      )}
      {feedback && (
        <div className="pointer-events-none absolute inset-x-0 top-[5.5rem] md:top-[6.5rem] z-40 flex justify-center px-3">
          <div role="status" className={`max-w-md w-full rounded-2xl bg-white shadow-xl border-2 px-4 py-3 animate-gamev2-pop-in ${feedback.correct ? 'border-primary-400' : 'border-terracotta-300'}`}>
            <p className={`flex items-center gap-2 text-lg font-black ${feedback.correct ? 'text-primary-700' : 'text-terracotta-700'}`}>
              {feedback.correct ? <FiCheckCircle className="w-5 h-5" aria-hidden /> : <FiXCircle className="w-5 h-5" aria-hidden />}
              {feedback.correct ? 'CORRECT!' : 'NOT QUITE'}
            </p>
            {!feedback.correct && (
              <div className="mt-1 space-y-0.5 text-sm text-stone-700">
                <p>
                  Your answer: <span className="font-tamil font-semibold">{feedback.answer}</span>
                </p>
                {feedback.right && (
                  <p>
                    Correct answer: <span className="font-tamil font-bold text-primary-800">{feedback.right}</span>
                  </p>
                )}
                {feedback.explanation && <p className="font-tamil leading-relaxed text-stone-600">{feedback.explanation}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- Bottom tray ---------------- */}
      {built && hud && !challengeOpen && !battleOver && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-2 p-2 sm:p-3 [padding-bottom:max(0.5rem,env(safe-area-inset-bottom))]">
          {/* Wave preview + start (prep) / enemies left (wave). */}
          <div className="pointer-events-auto">
            {hud.phase === 'prep' ? (
              <div className="rounded-3xl bg-white/95 shadow-xl border border-white px-3 py-2 flex items-center gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-stone-500">{bossNext ? 'Boss wave next!' : `Wave ${hud.wave} incoming`}</p>
                  <ul className="flex items-center gap-1.5 mt-0.5">
                    {nextWave.slice(0, narrow ? 3 : 6).map((w) => (
                      <li key={w.kind} className="flex items-center rounded-xl bg-stone-50 pr-2" title={ENEMY_DEFINITIONS[w.kind].name}>
                        <EnemyPreview kind={w.kind} size={narrow ? 30 : 36} />
                        <span className="text-xs font-extrabold text-stone-700 tabular-nums">x{w.count}</span>
                        <span className="sr-only">{ENEMY_DEFINITIONS[w.kind].name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  disabled={!canStartWave}
                  onClick={() => {
                    setSelectedPadId(null)
                    act((t, ev) => startWave(t, ev))
                  }}
                  className={`min-h-[52px] px-4 sm:px-5 rounded-2xl font-extrabold text-white inline-flex items-center gap-2 shadow-teal disabled:opacity-50 ${bossNext ? 'bg-purple-700 hover:bg-purple-800' : 'bg-primary-700 hover:bg-primary-800'}`}
                >
                  <FiShield className="w-5 h-5" aria-hidden />
                  {canStartWave ? `Start wave ${hud.wave}` : 'Answer first'}
                </button>
              </div>
            ) : (
              <div className="rounded-2xl bg-white/90 shadow-md px-3 py-2 text-sm font-extrabold text-stone-700 tabular-nums">{hud.enemiesLeft} enemies left</div>
            )}
          </div>
          {/* Ability bar (on a phone it only appears during a wave, when abilities can be used). */}
          <div className={`pointer-events-auto items-end gap-1.5 sm:gap-2 ${narrow && hud.phase === 'prep' ? 'hidden' : 'flex'}`} role="group" aria-label="Abilities">
            {ABILITIES.map((a, i) => {
              const Icon = ABILITY_ICON[a.id]
              const ready = hud.phase === 'wave' && abilityReady(td, a.id)
              const cdLeft = Math.max(0, hud.cooldowns[a.id] - hud.timeMs)
              const cdPct = cdLeft > 0 ? Math.min(100, (cdLeft / a.cooldownMs) * 100) : 0
              const affordable = hud.charges >= a.charges
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={!ready}
                  onClick={() => fireAbility(a.id)}
                  aria-label={`${a.name} (${a.charges} scrolls)`}
                  title={a.description}
                  className="relative flex flex-col items-center disabled:cursor-not-allowed group"
                >
                  <span className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full border-4 border-white shadow-lg flex items-center justify-center overflow-hidden transition-transform group-active:scale-90 ${ready ? `${ABILITY_TINT[a.id]} text-white` : 'bg-stone-300 text-stone-500'}`}>
                    <Icon className="w-7 h-7 sm:w-8 sm:h-8" aria-hidden />
                    {cdPct > 0 && <span className="absolute inset-0" style={{ background: `conic-gradient(rgba(28,25,23,0.55) ${cdPct}%, transparent 0)` }} aria-hidden />}
                    {!narrow && <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[9px] font-black opacity-80">{i + 1}</span>}
                  </span>
                  <span className={`absolute -top-1 -right-1 min-w-[22px] h-[22px] rounded-full border-2 border-white text-[11px] font-black flex items-center justify-center px-1 ${affordable ? 'bg-primary-700 text-white' : 'bg-stone-200 text-stone-500'}`} aria-hidden>
                    {a.charges}
                  </span>
                  {!narrow && <span className="mt-0.5 rounded-full bg-white/90 px-1.5 text-[10px] font-bold text-stone-700 shadow">{a.name}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
      {strikeMode && (
        <div className="absolute inset-x-0 bottom-24 z-30 flex justify-center px-3">
          <div className="rounded-2xl bg-white shadow-xl px-4 py-2 text-sm font-bold text-terracotta-700 flex items-center gap-3">
            <GiFallingRocks className="w-5 h-5" aria-hidden />
            Tap the battlefield to drop Stone Rain
            <button type="button" onClick={() => setStrikeMode(false)} className="underline min-h-[36px] text-stone-600">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ---------------- Pause ---------------- */}
      {userPaused && (
        <div className="absolute inset-0 z-50 bg-stone-900/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl p-5 text-center">
            <h2 className="text-2xl font-black">Paused</h2>
            <p className="text-sm text-stone-500 mt-1">
              Wave {hud?.wave} of {hud?.totalWaves} · Fort {hud?.baseHp}/{hud?.maxBaseHp}
            </p>
            <div className="mt-4 grid gap-2">
              <button type="button" onClick={() => setUserPaused(false)} className="min-h-[52px] rounded-2xl bg-primary-700 hover:bg-primary-800 text-white font-extrabold text-lg inline-flex items-center justify-center gap-2">
                <FiPlay className="w-5 h-5" aria-hidden /> Resume
              </button>
              <button type="button" onClick={leave} className="min-h-[48px] rounded-2xl border border-stone-300 font-semibold text-stone-700">
                Exit game
              </button>
            </div>
            <p className="mt-4 text-xs text-stone-500 text-left">Tap a stone base to build. Tap a tower to upgrade, sell or change its target. Abilities: keys 1-4. Esc to pause.</p>
          </div>
        </div>
      )}

      {/* ---------------- Start ---------------- */}
      {!difficulty && <DifficultyPicker onStart={setDifficulty} />}
      {difficulty && !built && (
        <div className="absolute inset-0 z-40 flex items-center justify-center">
          <p className="rounded-2xl bg-white/95 px-5 py-3 font-bold shadow-lg" role="status">
            Preparing the battlefield...
          </p>
        </div>
      )}

      {/* ---------------- Results ---------------- */}
      {showResults && outcome && (
        <TdResults
          victory={outcome === 'victory'}
          td={td}
          result={result}
          soundEnabled={soundEnabled}
          reducedMotion={reduced}
          onPlayAgain={onPlayAgain ? again : undefined}
          onNext={onHome}
          onBack={onHome ?? onExit}
        />
      )}
      {outcome && !showResults && remainingQuestions === 0 && sessionDone === false && (
        <p className="absolute inset-x-0 bottom-6 z-30 text-center text-sm font-bold text-white drop-shadow">Saving your progress...</p>
      )}
    </div>
  )
}

function FortChip({ hp, max, hurt }: { hp: number; max: number; hurt: number }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100))
  return (
    <div key={hurt} className={`flex items-center gap-2 rounded-2xl bg-white/90 shadow-md px-3 py-1.5 ${hurt ? 'animate-gamev2-shake' : ''}`} aria-label={`Fort: ${hp} of ${max}`}>
      <GiCastle className={`w-5 h-5 ${pct > 50 ? 'text-primary-700' : pct > 25 ? 'text-gold-600' : 'text-rose-600'}`} aria-hidden />
      <div className="w-28 sm:w-40 h-3 rounded-full bg-stone-200 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${pct > 50 ? 'bg-primary-500' : pct > 25 ? 'bg-gold-400' : 'bg-rose-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-extrabold tabular-nums text-stone-700">
        {hp}/{max}
      </span>
    </div>
  )
}

function BossBar({ boss }: { boss: { hp: number; maxHp: number; enraged: boolean; mini: boolean } }) {
  const pct = Math.max(0, (boss.hp / boss.maxHp) * 100)
  return (
    <div className={`flex items-center gap-2 rounded-2xl px-3 py-1.5 shadow-lg border-2 ${boss.enraged ? 'bg-rose-700 border-rose-300' : 'bg-purple-800 border-gold-400'} text-white animate-gamev2-pop-in`} aria-label={`${boss.mini ? 'Irul Captain' : 'Irul King'}: ${Math.round(pct)}% health`}>
      <GiCrown className="w-5 h-5 text-gold-300" aria-hidden />
      <span className="text-xs font-black tracking-wide">{boss.mini ? 'IRUL CAPTAIN' : 'IRUL KING'}</span>
      <div className="w-32 sm:w-48 h-3 rounded-full bg-black/30 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-200 ${boss.enraged ? 'bg-rose-300' : 'bg-gold-400'}`} style={{ width: `${pct}%` }} />
      </div>
      {boss.enraged && <span className="text-[10px] font-black">ENRAGED</span>}
    </div>
  )
}

function Callout({ x, y, children, onSkip }: { x: number; y: number; children: React.ReactNode; onSkip: () => void }) {
  // Taps pass straight through to the battlefield (only "Skip" is
  // clickable), and the bubble is kept inside the screen on a phone.
  const vw = typeof window === 'undefined' ? 1000 : window.innerWidth
  const w = Math.min(300, vw - 24)
  const left = Math.min(vw - w / 2 - 12, Math.max(w / 2 + 12, x))
  return (
    <div className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full animate-gamev2-pop-in" style={{ left, top: y, width: w }}>
      <div className="rounded-2xl bg-white shadow-xl border-2 border-primary-300 px-3 py-2 text-sm font-extrabold text-primary-800 text-center">
        {children}
        <button type="button" onClick={onSkip} className="pointer-events-auto ml-2 text-[11px] font-semibold text-stone-500 underline min-h-[32px]">
          Skip tutorial
        </button>
      </div>
      <div className="w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-white" style={{ marginLeft: `calc(50% + ${x - left}px - 8px)` }} aria-hidden />
    </div>
  )
}
