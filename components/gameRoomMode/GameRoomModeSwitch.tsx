'use client'

import Link from 'next/link'
import { FiRepeat } from 'react-icons/fi'

// Temporary migration fallback. Remove Classic GameRoom only after
// GameRoom V2 production stabilization.
//
// Shared by BOTH GameRooms, so it lives outside components/gameRoomV2 and
// the legacy game-room paths (neither may import the other). Links go
// through /gameroom/v2 and /gameroom/classic, which resolve the right
// role-specific page server-side.
export const GAMEROOM_MODE_STORAGE_KEY = 'gameroom-mode'
export type GameRoomMode = 'v2' | 'classic'

export function rememberGameRoomMode(mode: GameRoomMode) {
  try {
    window.localStorage.setItem(GAMEROOM_MODE_STORAGE_KEY, mode)
  } catch {
    // Private mode / blocked storage -- the preference is a convenience only.
  }
}

export function GameRoomModeSwitch({ to, tone = 'light' }: { to: GameRoomMode; tone?: 'light' | 'dark' }) {
  const label = to === 'classic' ? 'Switch to Classic' : 'Try the New GameRoom'
  const toneClass =
    tone === 'dark'
      ? 'text-white/80 hover:text-white border-white/25 hover:border-white/50'
      : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white border-stone-300 dark:border-stone-600 hover:border-stone-500'
  return (
    <Link
      href={`/gameroom/${to}`}
      onClick={() => rememberGameRoomMode(to)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-full border text-xs font-bold transition-colors ${toneClass}`}
    >
      <FiRepeat className="w-3.5 h-3.5" aria-hidden /> {label}
    </Link>
  )
}
