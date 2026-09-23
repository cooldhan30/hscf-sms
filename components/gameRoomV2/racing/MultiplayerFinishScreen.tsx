'use client'

import { motion } from 'framer-motion'
import { GameV2Card, GameV2Button, useGameV2Motion } from '@/components/gameRoomV2'
import type { LiveRacer } from '@/lib/gameRoomV2/racing'

const PLACE_EMOJI = ['\u{1F947}', '\u{1F948}', '\u{1F949}']

// The multiplayer race's final results -- every racer's finish
// position, in the exact order api/gameroom-v2/live/[id]/race/route.ts
// already computed server-side (finishedAtMs ascending, since that's
// the one honest measure of "who actually finished first" -- never
// re-sorted or re-derived client-side, so this screen can never show a
// different order than what every OTHER racer's own screen shows).
export function MultiplayerFinishScreen({
  racers,
  myParticipantId,
  onExit,
}: {
  racers: LiveRacer[]
  myParticipantId: string
  onExit: () => void
}) {
  const { reduced, celebrate } = useGameV2Motion()
  const myPlacement = racers.findIndex((r) => r.participantId === myParticipantId)
  const won = myPlacement === 0

  return (
    <GameV2Card padding="lg" className="max-w-lg w-full mx-auto text-center">
      <motion.div
        className="text-5xl mb-2"
        initial={reduced ? { opacity: 0 } : { scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reduced ? { duration: 0 } : celebrate}
        aria-hidden
      >
        {won ? '\u{1F3C6}' : '\u{1F3C1}'}
      </motion.div>
      <h2 className="text-2xl font-extrabold text-gamev2ink-900 dark:text-white">Race Complete!</h2>
      <p className="mt-1 text-sm text-gamev2ink-500 dark:text-gamev2ink-400">
        {myPlacement >= 0 ? `You finished ${ordinal(myPlacement + 1)}.` : 'Here are the final standings.'}
      </p>

      <ul className="mt-5 space-y-2 text-left">
        {racers.map((r, i) => {
          const isMe = r.participantId === myParticipantId
          return (
            <li
              key={r.participantId}
              className={`flex items-center justify-between rounded-xl px-3 py-2 ${
                isMe ? 'bg-gamev2spark-50 dark:bg-gamev2spark-500/10 border-2 border-gamev2spark-300 dark:border-gamev2spark-600' : 'bg-gamev2ink-50 dark:bg-gamev2ink-800/50'
              }`}
            >
              <span className="flex items-center gap-2 font-bold text-sm text-gamev2ink-800 dark:text-gamev2ink-100">
                <span aria-hidden>{PLACE_EMOJI[i] ?? `#${i + 1}`}</span>
                {r.nickname}
                {isMe && <span className="text-[10px] font-bold text-gamev2spark-600 dark:text-gamev2spark-400">(You)</span>}
              </span>
              <span className="text-xs font-bold text-gamev2ink-500 dark:text-gamev2ink-400">{r.finished ? 'Finished' : 'Did not finish'}</span>
            </li>
          )
        })}
      </ul>

      <GameV2Button variant="spark" fullWidth className="mt-6" onClick={onExit}>
        Continue
      </GameV2Button>
    </GameV2Card>
  )
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}
