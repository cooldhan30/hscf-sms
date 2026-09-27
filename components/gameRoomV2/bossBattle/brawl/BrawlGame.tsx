'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FiPause, FiPlay, FiVolume2, FiVolumeX, FiLogOut, FiZap, FiCheckCircle, FiMusic, FiHeart, FiStar } from 'react-icons/fi'
import { GiCrown, GiScrollUnfurled, GiCrossedSwords, GiSkullCrossedBones } from 'react-icons/gi'
import { GameV2Error } from '@/components/gameRoomV2'
import { useGameV2Motion } from '@/components/gameRoomV2/useGameV2Motion'
import { CelebrationLayer, type CelebrationHandle } from '@/components/gameRoomV2/celebration/CelebrationLayer'
import { AnswerReview } from '@/components/gameRoomV2/celebration/AnswerReview'
import { QuestionOverlay, type QuestionOverlayQuestion, type AnswerResult, useSoundPreference, useMusicPreference, playSound, useGameSessionState, vibrate } from '@/components/gameRoomV2/gameplay'
import { Confetti } from '@/components/gameRoomV2/celebration/Confetti'
import { useManagedTimeouts } from '@/components/gameRoomV2/gameplay/useManagedTimeouts'
import { useQuestionGate } from '@/components/gameRoomV2/gameplay/useQuestionGate'
import { formatAnswer } from '@/lib/gameRoomV2/answerReveal'
import { seedFromString } from '@/lib/gameRoomV2/gameplay/rng'
import type { BaseSessionStatePayload } from '@/lib/gameRoomV2/gameplay/sessionPolling'
import type { MusicMood } from '@/components/gameRoomV2/gameplay/gameMusic'
import {
  ARENAS,
  TOTAL_WAVES,
  BOSS_STAGE,
  ENEMIES,
  createBrawl,
  chooseUpgrade,
  answerCheckpoint,
  closeCheckpoint,
  playerStats,
  getUpgrade,
  boss as bossOf,
  type ArenaId,
  type BrawlDifficulty,
  type BrawlEvent,
  type BrawlState,
  type UpgradeChoice,
  type UpgradeId,
} from '@/lib/gameRoomV2/bossBattle/brawl'
import { BrawlCanvas } from './BrawlCanvas'
import { BrawlSetup } from './BrawlSetup'
import { BrawlResults } from './BrawlResults'
import { BrawlMusic } from './music'
import { UPGRADE_ICON, UPGRADE_TINT } from './icons'
import { Bi, ta } from '@/components/gameRoomV2/Bi'
import { TA } from '@/lib/gameRoomV2/i18n/ta'

// Solo Boss Battle: a real-time arena brawler (see
// lib/gameRoomV2/bossBattle/brawl/sim.ts). The arena canvas IS the
// screen; the Tamizhi shell floats over it -- HUD chips, the upgrade
// picker, the checkpoint's Tamil challenge, pause and results.
//
// Learning stays server-authoritative exactly as in every other engine:
// answers are graded by /answer (QuestionOverlay), the session is paused
// server-side whenever no question is on screen (useQuestionGate), and
// XP / coins / achievements come only from /complete. The simulation just
// hears "correct" or "not quite" and turns it into in-run rewards.

interface StatePayload extends BaseSessionStatePayload {
  remainingSeconds: number | null
  question: QuestionOverlayQuestion | null
}

interface Hud {
  hp: number
  maxHp: number
  level: number
  xp: number
  xpNext: number
  stage: number
  waveLeft: number
  status: BrawlState['status']
  boss: { kind: 'golem' | 'irul'; name: string; hp: number; maxHp: number; phase: 1 | 2; intro: boolean } | null
  checkpoint: { index: number; due: number; answered: number; correct: number } | null
  choices: UpgradeChoice[] | null
  betweenStages: boolean
  levels: [UpgradeId, number][]
}

function snapshot(s: BrawlState): Hud {
  const b = bossOf(s)
  return {
    hp: Math.max(0, Math.ceil(s.player.hp)),
    maxHp: playerStats(s).maxHp,
    level: s.level,
    xp: s.xp,
    xpNext: s.xpNext,
    stage: s.stage,
    waveLeft: Math.max(0, s.waveLeft),
    status: s.status,
    boss: b ? { kind: b.kind as 'golem' | 'irul', name: ENEMIES[b.kind].name, hp: Math.max(0, b.hp), maxHp: b.maxHp, phase: b.boss!.phase, intro: b.state === 'intro' } : null,
    checkpoint: s.checkpoint ? { ...s.checkpoint } : null,
    choices: s.choices ? [...s.choices] : null,
    betweenStages: s.afterChoice === 'nextStage',
    levels: (Object.entries(s.levels) as [UpgradeId, number][]).filter(([, lv]) => lv > 0),
  }
}

type Banner = { title: string; sub?: string; kicker?: string; tone: 'wave' | 'boss' | 'good' | 'danger'; id: number }
type Feedback =
  | { correct: true; heal: number; streak: number; id: number }
  | { correct: false; answer: string; right: string | null; explanation: string | null; id: number }

const WAVE_NEWS: Record<number, string> = {
  1: 'நிழல்களும் பாய்வீரர்களும் -- நகர்ந்துகொண்டே இருங்கள்!',
  2: 'உமிழ்வோரும் சிறுபூச்சிகளும் சேர்கின்றனர். ஒரு காவலன் விழிக்கிறான்...',
  3: 'ஒளிரும்போது முரடர்கள் பாய்வார்கள் -- விலகிப் பாயுங்கள்',
  4: 'எல்லாம் ஒரே நேரத்தில். தாக்குப்பிடியுங்கள்!',
}

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

export function BrawlGame({ sessionId, onExit, onPlayAgain, onHome }: { sessionId: string; onExit: () => void; onPlayAgain?: () => void; onHome?: () => void }) {
  const [arenaId, setArenaId] = useState<ArenaId>(() => ARENAS[seedFromString(sessionId) % ARENAS.length].id)
  const [difficulty, setDifficulty] = useState<BrawlDifficulty | null>(null)
  const brawlRef = useRef<BrawlState | null>(null)
  const runningRef = useRef(false)
  const musicRef = useRef<BrawlMusic | null>(null)
  const [built, setBuilt] = useState(false)
  const [hud, setHud] = useState<Hud | null>(null)
  const [userPaused, setUserPaused] = useState(false)
  const [banner, setBanner] = useState<Banner | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [answeredIndex, setAnsweredIndex] = useState(-1)
  const [outcome, setOutcome] = useState<'victory' | 'defeat' | null>(null)
  const [moment, setMoment] = useState<'victory' | 'defeat' | null>(null)
  const [momentDone, setMomentDone] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const streakRef = useRef(0)
  const celebrateRef = useRef<CelebrationHandle>(null)
  const bannerId = useRef(0)
  const reduced = !!useGameV2Motion().reduced
  const reducedRef = useRef(reduced)
  reducedRef.current = reduced
  const view = useViewport()
  const { soundEnabled, toggleSound } = useSoundPreference()
  const { musicEnabled, toggleMusic } = useMusicPreference()
  const soundRef = useRef(soundEnabled)
  soundRef.current = soundEnabled
  const schedule = useManagedTimeouts()
  const { state: session, error, result, poll, exit } = useGameSessionState<StatePayload>({ sessionId, enabled: !!difficulty, soundEnabled })

  // The chosen arena is visible behind the start card from the first frame.
  if (!brawlRef.current || (!built && brawlRef.current.arena.id !== arenaId)) {
    brawlRef.current = createBrawl({ seed: seedFromString(sessionId), difficulty: 'normal', arenaId, totalQuestions: 10 })
  }

  const refreshHud = useCallback(() => {
    if (brawlRef.current) setHud(snapshot(brawlRef.current))
  }, [])

  const showBanner = useCallback(
    (b: Omit<Banner, 'id'>, ms = 1800) => {
      const id = ++bannerId.current
      setBanner({ ...b, id })
      schedule(() => setBanner((cur) => (cur?.id === id ? null : cur)), ms)
    },
    [schedule]
  )

  // Simulation events -> sound, banners, the end of the run.
  const onEvents = useCallback(
    (events: BrawlEvent[]) => {
      const snd = soundRef.current
      let structural = false
      for (const e of events) {
        switch (e.type) {
          case 'shot':
            playSound(e.weapon === 'flame' ? 'flame' : e.weapon === 'vel' ? 'spear' : 'frostBell', snd)
            break
          case 'hit':
            playSound('hit', snd)
            break
          case 'hurt':
            playSound('hurt', snd)
            vibrate('incorrect', snd)
            break
          case 'burn':
            playSound('hit', snd)
            break
          case 'pickup':
            playSound('pickup', snd)
            break
          case 'levelUp':
            playSound('levelUp', snd)
            structural = true
            break
          case 'dash':
            playSound('dash', snd)
            break
          case 'slam':
            playSound('slam', snd)
            break
          case 'telegraph':
            if (e.kind !== 'spit' && e.kind !== 'brute') playSound('countdown', snd)
            break
          case 'waveStart':
            showBanner({ kicker: e.stage === TOTAL_WAVES ? `Wave ${e.stage} · final wave` : `Wave ${e.stage}`, title: e.stage === TOTAL_WAVES ? TA.finalWave.ta : `${TA.wave.ta} ${e.stage}`, sub: WAVE_NEWS[e.stage], tone: 'wave' }, 2200)
            playSound('waveStart', snd)
            structural = true
            break
          case 'waveCleared':
            showBanner({ kicker: 'Wave cleared!', title: TA.waveCleared.ta, sub: e.stage === TOTAL_WAVES ? 'இருளில் ஏதோ அசைகிறது...' : 'ஒரு கோயில் சோதனைச் சாவடி காத்திருக்கிறது', tone: 'good' }, 2000)
            playSound('waveClear', snd)
            structural = true
            break
          case 'bossSpawn':
            if (e.boss === 'golem') showBanner({ kicker: 'Mini-boss · Stone Guardian', title: 'கல் காவலன்', sub: 'சிவப்பு வட்டங்களிலிருந்து விலகுங்கள்!', tone: 'boss' }, 2600)
            else showBanner({ kicker: 'The final battle · Irul King', title: 'இருள் அரசன்', sub: 'சிவப்பு = ஆபத்து -- பாய்ந்து கடந்திடுங்கள் அல்லது ஓடுங்கள்', tone: 'boss' }, 3200)
            playSound('bossWarning', snd)
            structural = true
            break
          case 'bossPhase':
            showBanner({ kicker: 'Phase 2 · The king rages', title: 'அரசன் சீறுகிறான்!', sub: 'நிழல் குளங்கள், பாய்ச்சல்கள், சுழல்கள் -- கவனமாக!', tone: 'danger' }, 2400)
            playSound('enrage', snd)
            structural = true
            break
          case 'bossDefeated':
            playSound('achievement', snd)
            if (e.boss === 'golem') showBanner({ kicker: 'Guardian defeated!', title: 'காவலன் வீழ்ந்தான்!', tone: 'good' }, 1800)
            structural = true
            break
          case 'checkpoint':
          case 'blessing':
          case 'upgrade':
            structural = true
            break
          case 'victory':
          case 'defeat': {
            const win = e.type === 'victory'
            setOutcome(win ? 'victory' : 'defeat')
            setBanner(null)
            musicRef.current?.setMood('silent')
            schedule(() => {
              setMoment(win ? 'victory' : 'defeat')
              musicRef.current?.sting(win ? 'victory' : 'defeat')
              playSound(win ? 'victory' : 'gameOver', soundRef.current)
              if (win) vibrate('victory', soundRef.current)
            }, reducedRef.current ? 150 : win ? 900 : 700)
            schedule(() => setMomentDone(true), reducedRef.current ? 1600 : win ? 4200 : 3600)
            structural = true
            break
          }
          default:
            break
        }
      }
      if (structural) refreshHud()
    },
    [showBanner, schedule, refreshHud]
  )

  // Build the real run once the session (question count) is known.
  useEffect(() => {
    if (!difficulty || !session || built) return
    brawlRef.current = createBrawl({ seed: seedFromString(sessionId), difficulty, arenaId, totalQuestions: session.totalQuestions })
    setBuilt(true)
    refreshHud()
    schedule(() => showBanner({ kicker: `${ARENAS.find((a) => a.id === arenaId)!.tamilName} · Wave 1`, title: `${TA.wave.ta} 1`, sub: WAVE_NEWS[1], tone: 'wave' }, 2200), 200)
  }, [difficulty, session, sessionId, built, arenaId, refreshHud, schedule, showBanner])

  const s = brawlRef.current
  const answered = session?.currentIndex ?? 0
  const sessionDone = session?.status === 'COMPLETED' || !!result
  const remainingQuestions = session ? Math.max(0, session.totalQuestions - answered) : 0
  const over = !!outcome
  const cp = hud?.checkpoint ?? null
  const checkpointOpen = !!cp && cp.answered < cp.due && !over
  const wantQuestion = built && !userPaused && !sessionDone && (checkpointOpen || (over && momentDone && remainingQuestions > 0))
  const { questionReady } = useQuestionGate({ sessionId, state: session, wantQuestion, poll, enabled: built })
  const showQuestion = questionReady && !!session?.question && session.currentIndex > answeredIndex
  const challengeOpen = checkpointOpen || (over && momentDone && remainingQuestions > 0)
  const picking = !!hud?.choices && !checkpointOpen && !over
  runningRef.current = built && !userPaused && !over
  const controlsEnabled = built && !userPaused && !over && !checkpointOpen && !picking

  // A checkpoint the session can no longer fill closes on what was answered.
  useEffect(() => {
    if (!built || !checkpointOpen || !session) return
    if (sessionDone || remainingQuestions === 0) {
      const ev: BrawlEvent[] = []
      closeCheckpoint(brawlRef.current!, ev)
      onEvents(ev)
      refreshHud()
    }
  }, [built, checkpointOpen, session, sessionDone, remainingQuestions, onEvents, refreshHud])

  // --- Music ---------------------------------------------------------------
  const startMusic = useCallback(() => {
    if (!musicRef.current) musicRef.current = new BrawlMusic()
    musicRef.current.start()
  }, [])
  useEffect(() => () => musicRef.current?.dispose(), [])
  useEffect(() => {
    musicRef.current?.setEnabled(musicEnabled)
  }, [musicEnabled])
  const bossStage = (hud?.stage ?? 1) >= BOSS_STAGE
  const calm = !!hud && (!!hud.checkpoint || (!!hud.choices && hud.betweenStages)) && !bossStage
  const phase2 = hud?.boss?.kind === 'irul' && hud.boss.phase === 2
  const lateWaves = (hud?.stage ?? 1) >= 3
  useEffect(() => {
    const m = musicRef.current
    if (!m || !built || outcome) return
    const mood: MusicMood = calm ? 'prep' : bossStage ? 'boss' : 'battle'
    m.setMood(mood, mood === 'boss' ? phase2 : mood === 'battle' && lateWaves)
  }, [built, outcome, calm, bossStage, phase2, lateWaves])
  useEffect(() => {
    if (showResults) musicRef.current?.setMood('prep')
  }, [showResults])
  useEffect(() => {
    musicRef.current?.duck(showQuestion || userPaused)
  }, [showQuestion, userPaused])
  useEffect(() => {
    const onVis = () => {
      const hidden = document.visibilityState === 'hidden'
      musicRef.current?.setHidden(hidden)
      if (hidden && brawlRef.current?.status === 'fighting') setUserPaused(true)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // After the end moment: any remaining questions, then the results.
  useEffect(() => {
    if (!outcome || !momentDone || showResults || remainingQuestions > 0 || !sessionDone) return
    schedule(() => setShowResults(true), reduced ? 100 : 300)
  }, [outcome, momentDone, showResults, remainingQuestions, sessionDone, reduced, schedule])

  const choose = useCallback(
    (i: number) => {
      const st = brawlRef.current
      if (!st?.choices) return
      const ev: BrawlEvent[] = []
      if (chooseUpgrade(st, i, ev)) {
        playSound('upgrade', soundRef.current)
        onEvents(ev)
        refreshHud()
      }
    },
    [onEvents, refreshHud]
  )

  // Keyboard: Esc pause, 1-3 pick an upgrade.
  useEffect(() => {
    if (!built || over) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Escape') {
        setUserPaused((p) => !p)
        return
      }
      if (picking && !userPaused) {
        const n = Number(e.key)
        if (n >= 1 && n <= 3) choose(n - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [built, over, picking, userPaused, choose])

  function handleAnswer(res: AnswerResult) {
    const st = brawlRef.current
    if (!st || !session) return
    setAnsweredIndex(session.currentIndex)
    const id = Date.now()
    const ev: BrawlEvent[] = []
    const r = st.checkpoint ? answerCheckpoint(st, res.correct, ev) : { heal: 0 }
    if (res.correct) {
      streakRef.current++
      if (streakRef.current >= 2) schedule(() => playSound('streak', soundRef.current, streakRef.current), 160)
      setFeedback({ correct: true, heal: r.heal, streak: streakRef.current, id })
      celebrateRef.current?.correct({ streak: streakRef.current, card: false, sound: false })
    } else {
      streakRef.current = 0
      setFeedback({ correct: false, answer: formatAnswer(res.answer), right: res.correctAnswer ?? null, explanation: res.explanation ?? null, id })
    }
    schedule(() => setFeedback((f) => (f?.id === id ? null : f)), res.correct ? 1700 : 6500)
    onEvents(ev)
    refreshHud()
    poll()
  }

  const leave = () => exit(onExit)
  const again = () => exit(onPlayAgain ?? onExit)

  if (error && !session && difficulty) return <GameV2Error description={error} onRetry={poll} />

  const narrow = (view?.w ?? 1000) < 640
  const bannerStyle =
    banner?.tone === 'boss'
      ? 'bg-gradient-to-b from-purple-700 to-purple-900 text-white border-gold-400'
      : banner?.tone === 'danger'
        ? 'bg-gradient-to-b from-rose-600 to-rose-800 text-white border-rose-200'
        : banner?.tone === 'good'
          ? 'bg-gradient-to-b from-primary-500 to-primary-700 text-white border-gold-300'
          : 'bg-white text-stone-900 border-primary-200'
  const hpPct = hud ? Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100)) : 100
  const blessedPick = !!hud?.choices?.[0]?.blessed

  return (
    <div className="fixed inset-0 overflow-hidden bg-stone-800 font-sans text-stone-900 select-none" style={{ height: '100dvh' }}>
      <CelebrationLayer ref={celebrateRef} soundEnabled={soundEnabled} reducedMotion={reduced} />
      {view && s && (
        <BrawlCanvas
          key={`${arenaId}-${built ? 'run' : 'preview'}`}
          stateRef={brawlRef}
          runningRef={runningRef}
          width={view.w}
          height={view.h}
          reducedMotion={reduced}
          controlsEnabled={controlsEnabled}
          onEvents={onEvents}
          onTick={refreshHud}
        />
      )}

      {/* ---------------- HUD ---------------- */}
      {built && hud && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2 sm:p-3 [padding-top:max(0.5rem,env(safe-area-inset-top))]">
          <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 sm:gap-2 max-w-[62%]">
            <div className="flex items-center gap-2 rounded-2xl bg-white/90 shadow-md px-2.5 sm:px-3 py-1.5" aria-label={`${ta('health', true)}: ${hud.hp} / ${hud.maxHp}`}>
              <FiHeart className={`w-5 h-5 ${hpPct > 50 ? 'text-rose-500' : hpPct > 25 ? 'text-gold-600' : 'text-rose-700 animate-pulse'}`} aria-hidden />
              <div className="w-20 sm:w-36 h-3 rounded-full bg-stone-200 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-200 ${hpPct > 50 ? 'bg-rose-500' : hpPct > 25 ? 'bg-gold-400' : 'bg-rose-700'}`} style={{ width: `${hpPct}%` }} />
              </div>
              <span className="text-xs font-extrabold tabular-nums text-stone-700">{hud.hp}</span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-white/90 shadow-md px-2.5 sm:px-3 py-1.5" aria-label={`${ta('level', true)} ${hud.level}`}>
              <FiStar className="w-4 h-4 text-gold-600" aria-hidden />
              <span className="text-sm font-black tabular-nums"><span className="font-tamil">{TA.level.ta}</span> {hud.level}</span>
              <div className="w-12 sm:w-20 h-2 rounded-full bg-stone-200 overflow-hidden" aria-hidden>
                <div className="h-full rounded-full bg-sky-500 transition-all duration-200" style={{ width: `${Math.min(100, (hud.xp / hud.xpNext) * 100)}%` }} />
              </div>
            </div>
          </div>

          <div className="pointer-events-none hidden md:flex flex-col items-center gap-1.5 absolute left-1/2 -translate-x-1/2 top-2 sm:top-3">
            <StageChip hud={hud} />
            {hud.boss && <BossBar boss={hud.boss} />}
          </div>

          <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button type="button" onClick={toggleMusic} aria-pressed={musicEnabled} aria-label={`${ta('music', true)}: ${musicEnabled ? TA.on.ta : TA.off.ta}`} title={ta('music', true)} className={`hidden sm:flex w-11 h-11 rounded-2xl shadow-md items-center justify-center ${musicEnabled ? 'bg-white/90 text-stone-700' : 'bg-white/70 text-stone-400'}`}>
              <MusicIcon on={musicEnabled} />
            </button>
            <button type="button" onClick={toggleSound} aria-pressed={soundEnabled} aria-label={`${ta('sounds', true)}: ${soundEnabled ? TA.on.ta : TA.off.ta}`} title={ta('sounds', true)} className="w-11 h-11 rounded-2xl bg-white/90 shadow-md text-stone-700 flex items-center justify-center">
              {soundEnabled ? <FiVolume2 className="w-5 h-5" /> : <FiVolumeX className="w-5 h-5" />}
            </button>
            <button type="button" onClick={() => setUserPaused((p) => !p)} aria-label={userPaused ? ta('resume', true) : ta('pause', true)} className="w-11 h-11 rounded-2xl bg-white/90 shadow-md text-stone-700 flex items-center justify-center">
              {userPaused ? <FiPlay className="w-5 h-5" /> : <FiPause className="w-5 h-5" />}
            </button>
            <button type="button" onClick={leave} aria-label={ta('exitGame', true)} className="w-11 h-11 rounded-2xl bg-white/90 shadow-md text-stone-700 flex items-center justify-center">
              <FiLogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      {built && hud && (
        <div className="pointer-events-none absolute inset-x-0 top-[6.4rem] sm:top-[3.6rem] z-20 flex md:hidden flex-col items-center gap-1 px-2">
          <StageChip hud={hud} />
          {hud.boss && <BossBar boss={hud.boss} />}
        </div>
      )}
      {/* Build strip. */}
      {built && hud && !narrow && hud.levels.length > 0 && !challengeOpen && (
        <ul className="pointer-events-none absolute left-3 bottom-3 z-20 flex items-center gap-1.5 [margin-bottom:env(safe-area-inset-bottom)]" aria-label="Your upgrades">
          {hud.levels.map(([id, lv]) => {
            const Icon = UPGRADE_ICON[id]
            return (
              <li key={id} className="relative" title={`${getUpgrade(id).name} ${lv}`}>
                <span className={`w-10 h-10 rounded-xl ${UPGRADE_TINT[id]} text-white border-2 border-white shadow flex items-center justify-center`}>
                  <Icon className="w-5 h-5" aria-hidden />
                </span>
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-white text-[10px] font-black text-stone-800 flex items-center justify-center shadow">{lv}</span>
                <span className="sr-only">
                  {getUpgrade(id).name} level {lv}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {/* ---------------- Banners ---------------- */}
      <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-[24%] z-30 flex justify-center px-4">
        {banner && (
          <div key={banner.id} className={`rounded-3xl border-4 px-6 sm:px-10 py-3 sm:py-4 text-center shadow-2xl animate-gamev2-banner ${bannerStyle}`} style={{ animationDuration: '2.8s' }}>
            {banner.tone === 'boss' && <GiCrown className="w-8 h-8 mx-auto text-gold-300" aria-hidden />}
            {banner.kicker && <p className="mb-1 text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] opacity-80">{banner.kicker}</p>}
            <p className="font-tamil text-3xl sm:text-5xl font-black tracking-wide leading-tight">{banner.title}</p>
            {banner.sub && <p className="font-tamil mt-1 text-sm sm:text-base font-semibold opacity-90">{banner.sub}</p>}
          </div>
        )}
      </div>

      {/* ---------------- Upgrade picker ---------------- */}
      {picking && hud?.choices && !userPaused && (
        <div className="absolute inset-0 z-40 bg-stone-900/45 backdrop-blur-[1px] overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-3 sm:p-6">
            <div className="w-full max-w-3xl text-center animate-gamev2-pop-in">
              <p className={`text-xs font-black uppercase tracking-[0.2em] ${blessedPick ? 'text-gold-300' : 'text-white/80'}`}><span className="font-tamil normal-case tracking-normal text-sm">{blessedPick ? 'தமிழ் அருள் · ஒவ்வொரு தேர்வும் 2 நிலைகள் தரும்' : hud.betweenStages ? 'கோயில் பரிசு' : `${TA.level.ta} ${hud.level}`}</span></p>
              <h2 className={`text-3xl sm:text-5xl font-black tracking-wide ${blessedPick ? 'text-gold-300' : 'text-white'} drop-shadow`}><span className="font-tamil">{blessedPick ? 'பொன் மேம்பாடு!' : TA.levelUp.ta}</span></h2>
              <p className="mt-1 text-sm font-semibold text-white/85"><span className="font-tamil">ஒன்றைத் தேர்ந்தெடுங்கள்</span> · Choose one{narrow ? '' : ' (1-3)'}</p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                {hud.choices.map((c, i) => (
                  <UpgradeCard key={`${c.id}-${i}`} choice={c} index={i} current={brawlRef.current?.levels[c.id] ?? 0} onPick={() => choose(i)} narrow={narrow} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Tamil checkpoint ---------------- */}
      {built && challengeOpen && (
        <>
          <div className="pointer-events-none absolute inset-0 z-20 bg-stone-900/25" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center p-2 sm:p-4 [padding-bottom:max(0.5rem,env(safe-area-inset-bottom))]">
            <div className="w-full max-w-xl max-h-[70dvh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-primary-100 p-3 sm:p-4 animate-gamev2-pop-in">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-700 flex items-center gap-1.5">
                  <GiScrollUnfurled className="w-4 h-4" aria-hidden />
                  {over ? <Bi k="bankProgress" inline /> : <span className="font-tamil normal-case tracking-normal">கோயில் சோதனைச் சாவடி · {Math.min(cp!.answered + 1, cp!.due)}/{cp!.due}</span>}
                </p>
                {!over && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-black text-gold-800">
                    <FiHeart className="w-3 h-3" aria-hidden /> <span className="font-tamil">குணம் · பொன் மேம்பாடு</span>
                  </span>
                )}
              </div>
              {!over && cp && (
                <p className="mb-1 text-xs font-semibold text-stone-500 font-tamil">
                  பொன் மேம்பாட்டைத் திறக்க {cp.due} இல் {Math.ceil(cp.due / 2)} கேள்விகளுக்குச் சரியாக விடையளியுங்கள்{cp.answered > 0 ? ` · இதுவரை ${cp.correct} சரி` : ''}.
                </p>
              )}
              {showQuestion && session?.question ? (
                <QuestionOverlay variant="compact" sessionId={sessionId} question={session.question} questionIndex={session.currentIndex} remainingSeconds={session.remainingSeconds} onResult={handleAnswer} />
              ) : (
                <p className="py-6 text-center text-sm text-stone-500"><span className="font-tamil">அடுத்த சுவடி விரிகிறது...</span></p>
              )}
            </div>
          </div>
        </>
      )}
      {feedback && (
        <div className="pointer-events-none absolute inset-x-0 top-[5.5rem] md:top-[6.5rem] z-40 flex justify-center px-3">
          {feedback.correct ? (
            <div key={feedback.id} role="status" className="rounded-3xl bg-gradient-to-b from-primary-500 to-primary-700 text-white border-4 border-gold-300 shadow-2xl px-6 py-2.5 text-center animate-gamev2-pop-in">
              <p className="flex items-center justify-center gap-2 text-2xl sm:text-3xl font-black tracking-wide">
                <FiCheckCircle className="w-6 h-6" aria-hidden /> <span className="font-tamil">{TA.correct.ta}</span>
              </p>
              <p className="mt-0.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-sm sm:text-base font-extrabold">
                {feedback.heal > 0 && (
                  <span className="inline-flex items-center gap-1 text-rose-100">
                    <FiHeart className="w-4 h-4" aria-hidden />+{feedback.heal} <span className="font-tamil">{TA.health.ta}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-gold-200">
                  <GiCrown className="w-4 h-4" aria-hidden /> <span className="font-tamil">அருள் ஆற்றல்</span>
                </span>
                {feedback.streak >= 2 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold-400 px-2 text-stone-900">
                    <FiZap className="w-3.5 h-3.5" aria-hidden />
                    <span className="font-tamil">{TA.streak.ta}</span> ×{feedback.streak}
                  </span>
                )}
              </p>
            </div>
          ) : (
            <div key={feedback.id} className="pointer-events-auto max-w-md w-full animate-gamev2-pop-in">
              <AnswerReview yourAnswer={feedback.answer} correctAnswer={feedback.right} explanation={feedback.explanation} seed={feedback.id} onDismiss={() => setFeedback(null)} />
            </div>
          )}
        </div>
      )}

      {/* ---------------- Pause ---------------- */}
      {userPaused && (
        <div className="absolute inset-0 z-50 bg-stone-900/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl p-5 text-center">
            <h2 className="text-2xl font-black"><Bi k="paused" /></h2>
            {hud && (
              <p className="text-sm text-stone-500 mt-1">
                <span className="font-tamil">{hud.stage >= BOSS_STAGE ? 'தலைமை எதிரியுடன் போர்' : `${TA.wave.ta} ${hud.stage}/${TOTAL_WAVES}`} · {TA.level.ta} {hud.level} · {TA.health.ta} {hud.hp}/{hud.maxHp}</span>
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={toggleMusic} aria-pressed={musicEnabled} className={`min-h-[48px] rounded-2xl border font-bold inline-flex items-center justify-center gap-2 ${musicEnabled ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-stone-300 text-stone-500'}`}>
                <MusicIcon on={musicEnabled} /> <span className="font-tamil">{TA.music.ta}</span> {musicEnabled ? '✓' : '✕'}
              </button>
              <button type="button" onClick={toggleSound} aria-pressed={soundEnabled} className={`min-h-[48px] rounded-2xl border font-bold inline-flex items-center justify-center gap-2 ${soundEnabled ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-stone-300 text-stone-500'}`}>
                {soundEnabled ? <FiVolume2 className="w-5 h-5" aria-hidden /> : <FiVolumeX className="w-5 h-5" aria-hidden />} <span className="font-tamil">{TA.sounds.ta}</span> {soundEnabled ? '✓' : '✕'}
              </button>
            </div>
            <div className="mt-2 grid gap-2">
              <button type="button" onClick={() => setUserPaused(false)} className="min-h-[52px] rounded-2xl bg-primary-700 hover:bg-primary-800 text-white font-extrabold text-lg inline-flex items-center justify-center gap-2">
                <FiPlay className="w-5 h-5" aria-hidden /> <Bi k="resume" inline />
              </button>
              <button type="button" onClick={leave} className="min-h-[48px] rounded-2xl border border-stone-300 font-semibold text-stone-700">
                <Bi k="exitGame" inline />
              </button>
            </div>
            <p className="mt-4 text-xs text-stone-500 text-left"><span className="font-tamil block mb-1">நகர: WASD / அம்புக் குறிகள், அல்லது திரையில் இழுங்கள். பாய்ச்சல்: Space அல்லது கேடய பொத்தான். ஆயுதங்கள் தானாகச் சுடும். சிவப்பு வட்டங்கள் வரவிருக்கும் தாக்குதல்கள்.</span>Move: WASD / arrow keys, or drag anywhere on a touch screen. Dash: Space or the shield button -- you can&apos;t be hurt mid-dash. Your weapons fire on their own. Red circles and lines are attacks about to land.</p>
          </div>
        </div>
      )}

      {/* ---------------- Start ---------------- */}
      {!difficulty && (
        <BrawlSetup
          arenaId={arenaId}
          onArena={setArenaId}
          onStart={(d) => {
            startMusic()
            setDifficulty(d)
          }}
        />
      )}
      {difficulty && !built && (
        <div className="absolute inset-0 z-40 flex items-center justify-center">
          <p className="rounded-2xl bg-white/95 px-5 py-3 font-bold shadow-lg" role="status">
            <span className="font-tamil">போர்க்களம் திறக்கிறது...</span>
          </p>
        </div>
      )}

      {moment && !momentDone && s && <EndMoment kind={moment} s={s} reduced={reduced} />}
      {showResults && outcome && s && (
        <BrawlResults victory={outcome === 'victory'} s={s} result={result} soundEnabled={soundEnabled} reducedMotion={reduced} onPlayAgain={onPlayAgain ? again : undefined} onNext={onHome} onBack={onHome ?? onExit} />
      )}
      {outcome && momentDone && !showResults && remainingQuestions === 0 && !sessionDone && (
        <p className="absolute inset-x-0 bottom-6 z-30 text-center text-sm font-bold text-white drop-shadow"><span className="font-tamil">{TA.saving.ta}</span></p>
      )}
    </div>
  )
}

function StageChip({ hud }: { hud: Hud }) {
  const boss = hud.stage >= BOSS_STAGE
  const secs = Math.ceil(hud.waveLeft)
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white/90 shadow-md px-3 py-1.5">
      <GiCrossedSwords className="w-4 h-4 text-terracotta-600" aria-hidden />
      <span className="text-sm font-black tracking-wide font-tamil">{boss ? TA.boss.ta : `${TA.wave.ta} ${hud.stage}/${TOTAL_WAVES}`}</span>
      {!boss && hud.status === 'fighting' && (
        <span className="text-xs font-bold tabular-nums text-stone-500">{secs > 0 ? `0:${String(secs).padStart(2, '0')}` : <span className="font-tamil">களத்தைச் சுத்தமாக்குங்கள்</span>}</span>
      )}
    </div>
  )
}

function BossBar({ boss }: { boss: NonNullable<Hud['boss']> }) {
  const pct = Math.max(0, (boss.hp / boss.maxHp) * 100)
  const rage = boss.phase === 2
  return (
    <div className={`flex items-center gap-2 rounded-2xl px-3 py-1.5 shadow-lg border-2 ${rage ? 'bg-rose-700 border-rose-300' : boss.kind === 'golem' ? 'bg-stone-700 border-gold-300' : 'bg-purple-800 border-gold-400'} text-white animate-gamev2-pop-in`} aria-label={`${boss.kind === 'irul' ? 'இருள் அரசன்' : 'கல் காவலன்'} · ${boss.name}: ${Math.round(pct)}%`}>
      {boss.kind === 'irul' ? <GiCrown className="w-5 h-5 text-gold-300" aria-hidden /> : <GiSkullCrossedBones className="w-5 h-5 text-gold-200" aria-hidden />}
      <span className="font-tamil text-xs font-black tracking-wide whitespace-nowrap">{boss.kind === 'irul' ? 'இருள் அரசன்' : 'கல் காவலன்'}</span>
      <div className="relative w-32 sm:w-56 h-3 rounded-full bg-black/30 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-200 ${rage ? 'bg-rose-300' : 'bg-gold-400'}`} style={{ width: `${boss.intro ? 100 : pct}%` }} />
        {boss.kind === 'irul' && <span className="absolute inset-y-0 left-1/2 w-0.5 bg-white/70" aria-hidden />}
      </div>
      {boss.kind === 'irul' && <span className="text-[10px] font-black font-tamil">{rage ? 'கட்டம் 2' : 'கட்டம் 1'}</span>}
    </div>
  )
}

function UpgradeCard({ choice, index, current, onPick, narrow }: { choice: UpgradeChoice; index: number; current: number; onPick: () => void; narrow: boolean }) {
  const def = getUpgrade(choice.id)
  const Icon = UPGRADE_ICON[choice.id]
  const isNew = current === 0
  const lines = def.levels.slice(current, choice.toLevel)
  return (
    <button
      type="button"
      onClick={onPick}
      className={`group relative text-left rounded-3xl bg-white shadow-2xl border-4 p-3 sm:p-4 transition-transform hover:-translate-y-1 active:scale-[0.98] focus-visible:outline focus-visible:outline-4 focus-visible:outline-gold-400 ${choice.blessed ? 'border-gold-400' : 'border-white hover:border-primary-300'}`}
    >
      {choice.blessed && <span className="absolute inset-0 rounded-[20px] bg-gradient-to-br from-gold-100/80 via-transparent to-gold-50/60 pointer-events-none" aria-hidden />}
      <div className="relative flex items-center gap-3">
        <span className={`shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl ${UPGRADE_TINT[choice.id]} text-white flex items-center justify-center shadow`}>
          <Icon className="w-7 h-7 sm:w-8 sm:h-8" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wide text-stone-500">
            {!narrow && <span className="mr-1 rounded bg-stone-100 px-1.5 text-stone-600">{index + 1}</span>}
            <span className="font-tamil normal-case">{isNew ? (def.kind === 'weapon' ? 'புதிய ஆயுதம்' : 'புதிய வரம்') : `${TA.level.ta} ${current} → ${choice.toLevel}`}</span>
          </p>
          <p className="font-tamil text-lg font-black text-stone-900 leading-tight">{def.tamilName}</p>
          <p className="text-xs text-primary-700">{def.name}</p>
        </div>
      </div>
      <ul className="relative mt-2 space-y-0.5 text-sm font-semibold text-stone-700 font-tamil">
        {lines.map((l, k) => (
          <li key={k} className="flex gap-1.5">
            <span className="text-primary-600" aria-hidden>
              •
            </span>
            {l}
          </li>
        ))}
      </ul>
      <div className="relative mt-2 flex gap-1" aria-label={`${ta('level', true)} ${choice.toLevel} / 5`}>
        {[1, 2, 3, 4, 5].map((lv) => (
          <span key={lv} className={`h-1.5 flex-1 rounded-full ${lv <= current ? 'bg-primary-500' : lv <= choice.toLevel ? (choice.blessed ? 'bg-gold-400' : 'bg-primary-300') : 'bg-stone-200'}`} />
        ))}
      </div>
    </button>
  )
}

function MusicIcon({ on }: { on: boolean }) {
  return (
    <span className="relative inline-flex" aria-hidden>
      <FiMusic className="w-5 h-5" />
      {!on && <span className="absolute left-1/2 top-1/2 h-[2px] w-6 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded bg-current" />}
    </span>
  )
}

function EndMoment({ kind, s, reduced }: { kind: 'victory' | 'defeat'; s: BrawlState; reduced: boolean }) {
  const win = kind === 'victory'
  const st = s.stats
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center px-4" role="status" aria-live="assertive">
      {win && <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(28,25,23,0.45)_0%,rgba(28,25,23,0.15)_45%,transparent_75%)]" aria-hidden />}
      {win && <Confetti intensity={1.2} reducedMotion={reduced} />}
      <div className={`relative text-center ${reduced ? '' : 'animate-gamev2-banner'}`} style={{ animationDuration: win ? '3.3s' : '3s' }}>
        {win ? (
          <>
            <GiCrown className="mx-auto w-14 h-14 sm:w-20 sm:h-20 text-gold-300 drop-shadow-[0_4px_0_rgba(120,53,15,0.6)]" aria-hidden />
            <p className="text-6xl sm:text-8xl font-black tracking-wider text-gold-300 [-webkit-text-stroke:2px_#78350f] drop-shadow-[0_6px_0_rgba(120,53,15,0.55)] font-tamil leading-tight">{TA.victory.ta}</p>
            <p className="font-tamil mt-2 inline-block rounded-full bg-stone-900/60 px-4 py-1.5 text-base sm:text-xl font-extrabold text-white">இருள் அரசன் வீழ்ந்தான் -- களம் விடுதலை பெற்றது!</p>
          </>
        ) : (
          <div className="rounded-3xl bg-white/95 shadow-2xl border-4 border-terracotta-200 px-6 py-5 sm:px-10">
            <GiCrossedSwords className="mx-auto w-12 h-12 text-terracotta-600" aria-hidden />
            <p className="font-tamil leading-tight text-4xl sm:text-6xl font-black text-terracotta-700">{TA.defeat.ta}</p>
            <p className="font-tamil mt-1 font-semibold text-stone-600">வீரமான போர்! நீங்கள் சாதித்தவை:</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 text-sm font-extrabold text-stone-800">
              <span className="rounded-2xl bg-primary-50 px-3 py-1.5"><span className="font-tamil">{s.stage >= BOSS_STAGE ? 'இருள் அரசனை அடைந்தீர்கள்' : `${TA.wave.ta} ${s.stage}/${TOTAL_WAVES}`}</span></span>
              <span className="rounded-2xl bg-primary-50 px-3 py-1.5"><span className="font-tamil">{st.kills} எதிரிகளை வென்றீர்கள்</span></span>
              <span className="rounded-2xl bg-gold-100 px-3 py-1.5"><span className="font-tamil">{TA.level.ta}</span> {st.bestLevel}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
