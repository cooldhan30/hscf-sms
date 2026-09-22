'use client'

import { motion } from 'framer-motion'
import { useGameV2Motion } from '@/components/gameRoomV2'
import { getRaceTheme, type RaceState, type RaceThemeId } from '@/lib/gameRoomV2/racing'

// The race track: one horizontal lane per racer, each racer's emoji
// positioned by its distance-to-trackLength ratio. Theme controls only
// colors/emoji -- the lane layout and physics are identical across
// every theme.
export function Track({ state, themeId }: { state: RaceState; themeId: RaceThemeId }) {
  const theme = getRaceTheme(themeId)
  const { reduced } = useGameV2Motion()

  return (
    <div className={`w-full rounded-3xl overflow-hidden border-2 border-gamev2ink-100 dark:border-gamev2ink-800 bg-gradient-to-r ${theme.trackGradientClass} p-4 sm:p-6`}>
      <div className="space-y-4">
        {state.racers.map((racer) => {
          const pct = Math.min(100, (racer.distance / state.trackLength) * 100)
          return (
            <div key={racer.id}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-extrabold ${racer.isPlayer ? 'text-gamev2ink-900 dark:text-white' : 'text-gamev2ink-500 dark:text-gamev2ink-400'}`}>
                  {racer.label}
                </span>
                {racer.effect && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      racer.effect.kind === 'boost'
                        ? 'bg-gamev2mint-100 dark:bg-gamev2mint-500/20 text-gamev2mint-700 dark:text-gamev2mint-300'
                        : 'bg-gamev2coral-100 dark:bg-gamev2coral-500/20 text-gamev2coral-700 dark:text-gamev2coral-300'
                    }`}
                  >
                    {racer.effect.kind === 'boost' ? 'Boost!' : 'Slowed'}
                  </span>
                )}
              </div>
              <div className="relative h-9 sm:h-10 rounded-full bg-white/50 dark:bg-gamev2ink-900/50 overflow-hidden">
                <svg className={`absolute inset-0 w-full h-full ${theme.trackAccentClass}`} preserveAspectRatio="none" viewBox="0 0 100 10">
                  <line x1="0" y1="5" x2="100" y2="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
                </svg>
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2 text-xl sm:text-2xl"
                  style={{ left: 0 }}
                  animate={{ left: `calc(${pct}% - ${pct > 90 ? '24px' : '0px'})` }}
                  transition={reduced ? { duration: 0 } : { type: 'tween', ease: 'linear', duration: 0.1 }}
                  aria-hidden
                >
                  {theme.racerEmoji}
                </motion.div>
                <div className="absolute right-1 top-1/2 -translate-y-1/2 text-lg" aria-hidden>
                  {theme.finishEmoji}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
