'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useGameV2Motion } from '@/components/gameRoomV2'
import { MANSION_ROOMS, type RoomDefinition } from '@/lib/gameRoomV2/mysteryMansion'

// A warm, daylight color per room -- deliberately sunny/inviting
// gradients (never dark, shadowy, or dim), the concrete mechanism
// behind "atmospheric but friendly, NOT horror." Curiosity, not dread.
const ROOM_GRADIENT: Record<string, string> = {
  entrance: 'from-amber-100 via-orange-50 to-amber-50 dark:from-amber-950 dark:via-gamev2ink-900 dark:to-gamev2ink-800',
  library: 'from-emerald-100 via-teal-50 to-emerald-50 dark:from-emerald-950 dark:via-gamev2ink-900 dark:to-gamev2ink-800',
  study: 'from-sky-100 via-blue-50 to-sky-50 dark:from-sky-950 dark:via-gamev2ink-900 dark:to-gamev2ink-800',
  gallery: 'from-rose-100 via-pink-50 to-rose-50 dark:from-rose-950 dark:via-gamev2ink-900 dark:to-gamev2ink-800',
  attic: 'from-amber-100 via-yellow-50 to-amber-50 dark:from-yellow-950 dark:via-gamev2ink-900 dark:to-gamev2ink-800',
  garden: 'from-lime-100 via-green-50 to-lime-50 dark:from-green-950 dark:via-gamev2ink-900 dark:to-gamev2ink-800',
}

// The current room's atmospheric scene -- a big friendly emoji, a
// warm gradient backdrop, and the room's flavor line. Deliberately a
// single-room "you are here" view (not a full floor-plan map), since
// the spec calls for avoiding an unnecessarily complex narrative/UI
// engine -- room-to-room progression is communicated by the
// ProgressTrail component instead.
export function RoomView({ room, revealedClue }: { room: RoomDefinition; revealedClue: string | null }) {
  const { reduced } = useGameV2Motion()

  return (
    <div className={`w-full rounded-3xl overflow-hidden border-2 border-gamev2ink-100 dark:border-gamev2ink-800 bg-gradient-to-b ${ROOM_GRADIENT[room.id]} relative`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={room.id}
          initial={reduced ? { opacity: 0 } : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, x: -24 }}
          transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 220, damping: 24 }}
          className="px-6 py-8 sm:py-10 text-center"
        >
          <motion.div
            className="text-6xl sm:text-7xl mb-3"
            animate={reduced ? undefined : { y: [0, -6, 0] }}
            transition={reduced ? undefined : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden
          >
            {room.emoji}
          </motion.div>
          <h3 className="text-xl font-extrabold text-gamev2ink-900 dark:text-white">{room.name}</h3>
          <p className="mt-1.5 text-sm text-gamev2ink-600 dark:text-gamev2ink-300 max-w-sm mx-auto">{room.ambiance}</p>

          {revealedClue && (
            <motion.div
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 300, damping: 20 }}
              className="mt-4 inline-flex items-start gap-2 max-w-sm mx-auto text-left rounded-2xl bg-white/70 dark:bg-black/30 backdrop-blur-sm px-3.5 py-2.5"
              role="status"
            >
              <span aria-hidden>{'\u{1F50D}'}</span>
              <span className="text-sm font-semibold text-gamev2ink-800 dark:text-gamev2ink-100">{revealedClue}</span>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// A compact room-by-room progress trail -- filled emoji for
// unlocked/visited rooms, dimmed for not-yet-reached ones. This is
// the "progress indicator" the spec calls for, doubling as a visible
// map of the mansion without needing a full floor-plan renderer.
export function ProgressTrail({ unlockedRoomIds, currentRoomId }: { unlockedRoomIds: string[]; currentRoomId: string }) {
  return (
    <div className="w-full max-w-xl mx-auto flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap" role="group" aria-label="Mansion room progress">
      {MANSION_ROOMS.map((room) => {
        const unlocked = unlockedRoomIds.includes(room.id)
        const isCurrent = room.id === currentRoomId
        return (
          <div
            key={room.id}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-colors ${
              isCurrent ? 'bg-gamev2spark-100 dark:bg-gamev2spark-500/20' : ''
            }`}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <span className={`text-lg ${unlocked ? 'opacity-100' : 'opacity-30'}`} aria-hidden>
              {room.emoji}
            </span>
            <span className={`text-[9px] font-bold ${unlocked ? 'text-gamev2ink-700 dark:text-gamev2ink-200' : 'text-gamev2ink-400 dark:text-gamev2ink-600'}`}>
              {room.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}
