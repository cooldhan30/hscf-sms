'use client'

import { motion } from 'framer-motion'
import { useGameV2Motion } from '@/components/gameRoomV2'
import { MISSION_ROUTE, MISSION_LENGTH, type FlightState } from '@/lib/gameRoomV2/spaceMission'

// Deterministic starfield -- a fixed set of pseudo-random positions
// generated once from a seeded sequence (not Math.random() per render,
// which would make the sky visibly "jump" on every re-render/state
// update). Purely decorative background, aria-hidden.
function generateStars(count: number) {
  const stars: { x: number; y: number; size: number; delay: number }[] = []
  let seed = 42
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return (seed % 1000) / 1000
  }
  for (let i = 0; i < count; i++) {
    stars.push({ x: next() * 100, y: next() * 100, size: next() > 0.85 ? 2 : 1, delay: next() * 3 })
  }
  return stars
}

const STARS = generateStars(60)

// The mission's defining visual: a vertical flight path through a
// starfield, planets fixed at their route distance, and the ship
// climbing toward the top as distance increases -- deliberately a
// different spatial metaphor than Racing's horizontal lanes or
// Treasure Quest's room grid, so Space Mission reads as its own game
// rather than a reskin.
export function MissionPath({ state }: { state: FlightState }) {
  const { reduced } = useGameV2Motion()
  const shipPct = Math.min(100, (state.distanceTravelled / MISSION_LENGTH) * 100)
  const shieldPct = Math.max(0, Math.round((state.shields / state.maxShields) * 100))

  return (
    <div className="w-full rounded-3xl overflow-hidden border-2 border-gamev2ink-800 bg-gradient-to-b from-[#0b1026] via-[#141a3d] to-[#1d2456] relative">
      {/* Starfield */}
      <div className="absolute inset-0" aria-hidden>
        {STARS.map((star, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white"
            style={{ left: `${star.x}%`, top: `${star.y}%`, width: star.size, height: star.size }}
            animate={reduced ? undefined : { opacity: [0.3, 1, 0.3] }}
            transition={reduced ? undefined : { duration: 2.5, repeat: Infinity, delay: star.delay, ease: 'easeInOut' }}
          />
        ))}
      </div>

      <div className="relative h-72 sm:h-80 px-6 sm:px-10 py-6">
        {/* The flight path itself -- a vertical dashed line from launch
            (bottom) to home system (top), matching the route's
            distance-ordered planets. */}
        <div className="absolute left-1/2 top-6 bottom-6 w-px -translate-x-1/2 border-l-2 border-dashed border-white/20" aria-hidden />

        {MISSION_ROUTE.map((planet) => {
          const pct = (planet.distance / MISSION_LENGTH) * 100
          const arrived = state.arrivedPlanetIds.includes(planet.id)
          return (
            <div
              key={planet.id}
              className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
              style={{ bottom: `${pct}%`, transform: 'translate(-50%, 50%)' }}
            >
              <span className={`text-2xl sm:text-3xl transition-opacity ${arrived ? 'opacity-100' : 'opacity-40'}`} aria-hidden>
                {planet.emoji}
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                  arrived ? 'bg-gamev2mint-500/20 text-gamev2mint-300' : 'bg-white/10 text-white/50'
                }`}
              >
                {planet.name}
              </span>
            </div>
          )
        })}

        {/* The ship -- climbs the path as distance increases, with a
            gentle idle bob (skipped under reduced motion) and a visible
            shield-flicker cue when shields are fully depleted, never a
            game-over state. */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 text-3xl sm:text-4xl z-10"
          style={{ bottom: 0 }}
          animate={{
            bottom: `${shipPct}%`,
            y: reduced ? 0 : [0, -4, 0],
            opacity: state.recovering && !reduced ? [1, 0.4, 1] : 1,
          }}
          transition={
            reduced
              ? { duration: 0.15 }
              : {
                  bottom: { type: 'spring', stiffness: 90, damping: 16 },
                  y: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
                  opacity: { duration: 0.5, repeat: state.recovering ? 2 : 0 },
                }
          }
          aria-hidden
        >
          {shieldPct === 0 ? '\u{1F6F8}\u{FE0F}' : '\u{1F6F8}'}
        </motion.div>
      </div>

      {/* Shield gauge -- the visible fuel/shields resource the spec
          calls for, distinct from the shared HUD's question timer. */}
      <div className="relative px-4 sm:px-6 pb-4" role="group" aria-label={`Shields ${shieldPct} percent`}>
        <div className="flex items-center justify-between text-[11px] font-bold text-white/70 mb-1">
          <span>Shields</span>
          <span>{shieldPct}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${shieldPct > 40 ? 'bg-gamev2mint-400' : shieldPct > 15 ? 'bg-gamev2spark-400' : 'bg-gamev2coral-500'}`}
            animate={{ width: `${shieldPct}%` }}
            transition={reduced ? { duration: 0 } : { type: 'tween', duration: 0.4 }}
          />
        </div>
      </div>
    </div>
  )
}
