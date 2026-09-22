'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useGameV2Motion } from '@/components/gameRoomV2'
import { BUILD_ORDER, type KingdomState, type StreakUpgradeTier } from '@/lib/gameRoomV2/kingdomBuilder'

// Fixed plot positions for each building, laid out as a small
// settlement growing outward from the center rather than a strict
// grid -- purely CSS percentage positioning over an SVG/gradient
// ground, no image assets. Order matches BUILD_ORDER so earlier
// buildings sit closer to the middle of the scene and later ones fill
// outward, reading as organic growth.
const PLOT_POSITIONS: Record<string, { left: string; top: string; size: string }> = {
  house: { left: '30%', top: '62%', size: 'text-4xl sm:text-5xl' },
  garden: { left: '72%', top: '68%', size: 'text-3xl sm:text-4xl' },
  farm: { left: '18%', top: '38%', size: 'text-3xl sm:text-4xl' },
  tower: { left: '80%', top: '32%', size: 'text-4xl sm:text-5xl' },
  pavilion: { left: '50%', top: '78%', size: 'text-3xl sm:text-4xl' },
  castle: { left: '50%', top: '30%', size: 'text-5xl sm:text-6xl' },
}

const TIER_GLOW_CLASS: Record<StreakUpgradeTier, string> = {
  0: '',
  1: 'drop-shadow-[0_0_6px_rgba(250,204,21,0.5)]',
  2: 'drop-shadow-[0_0_10px_rgba(250,204,21,0.7)]',
  3: 'drop-shadow-[0_0_16px_rgba(250,204,21,0.9)]',
}

// Deterministic decorative sparkle positions -- fixed, not
// re-randomized per render, so the scene doesn't visibly jitter on
// every state update. Purely decorative, aria-hidden.
function generateSparkles(count: number) {
  const sparkles: { x: number; y: number; delay: number }[] = []
  let seed = 7
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return (seed % 1000) / 1000
  }
  for (let i = 0; i < count; i++) sparkles.push({ x: next() * 100, y: next() * 55, delay: next() * 2 })
  return sparkles
}

const SPARKLES = generateSparkles(10)

// The kingdom's defining visual: an empty plot of land that visibly
// fills in with buildings, one at a time, as the session progresses --
// deliberately a different spatial metaphor than Space Mission's
// vertical flight path or Racing's lanes or Treasure Quest's room
// grid, so Kingdom Builder reads as its own game. Every building is a
// plain emoji + CSS glow, not an image asset, per the "avoid heavy
// image assets" requirement.
export function KingdomScene({ state, upgradeTier }: { state: KingdomState; upgradeTier: StreakUpgradeTier }) {
  const { reduced } = useGameV2Motion()

  return (
    <div className="w-full rounded-3xl overflow-hidden border-2 border-gamev2ink-100 dark:border-gamev2ink-800 bg-gradient-to-b from-sky-200 via-sky-100 to-emerald-200 dark:from-gamev2ink-900 dark:via-gamev2ink-800 dark:to-emerald-950 relative">
      {/* Sun/sky sparkle -- purely decorative ambience, intensifies
          subtly with the streak tier (skipped under reduced motion). */}
      {!reduced && upgradeTier > 0 && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          {SPARKLES.slice(0, upgradeTier * 3).map((s, i) => (
            <motion.div
              key={i}
              className="absolute text-sm sm:text-base"
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
              animate={{ opacity: [0, 1, 0], scale: [0.6, 1, 0.6] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }}
            >
              {'✨'}
            </motion.div>
          ))}
        </div>
      )}

      <div className="relative h-72 sm:h-80">
        {/* Ground -- a simple rolling hill silhouette via SVG, no image
            asset. */}
        <svg className="absolute bottom-0 left-0 w-full h-1/3 text-emerald-300 dark:text-emerald-900" preserveAspectRatio="none" viewBox="0 0 100 20" aria-hidden>
          <path d="M0 20 L0 8 Q25 2 50 8 T100 6 L100 20 Z" fill="currentColor" />
        </svg>

        {state.builtIds.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm font-bold text-gamev2ink-500 dark:text-gamev2ink-300 text-center px-6">
              {'\u{1F33F}'} An empty plot of land, waiting for its first building...
            </p>
          </div>
        )}

        <AnimatePresence>
          {BUILD_ORDER.filter((b) => state.builtIds.includes(b.id)).map((building) => {
            const pos = PLOT_POSITIONS[building.id]
            const justCompleted = state.justCompletedId === building.id
            return (
              <motion.div
                key={building.id}
                className={`absolute -translate-x-1/2 -translate-y-1/2 ${pos.size} ${TIER_GLOW_CLASS[upgradeTier]}`}
                style={{ left: pos.left, top: pos.top }}
                initial={reduced ? { opacity: 0 } : { scale: 0, opacity: 0, y: 20 }}
                animate={
                  justCompleted && !reduced
                    ? { scale: [0, 1.3, 1], opacity: 1, y: 0 }
                    : { scale: 1, opacity: 1, y: 0 }
                }
                transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 260, damping: 18 }}
                title={building.name}
              >
                <span aria-hidden>{building.emoji}</span>
                <span className="sr-only">{building.name} built</span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Progress caption -- what's built vs. what's next, keeping the
          scene legible even without color/animation. */}
      <div className="relative px-4 sm:px-6 py-3 bg-white/40 dark:bg-black/20 backdrop-blur-sm">
        <p className="text-xs font-bold text-gamev2ink-700 dark:text-gamev2ink-200 text-center">
          {state.builtIds.length} of {BUILD_ORDER.length} structures built
        </p>
      </div>
    </div>
  )
}
