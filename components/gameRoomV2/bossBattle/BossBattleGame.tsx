'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { GameV2Card, GameV2Button, GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { QuestionOverlay, type QuestionOverlayQuestion, GameResultsScreen, useSoundPreference, playSound, useGameSessionState } from '@/components/gameRoomV2/gameplay'
import { useManagedTimeouts } from '@/components/gameRoomV2/gameplay/useManagedTimeouts'
import { BossSetupPicker } from './BossSetupPicker'
import { BrawlGame } from './brawl/BrawlGame'
import { CoopArena } from './CoopArena'
import { TeamAttackBanner } from './TeamAttackBanner'
import { VictorySequence } from './VictorySequence'
import { CoopResultsScreen } from './CoopResultsScreen'
import {
  getBoss,
  STREAK_TEAM_ATTACK_THRESHOLD,
  isCoopBattleConcluded,
  type BossId,
  type BossBattleDifficulty,
  type CoopContribution,
} from '@/lib/gameRoomV2/bossBattle'

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
  onHome?: () => void
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
// the real-time arena brawler in brawl/BrawlGame.tsx
// (lib/gameRoomV2/bossBattle/brawl). Multiplayer mode (a
// liveSessionId is present) is a GENUINELY DIFFERENT, cooperative
// mechanic -- see lib/gameRoomV2/bossBattle/coopBattle.ts's header
// comment: no individual player health, no boss counterattack, no
// defeat state. A wrong answer has no visible consequence at all;
// every correct answer damages the one shared class-wide boss HP pool.
export function BossBattleGame({ sessionId, onExit, onPlayAgain, onHome, liveSessionId, myParticipantId, fixedBossId, fixedDifficulty }: BossBattleGameProps) {
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
  return <BrawlGame sessionId={sessionId} onExit={onExit} onPlayAgain={onPlayAgain} onHome={onHome} />
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
  // The poll effect below intentionally does NOT list soundEnabled in
  // its own dependency array -- restarting a live-classroom poll
  // interval every time a student toggles mute would be a real (if
  // small) functional regression, not just a lint nit. A ref gives the
  // effect's closure the CURRENT mute state without needing to be a
  // dependency.
  const soundEnabledRef = useRef(soundEnabled)
  soundEnabledRef.current = soundEnabled
  const scheduleTimeout = useManagedTimeouts()
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
                playSound('achievement', soundEnabledRef.current)
              }
              lastTeamAttackDamageRef.current[c.participantId] = c.damageDealt
            }
          }
          if (data.bossHealth < (prev?.bossHealth ?? Infinity)) {
            setLastHitBoss(true)
            scheduleTimeout(() => setLastHitBoss(false), 350)
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
  }, [ready, liveSessionId, sessionState?.status, scheduleTimeout])

  useEffect(() => {
    if (liveBattle?.victory && !victorySoundPlayed.current) {
      victorySoundPlayed.current = true
      setShowVictorySequence(true)
      playSound('victory', soundEnabled)
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
    void res
    lastAnsweredIndexRef.current = sessionState?.currentIndex ?? lastAnsweredIndexRef.current
    setShowQuestion(false)
    // QuestionOverlay already played correct/incorrect the moment the
    // server responded, just before calling this callback -- no second
    // audio cue needed here.
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
