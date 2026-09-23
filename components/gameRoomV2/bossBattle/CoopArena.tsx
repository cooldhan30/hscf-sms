'use client'

import { motion } from 'framer-motion'
import { useGameV2Motion } from '@/components/gameRoomV2'
import type { CoopContribution } from '@/lib/gameRoomV2/bossBattle'

const BOSS_EMOJI: Record<string, string> = { suran: '\u{1F479}', 'kotravai-guardian': '\u{1F9DE}', 'naga-serpent': '\u{1F40D}' }

// The exact shape GET /api/gameroom-v2/live/[id]/boss-battle returns --
// a narrower view than the internal CoopBattleState (its `boss` field
// only carries what the arena actually renders: id/name/tamilName/
// phase names, not the full BossDefinition), since this component only
// ever receives the API response directly, never the server-internal
// type.
export interface LiveCoopBattleView {
  boss: { id: string; name: string; tamilName: string; phases: { name: string; healthShare: number }[] }
  bossHealth: number
  bossMaxHealth: number
  bossPhaseIndex: number
  totalDamageDealt: number
  contributions: CoopContribution[]
}

// The cooperative battle arena: the SAME shared boss + segmented phase
// bar BossArena.tsx already renders (reused visual language, so
// switching between solo and Live Classroom Boss Battle still feels
// like the same game), but deliberately NO individual player health
// bar and no counterattack/hit-flash on the viewer -- there is nothing
// to flash, since a wrong answer here has no visible consequence at
// all. Instead: class-wide progress, the viewer's own contribution
// (never anyone else's wrong-answer count), and a leaderboard ranked
// purely by positive contribution.
export function CoopArena({
  battle,
  myParticipantId,
  lastHitBoss,
}: {
  battle: LiveCoopBattleView
  myParticipantId: string | null
  lastHitBoss: boolean
}) {
  const { reduced } = useGameV2Motion()
  const me = myParticipantId ? battle.contributions.find((c) => c.participantId === myParticipantId) : null

  return (
    <div className="w-full rounded-3xl border-2 border-gamev2ink-100 dark:border-gamev2ink-800 bg-white dark:bg-gamev2ink-900 p-4 sm:p-6 space-y-5">
      {/* Boss -- identical visual language to solo BossArena.tsx */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-extrabold text-sm text-gamev2ink-900 dark:text-white">{battle.boss.name}</span>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gamev2coral-100 dark:bg-gamev2coral-500/20 text-gamev2coral-700 dark:text-gamev2coral-300">
            {battle.boss.phases[battle.bossPhaseIndex]?.name}
          </span>
        </div>
        <motion.div
          className="text-4xl sm:text-5xl text-center mb-2"
          animate={lastHitBoss && !reduced ? { x: [0, -6, 6, -4, 4, 0] } : {}}
          transition={{ duration: 0.35 }}
          aria-hidden
        >
          {BOSS_EMOJI[battle.boss.id] ?? '\u{1F479}'}
        </motion.div>
        <div className="flex gap-1 h-4 rounded-full overflow-hidden bg-gamev2ink-100 dark:bg-gamev2ink-800">
          {battle.boss.phases.map((phase, i) => {
            const segStart = battle.boss.phases.slice(0, i).reduce((s, p) => s + p.healthShare, 0)
            const segEnd = segStart + phase.healthShare
            const currentFraction = battle.bossHealth / battle.bossMaxHealth
            const filledWithinSegment = Math.max(0, Math.min(1, (currentFraction - segStart) / phase.healthShare))
            return (
              <div key={i} style={{ width: `${phase.healthShare * 100}%` }} className="relative h-full bg-gamev2ink-200 dark:bg-gamev2ink-700">
                <div
                  className={`absolute inset-y-0 right-0 ${i === battle.bossPhaseIndex ? 'bg-gamev2coral-500' : segEnd <= currentFraction ? 'bg-gamev2coral-300' : 'bg-transparent'}`}
                  style={{ width: `${filledWithinSegment * 100}%` }}
                />
              </div>
            )
          })}
        </div>
        <p className="text-[11px] text-gamev2ink-400 dark:text-gamev2ink-500 mt-1 text-right tabular-nums">
          {Math.max(0, battle.bossHealth)} / {battle.bossMaxHealth} HP
        </p>
      </div>

      {/* Class progress -- the "class progress" / "team progress"
          requirement, framed as the whole class's shared achievement,
          never any one student's. */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-extrabold text-sm text-gamev2ink-900 dark:text-white">Class Progress</span>
          <span className="text-xs font-bold text-gamev2spark-600 dark:text-gamev2spark-400 tabular-nums">
            {Math.round((battle.totalDamageDealt / battle.bossMaxHealth) * 100)}%
          </span>
        </div>
        <div className="h-3 rounded-full bg-gamev2ink-100 dark:bg-gamev2ink-800 overflow-hidden">
          <div
            className="h-full bg-gamev2mint-500 transition-[width] duration-500"
            style={{ width: `${Math.min(100, (battle.totalDamageDealt / battle.bossMaxHealth) * 100)}%` }}
          />
        </div>
      </div>

      {/* My contribution -- shown only to a participant (myParticipantId
          set), never on the teacher's own overview, where "my
          contribution" has no meaning. */}
      {me && (
        <div className="rounded-2xl bg-gamev2spark-50 dark:bg-gamev2spark-500/10 border-2 border-gamev2spark-200 dark:border-gamev2spark-700 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-gamev2spark-600 dark:text-gamev2spark-400 mb-1">Your Contribution</p>
          <div className="flex items-center justify-between">
            <span className="text-sm font-extrabold text-gamev2ink-900 dark:text-white">{me.damageDealt} damage dealt</span>
            {me.currentStreak > 1 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gamev2coral-100 dark:bg-gamev2coral-500/20 text-gamev2coral-700 dark:text-gamev2coral-300">
                {'\u{1F525}'} {me.currentStreak} streak
              </span>
            )}
          </div>
        </div>
      )}

      {/* Class leaderboard -- ranked purely by positive contribution,
          never by anything wrong-answer-derived (see
          coopBattle.ts's rankCoopContributions and its own header
          comment). */}
      {battle.contributions.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gamev2ink-400 dark:text-gamev2ink-500 mb-2">Top Contributors</p>
          <ul className="space-y-1.5">
            {battle.contributions.slice(0, 5).map((c, i) => (
              <li
                key={c.participantId}
                className={`flex items-center justify-between rounded-xl px-3 py-1.5 ${
                  c.participantId === myParticipantId ? 'bg-gamev2spark-50 dark:bg-gamev2spark-500/10 border border-gamev2spark-300 dark:border-gamev2spark-600' : 'bg-gamev2ink-50 dark:bg-gamev2ink-800/50'
                }`}
              >
                <span className="text-xs font-bold text-gamev2ink-800 dark:text-gamev2ink-100">
                  #{i + 1} {c.nickname}
                  {c.participantId === myParticipantId && <span className="text-[10px] text-gamev2spark-600 dark:text-gamev2spark-400"> (You)</span>}
                </span>
                <span className="text-xs font-bold text-gamev2spark-600 dark:text-gamev2spark-400 tabular-nums">{c.damageDealt} dmg</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
