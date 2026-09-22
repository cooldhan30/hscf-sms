'use client'

import { motion } from 'framer-motion'
import { useGameV2Motion } from '@/components/gameRoomV2'
import { ABILITIES, canUseAbility, type BattleState, type AbilityId } from '@/lib/gameRoomV2/bossBattle'

const BOSS_EMOJI: Record<string, string> = { suran: '\u{1F479}', 'kotravai-guardian': '\u{1F9DE}', 'naga-serpent': '\u{1F40D}' }
const ABILITY_EMOJI: Record<AbilityId, string> = { 'heavy-strike': '\u{1F4A5}', shield: '\u{1F6E1}️', focus: '✨' }

// The battle arena: boss portrait + segmented phase/health bar, player
// health + charge, hit-flash feedback, and the ability bar. Segmenting
// the boss's health bar by phase (rather than one continuous bar) is
// what makes "boss phases" visually legible, not just a number ticking
// down.
export function BossArena({
  state,
  lastHitBoss,
  lastHitPlayer,
  onUseAbility,
}: {
  state: BattleState
  lastHitBoss: boolean
  lastHitPlayer: boolean
  onUseAbility: (id: AbilityId) => void
}) {
  const { reduced } = useGameV2Motion()
  const player = state.attackers[0]

  return (
    <div className="w-full rounded-3xl border-2 border-gamev2ink-100 dark:border-gamev2ink-800 bg-white dark:bg-gamev2ink-900 p-4 sm:p-6 space-y-5">
      {/* Boss */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-extrabold text-sm text-gamev2ink-900 dark:text-white">{state.boss.name}</span>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gamev2coral-100 dark:bg-gamev2coral-500/20 text-gamev2coral-700 dark:text-gamev2coral-300">
            {state.boss.phases[state.bossPhaseIndex].name}
          </span>
        </div>
        <motion.div
          className="text-4xl sm:text-5xl text-center mb-2"
          animate={lastHitBoss && !reduced ? { x: [0, -6, 6, -4, 4, 0] } : {}}
          transition={{ duration: 0.35 }}
          aria-hidden
        >
          {BOSS_EMOJI[state.boss.id] ?? '\u{1F479}'}
        </motion.div>
        {/* Segmented phase bar -- one visual segment per phase, in
            reverse (leftmost segment = final phase), so a phase
            transition is visibly "entering a new colored zone" rather
            than just a number changing. */}
        <div className="flex gap-1 h-4 rounded-full overflow-hidden bg-gamev2ink-100 dark:bg-gamev2ink-800">
          {state.boss.phases.map((phase, i) => {
            const segStart = state.boss.phases.slice(0, i).reduce((s, p) => s + p.healthShare, 0)
            const segEnd = segStart + phase.healthShare
            const currentFraction = state.bossHealth / state.bossMaxHealth
            const filledWithinSegment = Math.max(0, Math.min(1, (currentFraction - segStart) / phase.healthShare))
            return (
              <div key={i} style={{ width: `${phase.healthShare * 100}%` }} className="relative h-full bg-gamev2ink-200 dark:bg-gamev2ink-700">
                <div
                  className={`absolute inset-y-0 right-0 ${i === state.bossPhaseIndex ? 'bg-gamev2coral-500' : segEnd <= currentFraction ? 'bg-gamev2coral-300' : 'bg-transparent'}`}
                  style={{ width: `${filledWithinSegment * 100}%` }}
                />
              </div>
            )
          })}
        </div>
        <p className="text-[11px] text-gamev2ink-400 dark:text-gamev2ink-500 mt-1 text-right tabular-nums">
          {Math.max(0, state.bossHealth)} / {state.bossMaxHealth} HP
        </p>
      </div>

      {/* Player */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-extrabold text-sm text-gamev2ink-900 dark:text-white">{player.label}</span>
          {player.shieldCharges > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gamev2cyan-100 dark:bg-gamev2cyan-500/20 text-gamev2cyan-700 dark:text-gamev2cyan-300">
              {'\u{1F6E1}️'} Shielded
            </span>
          )}
          {player.focusMultiplier && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gamev2magenta-100 dark:bg-gamev2magenta-500/20 text-gamev2magenta-700 dark:text-gamev2magenta-300">
              {'✨'} Focused
            </span>
          )}
        </div>
        <motion.div
          className="h-3 rounded-full bg-gamev2ink-100 dark:bg-gamev2ink-800 overflow-hidden"
          animate={lastHitPlayer && !reduced ? { x: [0, -4, 4, -2, 2, 0] } : {}}
          transition={{ duration: 0.3 }}
        >
          <div className="h-full bg-gamev2mint-500 transition-[width] duration-300" style={{ width: `${Math.max(0, (player.health / player.maxHealth) * 100)}%` }} />
        </motion.div>
        <p className="text-[11px] text-gamev2ink-400 dark:text-gamev2ink-500 mt-1 tabular-nums">
          {Math.max(0, player.health)} / {player.maxHealth} HP
        </p>

        <div className="mt-2 h-2.5 rounded-full bg-gamev2ink-100 dark:bg-gamev2ink-800 overflow-hidden">
          <div className="h-full bg-gamev2spark-500 transition-[width] duration-300" style={{ width: `${(player.charge / player.maxCharge) * 100}%` }} />
        </div>
        <p className="text-[11px] text-gamev2spark-600 dark:text-gamev2spark-400 mt-1 font-bold tabular-nums">{player.charge} charge</p>
      </div>

      {/* Abilities */}
      <div className="grid grid-cols-3 gap-2">
        {ABILITIES.map((ability) => {
          const affordable = canUseAbility(state, player.id, ability.id)
          return (
            <button
              key={ability.id}
              onClick={() => onUseAbility(ability.id)}
              disabled={!affordable || state.battleOver}
              title={ability.description}
              className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-2 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gamev2spark-400 disabled:opacity-40 ${
                affordable ? 'border-gamev2spark-400 bg-gamev2spark-50 dark:bg-gamev2spark-500/10' : 'border-gamev2ink-100 dark:border-gamev2ink-800'
              }`}
            >
              <span className="text-xl" aria-hidden>
                {ABILITY_EMOJI[ability.id]}
              </span>
              <span className="text-[11px] font-bold text-gamev2ink-800 dark:text-gamev2ink-100 leading-tight text-center">{ability.tamilName}</span>
              <span className="text-[10px] font-semibold text-gamev2spark-600 dark:text-gamev2spark-400">{ability.chargeCost}⚡</span>
            </button>
          )
        })}
      </div>

    </div>
  )
}
