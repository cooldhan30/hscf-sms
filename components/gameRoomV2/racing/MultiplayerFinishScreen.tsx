'use client'

import { motion } from 'framer-motion'
import { GameV2Card, GameV2Button, useGameV2Motion } from '@/components/gameRoomV2'
import type { LiveRacer } from '@/lib/gameRoomV2/racing'
import { Bi } from '@/components/gameRoomV2/Bi'

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
      <h2 className="font-tamil leading-snug text-2xl font-extrabold text-gamev2ink-900 dark:text-white">பந்தயம் முடிந்தது!</h2>
      <p className="text-xs font-semibold text-gamev2ink-400">Race complete</p>
      <p className="font-tamil mt-1 text-sm text-gamev2ink-500 dark:text-gamev2ink-400">
        {myPlacement >= 0 ? `நீங்கள் ${myPlacement + 1} ஆம் இடம் பெற்றீர்கள்.` : 'இறுதி நிலைகள் இதோ.'}
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
                {isMe && <span className="font-tamil text-[10px] font-bold text-gamev2spark-600 dark:text-gamev2spark-400">(நீங்கள்)</span>}
              </span>
              <span className="font-tamil text-xs font-bold text-gamev2ink-500 dark:text-gamev2ink-400">{r.finished ? 'முடித்தார்' : 'முடிக்கவில்லை'}</span>
            </li>
          )
        })}
      </ul>

      <GameV2Button variant="spark" fullWidth className="mt-6" onClick={onExit}>
        <Bi k="continue" inline />
      </GameV2Button>
    </GameV2Card>
  )
}


