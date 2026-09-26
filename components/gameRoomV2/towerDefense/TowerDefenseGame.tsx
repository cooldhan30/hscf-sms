'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FiDollarSign, FiShield, FiBookOpen, FiZap, FiFlag, FiPlay, FiFastForward, FiAlertTriangle } from 'react-icons/fi'
import { GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { QuestionOverlay, type QuestionOverlayQuestion, GameResultsScreen, useSoundPreference, playSound, useGameSessionState, vibrate } from '@/components/gameRoomV2/gameplay'
import { useManagedTimeouts } from '@/components/gameRoomV2/gameplay/useManagedTimeouts'
import { useQuestionGate } from '@/components/gameRoomV2/gameplay/useQuestionGate'
import { ArenaHud } from '@/components/gameRoomV2/gameplay/ArenaHud'
import { DifficultyPicker } from './DifficultyPicker'
import { Battlefield, type Fx, type StepClock } from './Battlefield'
import { TowerShop } from './TowerShop'
import {
  ABILITIES,
  ENEMY_DEFINITIONS,
  STEP_MS,
  STRIKE_RADIUS,
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
import type { BaseSessionStatePayload } from '@/lib/gameRoomV2/gameplay/sessionPolling'

// Tower Defense: the flagship GameRoom engine.
//
// Loop: PREP (answer this wave's Tamil challenges -> coins + scrolls; build
// and upgrade) -> WAVE (enemies march; towers fight; use abilities) ->
// PREP ... -> final boss wave -> VICTORY or DEFEAT.
//
// Learning integration: the questions of the chosen topic are spread
// across the preparation phases (planRun), so every question is answered
// before the final wave. Answers are graded by the server (QuestionOverlay
// -> /answer); the in-match coins/scrolls are derived from that grading.
// While no question is on screen the session is paused server-side
// (useQuestionGate), so the question clock only runs while a question is
// actually shown. Score, XP, achievements and mastery are all computed by
// the server at /complete -- nothing from this simulation is ever sent.

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
  frozenUntil: number
  rallyUntil: number
}

function snapshot(td: TdState): Hud {
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
    frozenUntil: td.freezeUntil,
    rallyUntil: td.rallyUntil,
  }
}

const KILL_COLOR: Record<string, string> = {
  grunt: '#a8a29e',
  scout: '#facc15',
  swarm: '#a3e635',
  brute: '#f87171',
  armored: '#cbd5e1',
  boss: '#c084fc',
}

export function TowerDefenseGame({
  sessionId,
  onExit,
  onPlayAgain,
  onHome,
}: {
  sessionId: string
  onExit: () => void
  onPlayAgain?: () => void
  onHome?: () => void
}) {
  const [difficulty, setDifficulty] = useState<TowerDefenseDifficulty | null>(null)
  const tdRef = useRef<TdState | null>(null)
  const planRef = useRef<number[] | null>(null) // cumulative questions due before each wave
  const fxRef = useRef<Fx[]>([])
  const clockRef = useRef<StepClock>({ lastStepAt: 0, running: false, speed: 1 })
  const shakeUntilRef = useRef(0)
  const [hud, setHud] = useState<Hud | null>(null)
  const [version, setVersion] = useState(0)
  const [selectedPadId, setSelectedPadId] = useState<string | null>(null)
  const [userPaused, setUserPaused] = useState(false)
  const [speed, setSpeed] = useState<1 | 2>(1)
  const [strikeMode, setStrikeMode] = useState(false)
  const [banner, setBanner] = useState<{ title: string; sub?: string; tone: 'info' | 'boss' | 'good' } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [answeredIndex, setAnsweredIndex] = useState(-1)
  const { soundEnabled, toggleSound } = useSoundPreference()
  const soundRef = useRef(soundEnabled)
  soundRef.current = soundEnabled
  const scheduleTimeout = useManagedTimeouts()
  const { state: session, error, result, poll, exit } = useGameSessionState<StatePayload>({ sessionId, enabled: !!difficulty, soundEnabled })

  const refreshHud = useCallback(() => {
    if (tdRef.current) setHud(snapshot(tdRef.current))
  }, [])

  const showBanner = useCallback(
    (b: { title: string; sub?: string; tone: 'info' | 'boss' | 'good' }, ms = 1800) => {
      setBanner(b)
      scheduleTimeout(() => setBanner((cur) => (cur === b ? null : cur)), ms)
    },
    [scheduleTimeout]
  )

  // Turns simulation events into visuals and sound.
  const handleEvents = useCallback(
    (events: TdEvent[]) => {
      const now = performance.now()
      const fx = fxRef.current
      const snd = soundRef.current
      let structural = false
      for (const e of events) {
        switch (e.type) {
          case 'hit':
            playSound('hit', snd)
            break
          case 'splash':
            fx.push({ kind: 'ring', x: e.x, y: e.y, t0: now, dur: 350, color: '#f97316', r0: 0.2, r1: e.radius })
            break
          case 'frostPulse':
            fx.push({ kind: 'ring', x: e.x, y: e.y, t0: now, dur: 450, color: '#7dd3fc', r0: 0.3, r1: e.radius })
            break
          case 'kill':
            fx.push({ kind: 'burst', x: e.x, y: e.y, t0: now, dur: 450, color: KILL_COLOR[e.kind] ?? '#fff' })
            fx.push({ kind: 'text', x: e.x, y: e.y, t0: now, dur: 800, color: '#fde047', text: `+${e.reward}` })
            playSound('coin', snd)
            break
          case 'leak':
            shakeUntilRef.current = now + 350
            playSound('baseHit', snd)
            vibrate('incorrect', snd)
            break
          case 'bossSpawn':
            showBanner(
              e.mini
                ? { title: 'An Irul captain appears!', sub: 'Tougher than it looks -- focus fire.', tone: 'boss' }
                : { title: 'The Irul King approaches!', sub: 'It summons minions and enrages when hurt.', tone: 'boss' },
              2600
            )
            playSound('bossWarning', snd)
            break
          case 'bossSummon':
            fx.push({ kind: 'ring', x: e.x, y: e.y, t0: now, dur: 500, color: '#a855f7', r0: 0.2, r1: 0.9 })
            break
          case 'enrage':
            fx.push({ kind: 'ring', x: e.x, y: e.y, t0: now, dur: 700, color: '#f43f5e', r0: 0.3, r1: 1.4 })
            showBanner({ title: 'The Irul King is enraged!', sub: 'It moves faster now.', tone: 'boss' })
            break
          case 'waveStart':
            showBanner({ title: `Wave ${e.wave}`, sub: e.boss ? 'Boss wave' : undefined, tone: e.boss ? 'boss' : 'info' }, 1400)
            playSound('waveStart', snd)
            break
          case 'waveCleared':
            showBanner({ title: `Wave ${e.wave} cleared!`, sub: `+${e.bonus} coins`, tone: 'good' })
            playSound('checkpoint', snd)
            structural = true
            break
          case 'victory':
            playSound('victory', snd)
            vibrate('victory', snd)
            structural = true
            break
          case 'defeat':
            playSound('gameOver', snd)
            vibrate('gameOver', snd)
            structural = true
            break
          case 'build':
            fx.push({ kind: 'sparkle', x: e.x, y: e.y, t0: now, dur: 500, color: '#fde047' })
            playSound('build', snd)
            structural = true
            break
          case 'upgrade':
            fx.push({ kind: 'sparkle', x: e.x, y: e.y, t0: now, dur: 700, color: '#34d399' })
            fx.push({ kind: 'ring', x: e.x, y: e.y, t0: now, dur: 500, color: '#34d399', r0: 0.2, r1: 0.8 })
            playSound('upgrade', snd)
            structural = true
            break
          case 'sell':
            fx.push({ kind: 'text', x: e.x, y: e.y, t0: now, dur: 800, color: '#fde047', text: `+${e.refund}` })
            playSound('coin', snd)
            structural = true
            break
          case 'ability':
            playSound('ability', snd)
            if (e.ability === 'strike' && e.x !== undefined && e.y !== undefined)
              fx.push({ kind: 'strike', x: e.x, y: e.y, t0: now, dur: 600, color: '#ea580c', r0: 0.3, r1: STRIKE_RADIUS })
            break
          default:
            break
        }
      }
      if (fx.length > 160) fx.splice(0, fx.length - 160)
      if (structural) setVersion((v) => v + 1)
    },
    [showBanner]
  )

  // Create the battle once the session (and so the question count) is known.
  useEffect(() => {
    if (!difficulty || !session || tdRef.current) return
    const plan = planRun(session.totalQuestions)
    let c = 0
    planRef.current = plan.questionsBeforeWave.map((q) => (c += q))
    tdRef.current = createTd({ seed: seedFromString(sessionId), difficulty, totalWaves: plan.totalWaves })
    refreshHud()
    setVersion((v) => v + 1)
  }, [difficulty, session, sessionId, refreshHud])

  const phase = hud?.phase
  const answered = session?.currentIndex ?? 0
  const sessionDone = session?.status === 'COMPLETED' || !!result
  const battleOver = phase === 'victory' || phase === 'defeat'
  const dueNow = hud && planRef.current && phase === 'prep' ? Math.max(0, planRef.current[hud.wave - 1] - answered) : 0
  const remainingQuestions = session ? Math.max(0, session.totalQuestions - answered) : 0
  const wantQuestion = !!hud && !userPaused && !sessionDone && ((phase === 'prep' && dueNow > 0) || (battleOver && remainingQuestions > 0))
  const { questionReady } = useQuestionGate({ sessionId, state: session, wantQuestion, poll, enabled: !!hud })
  const showQuestion = questionReady && !!session?.question && session.currentIndex > answeredIndex

  // Simulation loop: fixed 30 Hz steps on requestAnimationFrame, HUD
  // refreshed ~8x a second (not every frame).
  const simRunning = !!hud && hud.phase === 'wave' && !userPaused
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
      if (!td) return
      const ev: TdEvent[] = []
      const r = fn(td, ev)
      if (!r.ok && r.reason) {
        setToast(r.reason)
        scheduleTimeout(() => setToast(null), 1500)
      }
      handleEvents(ev)
      refreshHud()
    },
    [handleEvents, refreshHud, scheduleTimeout]
  )

  function handleAnswer(res: { correct: boolean; points: number }) {
    const td = tdRef.current
    if (!td || !session) return
    setAnsweredIndex(session.currentIndex)
    const ev: TdEvent[] = []
    const reward = grantAnswerReward(td, res, ev)
    if (res.correct) {
      setToast(`+${reward.coins} coins${reward.charges ? ` · +${reward.charges} scroll${reward.charges > 1 ? 's' : ''}` : ''}`)
      playSound('coin', soundRef.current)
    } else {
      setToast('No reward this time -- keep going!')
    }
    scheduleTimeout(() => setToast(null), 1800)
    refreshHud()
    poll()
  }

  async function leave() {
    await exit(onExit)
  }
  async function playAgain() {
    await exit(onPlayAgain ?? onExit)
  }

  // --- Screens ----------------------------------------------------------
  if (!difficulty) return <DifficultyPicker onStart={setDifficulty} />
  if (error && !session) return <GameV2Error description={error} onRetry={poll} />
  if (!session || !hud || !tdRef.current) return <GameV2Loading label="Preparing the battlefield..." />

  const td = tdRef.current
  const selectedTower = selectedPadId ? td.towers.find((t) => t.padId === selectedPadId) ?? null : null

  if (battleOver && result) {
    const victory = hud.phase === 'victory'
    return (
      <div className="min-h-screen w-full bg-stone-950 px-4 py-8">
        <GameResultsScreen
          result={result}
          headline={victory ? 'Fort defended!' : 'Your fort fell'}
          subline={victory ? `You held all ${hud.totalWaves} waves${td.stats.bossDefeated ? ' and defeated the Irul King' : ''}.` : `You reached wave ${hud.wave} of ${hud.totalWaves}.`}
          gameStats={[
            { label: 'Waves survived', value: `${td.stats.wavesCleared}/${hud.totalWaves}` },
            { label: 'Enemies defeated', value: td.stats.enemiesDefeated },
            { label: 'Towers built', value: td.stats.towersBuilt },
            { label: 'Upgrades', value: td.stats.upgrades },
            { label: 'Abilities used', value: td.stats.abilitiesUsed },
            { label: 'Fort health', value: `${hud.baseHp}/${hud.maxBaseHp}` },
          ]}
          onPlayAgain={onPlayAgain ? playAgain : undefined}
          onExit={onExit}
          onHome={onHome}
        />
      </div>
    )
  }

  const nextWaveSummary = summarizeWave(td.nextWave)
  const boss = isBossWave(hud.wave, hud.totalWaves) || isMiniBossWave(hud.wave, hud.totalWaves)
  const canStartWave = hud.phase === 'prep' && (dueNow === 0 || sessionDone)

  const challengePanel = (
    <div className="rounded-2xl bg-stone-900/80 border border-yellow-300/30 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-yellow-300 flex items-center gap-1.5">
        <FiBookOpen className="w-3.5 h-3.5" aria-hidden />
        {battleOver ? 'Bank your progress' : `Scholar's challenge -- ${dueNow} before wave ${hud.wave}`}
      </p>
      <p className="text-xs text-stone-300 mt-1">
        {battleOver
          ? `Answer the last ${remainingQuestions} question${remainingQuestions === 1 ? '' : 's'} to save your XP and progress.`
          : 'Correct: +30 coins and a scroll. Faster answers and streaks earn more.'}
      </p>
      <div className="mt-2">
        {showQuestion && session.question ? (
          <QuestionOverlay
            variant="compact"
            sessionId={sessionId}
            question={session.question}
            questionIndex={session.currentIndex}
            remainingSeconds={session.remainingSeconds}
            onResult={handleAnswer}
          />
        ) : (
          <GameV2Loading label="Unrolling the next scroll..." />
        )}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen w-full bg-stone-950 text-white">
      <ArenaHud
        stats={[
          { icon: FiFlag, label: 'Wave', value: `${hud.wave}/${hud.totalWaves}` },
          { icon: FiDollarSign, label: 'Coins', value: hud.coins, tone: 'gold' },
          { icon: FiBookOpen, label: 'Scrolls', value: hud.charges, tone: 'good' },
          ...(hud.streak >= 2 ? [{ icon: FiZap, label: 'Answer streak', value: `x${hud.streak}`, tone: 'gold' as const }] : []),
        ]}
        health={{ value: hud.baseHp, max: hud.maxBaseHp, label: 'Fort' }}
        paused={userPaused}
        onTogglePause={() => setUserPaused((p) => !p)}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        onExit={leave}
        extra={
          <button
            type="button"
            onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}
            aria-label={`Game speed ${speed}x`}
            aria-pressed={speed === 2}
            className={`min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center gap-0.5 text-sm font-bold ${speed === 2 ? 'bg-yellow-400 text-stone-900' : 'text-white hover:bg-white/10'}`}
          >
            <FiFastForward className="w-4 h-4" aria-hidden />
            {speed}x
          </button>
        }
      />

      <div className="max-w-6xl mx-auto px-3 py-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative min-w-0">
          <Battlefield
            stateRef={tdRef}
            fxRef={fxRef}
            clockRef={clockRef}
            shakeUntilRef={shakeUntilRef}
            version={version}
            selectedPadId={selectedPadId}
            strikeMode={strikeMode}
            onPadClick={(padId) => setSelectedPadId((cur) => (cur === padId ? null : padId))}
            onFieldClick={(point) => {
              act((t, ev) => activateAbility(t, 'strike', point, ev))
              setStrikeMode(false)
            }}
          />
          <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
            {banner && (
              <div
                className={`rounded-2xl px-5 py-2.5 text-center shadow-xl animate-gamev2-pop-in ${
                  banner.tone === 'boss' ? 'bg-purple-950/90 border border-purple-400' : banner.tone === 'good' ? 'bg-emerald-900/90 border border-emerald-400' : 'bg-stone-900/90 border border-white/20'
                }`}
              >
                <p className="text-lg sm:text-xl font-bold">{banner.title}</p>
                {banner.sub && <p className="text-xs sm:text-sm text-stone-200">{banner.sub}</p>}
              </div>
            )}
          </div>
          {strikeMode && (
            <div className="absolute inset-x-0 bottom-3 flex justify-center px-3">
              <div className="rounded-xl bg-orange-600/95 px-4 py-2 text-sm font-semibold flex items-center gap-3">
                Tap the field to drop Stone Rain
                <button type="button" onClick={() => setStrikeMode(false)} className="underline min-h-[36px]">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {userPaused && (
            <div className="absolute inset-0 rounded-2xl bg-stone-950/70 flex items-center justify-center">
              <button type="button" onClick={() => setUserPaused(false)} className="inline-flex items-center gap-2 min-h-[52px] px-6 rounded-2xl bg-yellow-400 text-stone-900 font-bold text-lg">
                <FiPlay className="w-5 h-5" aria-hidden /> Resume
              </button>
            </div>
          )}
          {battleOver && (
            <div className="absolute inset-0 rounded-2xl bg-stone-950/60 flex items-center justify-center p-4 pointer-events-none">
              <div className="text-center">
                <p className="text-3xl sm:text-4xl font-bold">{hud.phase === 'victory' ? 'Fort defended!' : 'Your fort fell'}</p>
                <p className="text-stone-300 mt-1">{remainingQuestions > 0 ? 'Finish the remaining questions to see your results.' : 'Calculating your results...'}</p>
              </div>
            </div>
          )}
        </div>

        <aside className={`space-y-3 ${showQuestion ? 'order-first lg:order-none' : ''}`}>
          {toast && (
            <div role="status" className="rounded-xl bg-yellow-400 text-stone-900 px-3 py-2 text-sm font-bold text-center">
              {toast}
            </div>
          )}

          {((hud.phase === 'prep' && dueNow > 0 && !sessionDone) || (battleOver && remainingQuestions > 0)) && challengePanel}

          {hud.phase === 'prep' && (
            <div className="rounded-2xl bg-stone-900/80 border border-white/10 p-3">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                {boss && <FiAlertTriangle className="w-4 h-4 text-purple-300" aria-hidden />}
                Wave {hud.wave} incoming{boss ? ' -- BOSS' : ''}
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {nextWaveSummary.map((w) => (
                  <li key={w.kind} className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: ENEMY_DEFINITIONS[w.kind].color }} aria-hidden />
                    {ENEMY_DEFINITIONS[w.kind].name} x{w.count}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={!canStartWave}
                onClick={() => {
                  setSelectedPadId(null)
                  act((t, ev) => startWave(t, ev))
                }}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <FiShield className="w-4 h-4" aria-hidden />
                {canStartWave ? `Start wave ${hud.wave}` : 'Answer the challenge to start'}
              </button>
            </div>
          )}

          {hud.phase === 'wave' && (
            <div className="rounded-2xl bg-stone-900/80 border border-white/10 p-3">
              <div className="flex items-center justify-between text-sm">
                <p className="font-semibold">Abilities</p>
                <p className="text-stone-300">{hud.enemiesLeft} enemies left</p>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {ABILITIES.map((a) => {
                  const ready = abilityReady(td, a.id)
                  const cooling = hud.cooldowns[a.id] > hud.timeMs
                  return (
                    <button
                      key={a.id}
                      type="button"
                      disabled={!ready}
                      onClick={() => {
                        if (a.needsTarget) setStrikeMode(true)
                        else act((t, ev) => activateAbility(t, a.id, null, ev))
                      }}
                      title={a.description}
                      className="text-left rounded-xl bg-stone-800 hover:bg-stone-700 p-2 min-h-[48px] disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                      <p className="text-sm font-semibold leading-tight">{a.name}</p>
                      <p className="text-[11px] text-stone-400">
                        {cooling ? `Ready in ${Math.ceil((hud.cooldowns[a.id] - hud.timeMs) / 1000)}s` : `${a.charges} scrolls`}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {!battleOver && (
            <TowerShop
              coins={hud.coins}
              selectedPadId={selectedPadId}
              tower={selectedTower}
              onBuild={(type: TowerTypeId) => act((t, ev) => placeTower(t, selectedPadId!, type, ev))}
              onUpgrade={() => selectedTower && act((t, ev) => upgradeTower(t, selectedTower.id, ev))}
              onSell={() => {
                if (!selectedTower) return
                act((t, ev) => sellTower(t, selectedTower.id, ev))
                setSelectedPadId(null)
              }}
              onTargeting={(mode: TargetingMode) => selectedTower && act((t) => setTargeting(t, selectedTower.id, mode))}
              onClose={() => setSelectedPadId(null)}
            />
          )}
        </aside>
      </div>
    </div>
  )
}
