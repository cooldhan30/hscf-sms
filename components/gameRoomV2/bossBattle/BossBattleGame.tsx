'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { GameV2Card, GameV2Button, GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { QuestionOverlay, type QuestionOverlayQuestion, GameResultsScreen, useSoundPreference, playSound, useGameSessionState } from '@/components/gameRoomV2/gameplay'
import { BossSetupPicker } from './BossSetupPicker'
import { BossArena } from './BossArena'
import { CoopArena } from './CoopArena'
import { TeamAttackBanner } from './TeamAttackBanner'
import { VictorySequence } from './VictorySequence'
import { CoopResultsScreen } from './CoopResultsScreen'
import {
  createInitialBattle,
  applyCorrectAnswerDamage,
  applyWrongAnswerConsequence,
  activateAbility,
  tickBattle,
  getBossBattleDifficultySettings,
  PLAYER_ATTACKER_ID,
  getBoss,
  STREAK_TEAM_ATTACK_THRESHOLD,
  isCoopBattleConcluded,
  type BattleState,
  type BossId,
  type BossBattleDifficulty,
  type AbilityId,
  type CoopContribution,
} from '@/lib/gameRoomV2/bossBattle'

const SIM_INTERVAL_MS = 100
// Same "meaningful gameplay state, not animation frames" cadence as
// Racing's multiplayer polling -- boss HP/contributions travel over
// ordinary HTTP polling at a human-perceptible interval, never pushed
// over Realtime per tick.
const LIVE_POLL_INTERVAL_MS = 1500

interface StatePayload {
  status: 'CREATED' | 'READY' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED'
  currentIndex: number
  totalQuestions: number
  remainingSeconds: number | null
  question: QuestionOverlayQuestion | null
}

interface LiveBossBattleResponse {
  liveSessionStatus: 'LOBBY' | 'ACTIVE' | 'PAUSED' | 'ENDED'
  boss: { id: BossId; name: string; tamilName: string; phases: { name: string; healthShare: number }[] }
  bossHealth: number
  bossMaxHealth: number
  bossPhaseIndex: number
  victory: boolean
  totalDamageDealt: number
  contributions: CoopContribution[]
}

interface BossBattleGameProps {
  sessionId: string
  onExit: () => void
  onPlayAgain?: () => void
  // Present only when mounted inside Live Classroom (see
  // LivePlayClient.tsx) -- switches the whole component into
  // cooperative multiplayer mode: shared boss HP polled from
  // /api/gameroom-v2/live/[id]/boss-battle (server-computed from every
  // participant's own already-persisted correct-answer count) instead
  // of this client's own local battle simulation, and boss+difficulty
  // are fixed by the host rather than chosen here.
  liveSessionId?: string
  myParticipantId?: string
  fixedBossId?: BossId
  fixedDifficulty?: BossBattleDifficulty
}

// Boss Battle's top-level play screen. Solo mode (no liveSessionId) is
// completely unchanged from before: an individual player vs. a boss
// with its own health/counterattack/defeat state. Multiplayer mode (a
// liveSessionId is present) is a GENUINELY DIFFERENT, cooperative
// mechanic -- see lib/gameRoomV2/bossBattle/coopBattle.ts's header
// comment: no individual player health, no boss counterattack, no
// defeat state. A wrong answer has no visible consequence at all;
// every correct answer damages the one shared class-wide boss HP pool.
export function BossBattleGame({ sessionId, onExit, onPlayAgain, liveSessionId, myParticipantId, fixedBossId, fixedDifficulty }: BossBattleGameProps) {
  if (liveSessionId && myParticipantId) {
    return (
      <CoopBossBattleGame
        sessionId={sessionId}
        onExit={onExit}
        liveSessionId={liveSessionId}
        myParticipantId={myParticipantId}
        fixedBossId={fixedBossId}
        fixedDifficulty={fixedDifficulty}
      />
    )
  }
  return <SoloBossBattleGame sessionId={sessionId} onExit={onExit} onPlayAgain={onPlayAgain} />
}

// ============================================================
// SOLO -- unchanged behavior from before this pass.
// ============================================================
function SoloBossBattleGame({ sessionId, onExit, onPlayAgain }: { sessionId: string; onExit: () => void; onPlayAgain?: () => void }) {
  const [bossId, setBossId] = useState<BossId | null>(null)
  const [difficulty, setDifficulty] = useState<BossBattleDifficulty | null>(null)
  const [battle, setBattle] = useState<BattleState | null>(null)
  const [showQuestion, setShowQuestion] = useState(false)
  const [lastHitBoss, setLastHitBoss] = useState(false)
  const [lastHitPlayer, setLastHitPlayer] = useState(false)
  const [showVictorySequence, setShowVictorySequence] = useState(false)
  const { soundEnabled } = useSoundPreference()
  const { state: sessionState, error, result, poll, togglePause, exit } = useGameSessionState<StatePayload>({
    sessionId,
    enabled: !!difficulty,
    soundEnabled,
  })

  // Local battle clock: the boss counterattacks on its own phase-driven
  // interval, entirely independent of the 2s session poll. Frozen while
  // a question is shown or the session is paused, and kept running once
  // the session's questions are exhausted so a shorter Question Set
  // than the fight needs doesn't strand an unfinished battle.
  useEffect(() => {
    if (!battle || !difficulty || showQuestion || sessionState?.status === 'PAUSED' || battle.battleOver) return

    const settings = getBossBattleDifficultySettings(difficulty)
    const interval = setInterval(() => {
      setBattle((prev) => {
        if (!prev) return prev
        const before = prev.attackers[0].health
        const next = tickBattle(prev, SIM_INTERVAL_MS, settings)
        if (next.attackers[0].health < before) {
          setLastHitPlayer(true)
          playSound('incorrect', soundEnabled)
          window.setTimeout(() => setLastHitPlayer(false), 350)
        }
        return next
      })
    }, SIM_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [battle, difficulty, showQuestion, sessionState?.status, soundEnabled])

  useEffect(() => {
    if (battle?.victory && !showVictorySequence) {
      setShowVictorySequence(true)
      playSound('complete', soundEnabled)
    }
  }, [battle?.victory, showVictorySequence, soundEnabled])

  useEffect(() => {
    if (!battle || !sessionState || sessionState.status !== 'ACTIVE' || !sessionState.question) return
    if (battle.battleOver || showQuestion) return
    setShowQuestion(true)
  }, [battle, sessionState, showQuestion])

  function handleStart(chosenBossId: BossId, chosenDifficulty: BossBattleDifficulty) {
    setBossId(chosenBossId)
    setDifficulty(chosenDifficulty)
    setBattle(createInitialBattle(chosenBossId, getBossBattleDifficultySettings(chosenDifficulty)))
  }

  function handleAnswerResult(res: { correct: boolean }) {
    setShowQuestion(false)
    setBattle((prev) => {
      if (!prev || !difficulty) return prev
      const settings = getBossBattleDifficultySettings(difficulty)
      if (res.correct) {
        setLastHitBoss(true)
        playSound('correct', soundEnabled)
        window.setTimeout(() => setLastHitBoss(false), 350)
        return applyCorrectAnswerDamage(prev, PLAYER_ATTACKER_ID, settings)
      }
      setLastHitPlayer(true)
      window.setTimeout(() => setLastHitPlayer(false), 350)
      return applyWrongAnswerConsequence(prev, PLAYER_ATTACKER_ID, settings)
    })
    poll()
  }

  function handleUseAbility(abilityId: AbilityId) {
    setBattle((prev) => {
      if (!prev) return prev
      const next = activateAbility(prev, PLAYER_ATTACKER_ID, abilityId)
      if (next.bossHealth < prev.bossHealth) {
        setLastHitBoss(true)
        window.setTimeout(() => setLastHitBoss(false), 350)
      }
      return next
    })
  }

  async function handleTogglePause() {
    await togglePause()
  }

  async function handleExit() {
    await exit(onExit)
  }

  function handleRestart() {
    setBossId(null)
    setDifficulty(null)
    setBattle(null)
    setShowVictorySequence(false)
  }

  if (!bossId || !difficulty) {
    return <BossSetupPicker onStart={handleStart} />
  }

  if (error && !sessionState) return <GameV2Error description={error} onRetry={poll} />
  if (!sessionState || !battle) return <GameV2Loading label="Entering the arena..." />
  if (result) return <GameResultsScreen result={result} onPlayAgain={onPlayAgain} onExit={onExit} />

  if (showVictorySequence) {
    return <VictorySequence boss={battle.boss} onContinue={() => setShowVictorySequence(false)} />
  }

  const battleStillInPlay = !battle.battleOver
  if (sessionState.status === 'COMPLETED' && !battleStillInPlay) return <GameV2Loading label="Calculating your results..." />

  if (battle.battleOver && !battle.victory) {
    return (
      <GameV2Card padding="lg" className="max-w-lg w-full mx-auto text-center">
        <div className="text-5xl mb-2" aria-hidden>
          {'\u{1F480}'}
        </div>
        <h2 className="text-2xl font-extrabold text-gamev2ink-900 dark:text-white">Defeated...</h2>
        <p className="mt-2 text-sm text-gamev2ink-500 dark:text-gamev2ink-400">
          {battle.boss.name} proved too strong this time. Answer more questions correctly to land bigger hits next attempt.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <GameV2Button variant="spark" fullWidth onClick={handleRestart}>
            Try Again
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

      <BossArena state={battle} lastHitBoss={lastHitBoss} lastHitPlayer={lastHitPlayer} onUseAbility={handleUseAbility} />

      {battle.victory && !showVictorySequence && (
        <GameV2Card padding="md" className="w-full text-center">
          <p className="font-extrabold text-gamev2mint-600 dark:text-gamev2mint-400">
            {'\u{1F3C6}'} Boss defeated! Finish any remaining questions to see your full results.
          </p>
        </GameV2Card>
      )}

      {sessionState.status === 'PAUSED' && (
        <GameV2Card padding="md" className="w-full text-center">
          <p className="font-extrabold text-gamev2ink-800 dark:text-white">Battle Paused</p>
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
// COOPERATIVE MULTIPLAYER -- Live Classroom mode.
// ============================================================
function CoopBossBattleGame({
  sessionId,
  onExit,
  liveSessionId,
  myParticipantId,
  fixedBossId,
  fixedDifficulty,
}: {
  sessionId: string
  onExit: () => void
  liveSessionId: string
  myParticipantId: string
  fixedBossId?: BossId
  fixedDifficulty?: BossBattleDifficulty
}) {
  const [ready, setReady] = useState(false)
  const [liveBattle, setLiveBattle] = useState<LiveBossBattleResponse | null>(null)
  const [showQuestion, setShowQuestion] = useState(false)
  const [lastHitBoss, setLastHitBoss] = useState(false)
  const [teamAttackNotice, setTeamAttackNotice] = useState<string | null>(null)
  const [showVictorySequence, setShowVictorySequence] = useState(false)
  const { soundEnabled } = useSoundPreference()
  const victorySoundPlayed = useRef(false)
  const lastAnsweredIndexRef = useRef(-1)
  const lastTeamAttackDamageRef = useRef<Record<string, number>>({})
  const { state: sessionState, error, result, poll, togglePause, exit } = useGameSessionState<StatePayload>({
    sessionId,
    enabled: ready,
    soundEnabled,
  })

  // Polls the server-authoritative cooperative battle view (shared boss
  // HP, every participant's contribution) at a coarse,
  // human-perceptible cadence. Never runs while a question overlay is
  // open, and keeps running after victory so the final contribution
  // list stays current for the results screen.
  useEffect(() => {
    if (!ready || sessionState?.status === 'PAUSED') return

    let cancelled = false
    async function poll() {
      const res = await fetch(`/api/gameroom-v2/live/${liveSessionId}/boss-battle`)
      const data = await res.json().catch(() => null)
      if (!cancelled && res.ok && data) {
        setLiveBattle((prev) => {
          // Detect a NEW team-attack bonus on ANY participant (their
          // damageDealt jumped by more than their own correctCount *
          // baseDamage alone would explain) to trigger the celebratory
          // banner -- compared per-participant against the last poll's
          // own damage, not derived from anything client-simulated.
          if (prev) {
            for (const c of data.contributions as CoopContribution[]) {
              const prevDamage = lastTeamAttackDamageRef.current[c.participantId] ?? 0
              const prevContribution = prev.contributions.find((p) => p.participantId === c.participantId)
              if (prevContribution && c.damageDealt > prevDamage && streakCrossedNewThreshold(prevContribution.bestStreak, c.bestStreak)) {
                setTeamAttackNotice(c.nickname)
              }
              lastTeamAttackDamageRef.current[c.participantId] = c.damageDealt
            }
          }
          if (data.bossHealth < (prev?.bossHealth ?? Infinity)) {
            setLastHitBoss(true)
            window.setTimeout(() => setLastHitBoss(false), 350)
          }
          return data
        })
      }
    }
    poll()
    const interval = setInterval(poll, LIVE_POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [ready, liveSessionId, sessionState?.status])

  useEffect(() => {
    if (liveBattle?.victory && !victorySoundPlayed.current) {
      victorySoundPlayed.current = true
      setShowVictorySequence(true)
      playSound('complete', soundEnabled)
    }
  }, [liveBattle?.victory, soundEnabled])

  // Same question-opportunity gate as solo Boss Battle, keyed off the
  // session's own currentIndex so a poll landing mid-answer never
  // reopens a question already answered.
  useEffect(() => {
    if (!ready || !sessionState || sessionState.status !== 'ACTIVE' || !sessionState.question) return
    if (sessionState.currentIndex <= lastAnsweredIndexRef.current) return
    if (showQuestion) return
    setShowQuestion(true)
  }, [ready, sessionState, showQuestion])

  function handleReady(chosenTheme: BossId, chosenDifficulty: BossBattleDifficulty) {
    void chosenTheme
    void chosenDifficulty
    setReady(true)
  }

  function handleAnswerResult(res: { correct: boolean }) {
    lastAnsweredIndexRef.current = sessionState?.currentIndex ?? lastAnsweredIndexRef.current
    setShowQuestion(false)
    if (res.correct) playSound('correct', soundEnabled)
    // The server already recorded the answer and will reflect its
    // damage on the NEXT /boss-battle poll -- this client never
    // predicts or locally applies boss damage, and a wrong answer has
    // NO local effect to apply at all (no hit-flash, no penalty) --
    // there is nothing to show, by design.
    poll()
  }

  async function handleTogglePause() {
    await togglePause()
  }

  async function handleExit() {
    await exit(onExit)
  }

  if (!ready || !fixedBossId || !fixedDifficulty) {
    return <BossSetupPicker onStart={handleReady} />
  }

  if (error && !sessionState) return <GameV2Error description={error} onRetry={poll} />
  if (!sessionState || !liveBattle) return <GameV2Loading label="Entering the arena..." />

  // END CONDITION: the battle ends when EITHER the class defeats the
  // boss (liveBattle.victory, server-computed) OR this participant's
  // own session leaves ACTIVE/PAUSED for any reason -- COMPLETED
  // (answered every question in the set) or ABANDONED (the host ended
  // the live session; sms_gamev2_end_live_session marks every still-
  // in-progress participant session ABANDONED, never COMPLETED, and an
  // ABANDONED session never calls /complete, so `result` alone can
  // never be the only signal). Both non-victory paths render the SAME
  // neutral CoopResultsScreen (victory=false) -- there is no separate
  // "you lost" branch, by design. Once this participant's OWN /complete
  // call resolves (only possible for a genuinely COMPLETED session,
  // matching every other engine's existing precedent), the standard
  // GameResultsScreen naturally takes over to show this student's
  // personal XP/coins earned -- CoopResultsScreen is the cooperative
  // interim/ABANDONED-case summary, GameResultsScreen is still the
  // final individual rewards screen every engine shares.
  const battleConcluded = isCoopBattleConcluded(liveBattle.victory, sessionState.status)

  if (result) return <GameResultsScreen result={result} onPlayAgain={undefined} onExit={onExit} />

  if (showVictorySequence) {
    return <VictorySequence boss={getBoss(fixedBossId)} onContinue={() => setShowVictorySequence(false)} />
  }

  if (battleConcluded) {
    return (
      <CoopResultsScreen
        victory={liveBattle.victory}
        bossName={liveBattle.boss.name}
        totalDamageDealt={liveBattle.totalDamageDealt}
        bossMaxHealth={liveBattle.bossMaxHealth}
        contributions={liveBattle.contributions}
        myParticipantId={myParticipantId}
        onContinue={handleExit}
      />
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

      <CoopArena battle={liveBattle} myParticipantId={myParticipantId} lastHitBoss={lastHitBoss} />

      <AnimatePresence mode="wait">
        {teamAttackNotice && <TeamAttackBanner key={teamAttackNotice} nickname={teamAttackNotice} onResolved={() => setTeamAttackNotice(null)} />}
      </AnimatePresence>

      {sessionState.status === 'PAUSED' && (
        <GameV2Card padding="md" className="w-full text-center">
          <p className="font-extrabold text-gamev2ink-800 dark:text-white">Battle Paused</p>
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

// Whether crossing from prevBestStreak to nextBestStreak passed a new
// team-attack threshold multiple -- a pure local helper (not exported,
// not needing its own test file) purely for deciding when to flash the
// celebratory banner client-side; imports the SAME threshold constant
// coopBattle.ts's own streakTeamAttacksTriggered uses, so the banner's
// trigger point can never drift from the actual damage math.
function streakCrossedNewThreshold(prevBestStreak: number, nextBestStreak: number): boolean {
  return Math.floor(nextBestStreak / STREAK_TEAM_ATTACK_THRESHOLD) > Math.floor(prevBestStreak / STREAK_TEAM_ATTACK_THRESHOLD)
}
