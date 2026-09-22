'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useGameV2Motion } from '@/components/gameRoomV2'
import {
  PATH_WAYPOINTS,
  TOWER_PADS,
  positionAtDistance,
  getTowerType,
  type BattlefieldState,
  type ImpactEvent,
  type TowerTypeId,
} from '@/lib/gameRoomV2/towerDefense'

const GRID_W = 10
const GRID_H = 6

function toPercent(x: number, y: number) {
  return { left: `${(x / GRID_W) * 100}%`, top: `${(y / GRID_H) * 100}%` }
}

const ENEMY_EMOJI: Record<string, string> = {
  runner: '\u{1F47E}',
  brute: '\u{1F9CC}',
  shade: '\u{1F47B}',
}

const TOWER_EMOJI: Record<TowerTypeId, string> = {
  vel: '\u{1F531}',
  yanai: '\u{1F418}',
  pani: '❄️',
}

export function Battlefield({
  state,
  impacts,
  selectedPadId,
  onSelectPad,
}: {
  state: BattlefieldState
  impacts: ImpactEvent[]
  selectedPadId: string | null
  onSelectPad: (padId: string) => void
}) {
  const { reduced } = useGameV2Motion()

  const pathPoints = PATH_WAYPOINTS.map((p) => `${(p.x / GRID_W) * 100},${(p.y / GRID_H) * 100}`).join(' ')

  return (
    <div className="relative w-full aspect-[10/6] rounded-3xl overflow-hidden border-2 border-gamev2ink-100 dark:border-gamev2ink-800 bg-gradient-to-b from-gamev2mint-100 to-gamev2mint-200 dark:from-gamev2ink-800 dark:to-gamev2ink-900">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points={pathPoints} fill="none" stroke="currentColor" strokeWidth="6" className="text-amber-200 dark:text-gamev2ink-700" strokeLinejoin="round" />
        <polyline points={pathPoints} fill="none" stroke="currentColor" strokeWidth="3.5" className="text-amber-400/70 dark:text-gamev2ink-600" strokeLinejoin="round" strokeDasharray="2 3" />
      </svg>

      {/* Base / goal */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gamev2coral-500 text-white text-xl sm:text-2xl shadow-lg z-10"
        style={toPercent(PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1].x, PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1].y)}
        aria-label="Your fort"
        title="Your fort"
      >
        {'\u{1F3EF}'}
      </div>

      {/* Tower pads */}
      {TOWER_PADS.map((pad) => {
        const tower = state.towers.find((t) => t.padId === pad.id)
        const selected = selectedPadId === pad.id
        return (
          <button
            key={pad.id}
            onClick={() => onSelectPad(pad.id)}
            style={toPercent(pad.x, pad.y)}
            className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full border-2 transition-colors z-10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gamev2spark-400 ${
              tower
                ? 'bg-gamev2ink-800 dark:bg-gamev2ink-700 border-gamev2ink-900 dark:border-gamev2ink-600'
                : selected
                  ? 'bg-gamev2spark-200 dark:bg-gamev2spark-500/30 border-gamev2spark-500 animate-pulse'
                  : 'bg-white/70 dark:bg-gamev2ink-800/70 border-dashed border-gamev2ink-400 dark:border-gamev2ink-500 hover:border-gamev2spark-400'
            }`}
            aria-label={tower ? `${getTowerType(tower.typeId).name}, level ${tower.level}` : 'Empty tower pad'}
          >
            {tower ? (
              <span className="text-lg sm:text-xl" aria-hidden>
                {TOWER_EMOJI[tower.typeId]}
                {tower.level > 1 && <span className="ml-0.5 text-[9px] font-black text-gamev2spark-300 align-top">{tower.level}</span>}
              </span>
            ) : (
              <span className="text-gamev2ink-400 dark:text-gamev2ink-500 text-xs" aria-hidden>
                +
              </span>
            )}
          </button>
        )
      })}

      {/* Enemies */}
      <AnimatePresence>
        {state.enemies.map((e) => {
          const pos = positionAtDistance(e.distance)
          const pct = e.health / e.maxHealth
          return (
            <motion.div
              key={e.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
              style={toPercent(pos.x, pos.y)}
              initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
              transition={reduced ? { duration: 0 } : { duration: 0.15 }}
            >
              <div className="text-lg sm:text-xl leading-none text-center" aria-hidden>
                {ENEMY_EMOJI[e.kind] ?? '\u{1F47E}'}
              </div>
              <div className="w-6 sm:w-7 h-1 rounded-full bg-black/20 mt-0.5 overflow-hidden">
                <div
                  className={`h-full ${pct > 0.5 ? 'bg-gamev2mint-500' : pct > 0.25 ? 'bg-gamev2spark-500' : 'bg-gamev2coral-500'}`}
                  style={{ width: `${Math.max(0, pct) * 100}%` }}
                />
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>

      {/* Impact flashes */}
      <AnimatePresence>
        {impacts.map((impact) => {
          const pad = TOWER_PADS.find((p) => p.id === impact.padId)
          const enemy = state.enemies.find((e) => e.id === impact.enemyId)
          const targetPos = enemy ? positionAtDistance(enemy.distance) : pad
          if (!targetPos) return null
          return (
            <motion.div
              key={impact.id}
              className={`absolute -translate-x-1/2 -translate-y-1/2 z-30 rounded-full ${impact.splash ? 'w-8 h-8 bg-gamev2coral-400/50' : 'w-3 h-3 bg-gamev2spark-400/80'}`}
              style={toPercent(targetPos.x, targetPos.y)}
              initial={{ opacity: 1, scale: 0.3 }}
              animate={{ opacity: 0, scale: 1.4 }}
              transition={reduced ? { duration: 0.01 } : { duration: 0.3 }}
            />
          )
        })}
      </AnimatePresence>
    </div>
  )
}
