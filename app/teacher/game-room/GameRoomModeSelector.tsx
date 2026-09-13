'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GameRoomHostClient } from './GameRoomHostClient'
import { MayangoliHostClient } from '@/app/teacher/mayangoli/MayangoliHostClient'

type GameRoomMode = 'classic' | 'mayangoli'

// A dropdown picker at the top of Game Room, rather than a separate nav
// item, since Mayangoli is really a second GAME within Game Room (a
// synchronized Kahoot-style format) rather than an unrelated feature --
// switching modes just swaps which client component renders below;
// each keeps its own independent session state (creating a Mayangoli
// session doesn't affect an in-progress classic quiz session or vice
// versa, since they're backed by entirely separate tables/routes).
export function GameRoomModeSelector() {
  const [mode, setMode] = useState<GameRoomMode>('classic')

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Game Type</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as GameRoomMode)}
            className="w-full sm:w-72 px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          >
            <option value="classic">Classic Quiz -- self-paced</option>
            <option value="mayangoli">மயங்கொலி Challenge -- live synchronized</option>
          </select>
          {mode === 'mayangoli' && (
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1.5">
              Everyone answers the same question at once, then you reveal the results together. Teaches ல்/ள்/ழ், ன்/ண்/ந்,
              and ர்/ற் letter groups.
            </p>
          )}
        </div>
        {mode === 'mayangoli' && (
          <Link
            href="/teacher/mayangoli/words"
            className="shrink-0 text-sm font-semibold text-primary-700 dark:text-primary-400 hover:underline whitespace-nowrap mt-7"
          >
            Word Bank
          </Link>
        )}
      </div>

      {mode === 'classic' ? <GameRoomHostClient /> : <MayangoliHostClient joinLinkPath="/student/game-room" joinLinkExtraParams="&mode=mayangoli" />}
    </div>
  )
}
