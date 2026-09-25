'use client'

import Link from 'next/link'
import { FiArrowRight } from 'react-icons/fi'

// Shown only on the legacy GameRoom pages (/student/game-room,
// /teacher/game-room), which are kept as an emergency rollback target.
// If someone lands there by an old bookmark while V2 is released, this
// sends them to the current GameRoom. There is intentionally no link the
// other way: V2 has no Classic switch.
//
// Lives outside components/gameRoomV2 and the legacy game-room paths
// because legacy files may not import V2 modules (and vice versa).
export type GameRoomMode = 'v2'

export function GameRoomModeSwitch({ to }: { to: GameRoomMode; tone?: 'light' | 'dark' }) {
  return (
    <Link
      href={`/gameroom/${to}`}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-full border text-xs font-bold transition-colors text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white border-stone-300 dark:border-stone-600 hover:border-stone-500"
    >
      Open the current Game Room <FiArrowRight className="w-3.5 h-3.5" aria-hidden />
    </Link>
  )
}
