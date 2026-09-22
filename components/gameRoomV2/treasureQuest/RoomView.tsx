'use client'

import { motion } from 'framer-motion'
import { useGameV2Motion } from '@/components/gameRoomV2'
import { ROOMS, getRoom, canEnterRoom, type ExplorationState, type RoomId } from '@/lib/gameRoomV2/treasureQuest'

// The current room: its art/description, discovered clue (if any), a
// key counter, and a door for each exit -- locked doors show their key
// cost so the player always knows exactly what they're working toward,
// never a mystery requirement.
export function RoomView({ state, onEnterRoom }: { state: ExplorationState; onEnterRoom: (roomId: RoomId) => void }) {
  const { reduced } = useGameV2Motion()
  const room = getRoom(state.currentRoomId)
  const roomClue = room.clue && state.cluesFound.includes(room.clue) ? room.clue : null

  return (
    <div className="w-full rounded-3xl border-2 border-gamev2ink-100 dark:border-gamev2ink-800 bg-gradient-to-b from-amber-50 to-orange-100 dark:from-gamev2ink-800 dark:to-gamev2ink-900 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-wide text-gamev2ink-400 dark:text-gamev2ink-500">
          {state.visitedRoomIds.length} of {ROOMS.length} rooms explored
        </span>
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-extrabold bg-gamev2spark-100 dark:bg-gamev2spark-500/20 text-gamev2spark-700 dark:text-gamev2spark-300">
          {'\u{1F511}'} {state.keys}
        </span>
      </div>

      <motion.div
        key={room.id}
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reduced ? { duration: 0 } : { duration: 0.3 }}
        className="text-center"
      >
        <div className="text-5xl mb-2" aria-hidden>
          {room.emoji}
        </div>
        <h3 className="font-extrabold text-lg text-gamev2ink-900 dark:text-white">
          {room.name} <span className="font-tamil text-sm text-gamev2ink-400 dark:text-gamev2ink-500">· {room.tamilName}</span>
        </h3>
        <p className="text-sm text-gamev2ink-600 dark:text-gamev2ink-300 mt-1">{room.description}</p>
      </motion.div>

      {roomClue && (
        <div className="mt-4 rounded-2xl bg-white/70 dark:bg-gamev2ink-900/60 border border-gamev2ink-100 dark:border-gamev2ink-700 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gamev2ink-400 dark:text-gamev2ink-500 mb-1">
            {'\u{1F4DC}'} Clue found
          </p>
          <p className="text-sm text-gamev2ink-700 dark:text-gamev2ink-200 italic">{roomClue}</p>
        </div>
      )}

      {room.doors.length > 0 && (
        <div className="mt-4 grid gap-2">
          {room.doors.map((door) => {
            const doorRoom = getRoom(door.toRoomId)
            const affordable = canEnterRoom(state, door.toRoomId)
            return (
              <button
                key={door.toRoomId}
                onClick={() => affordable && onEnterRoom(door.toRoomId)}
                disabled={!affordable}
                className={`flex items-center justify-between rounded-2xl border-2 p-3 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gamev2spark-400 ${
                  affordable
                    ? 'border-gamev2spark-400 bg-white dark:bg-gamev2ink-900 hover:border-gamev2spark-500'
                    : 'border-gamev2ink-100 dark:border-gamev2ink-800 bg-white/50 dark:bg-gamev2ink-900/50 opacity-60 cursor-not-allowed'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-bold text-gamev2ink-800 dark:text-gamev2ink-100">
                  <span aria-hidden>{doorRoom.emoji}</span>
                  {doorRoom.name}
                </span>
                <span
                  className={`text-xs font-bold flex items-center gap-1 ${affordable ? 'text-gamev2mint-600 dark:text-gamev2mint-400' : 'text-gamev2ink-400 dark:text-gamev2ink-500'}`}
                >
                  {affordable ? '\u{1F513}' : '\u{1F512}'} {door.keysRequired}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
