'use client'

import { motion } from 'framer-motion'
import { useGameV2Motion } from '@/components/gameRoomV2'
import { getRaceTheme, type RaceState, type RaceThemeId } from '@/lib/gameRoomV2/racing'

// The race track: one horizontal lane per racer, each racer's emoji
// positioned by its distance-to-trackLength ratio. Theme controls only
// colors/emoji -- the lane layout and physics are identical across
// every theme. Only reads racers/trackLength (not the full RaceState)
// so the SAME component renders both solo racing (a full, locally-
// ticked RaceState) and live classroom multiplayer racing (a
// server-polled subset synthesized by
// lib/gameRoomV2/racing/liveRace.ts's liveRacersToRaceState) without
// either caller needing to fabricate elapsedMs/raceOver/winnerId/
// difficulty fields Track itself never looks at.
export function Track({
  state,
  themeId,
  live,
}: {
  state: Pick<RaceState, 'racers' | 'trackLength'>
  themeId: RaceThemeId
  // Live Classroom multiplayer mode polls server positions roughly
  // every 1.5s (see RacingGame.tsx's LIVE_POLL_INTERVAL_MS) rather than
  // ticking locally every 100ms -- a fast 0.1s linear tween tuned for
  // that fine-grained solo cadence would visibly SNAP into place on
  // every poll instead of gliding. `live` swaps in a longer,
  // eased tween sized to bridge one full poll interval smoothly,
  // without changing anything about WHAT is animated -- still just
  // interpolating between two already-known distances, never
  // fabricating intermediate positions the server never reported.
  live?: boolean
}) {
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
                  transition={reduced ? { duration: 0 } : live ? { type: 'tween', ease: 'linear', duration: 1.4 } : { type: 'tween', ease: 'linear', duration: 0.1 }}
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
