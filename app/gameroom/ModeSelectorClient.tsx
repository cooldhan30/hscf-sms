'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FiArrowLeft, FiArrowRight } from 'react-icons/fi'
import { GAMEROOM_MODE_STORAGE_KEY, rememberGameRoomMode, type GameRoomMode } from '@/components/gameRoomMode/GameRoomModeSwitch'

// Temporary migration fallback. Remove Classic GameRoom only after
// GameRoom V2 production stabilization.
export function ModeSelectorClient({ newHref, classicHref, dashboardHref }: { newHref: string; classicHref: string; dashboardHref: string }) {
  const [lastMode, setLastMode] = useState<GameRoomMode | null>(null)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(GAMEROOM_MODE_STORAGE_KEY)
      if (stored === 'v2' || stored === 'classic') setLastMode(stored)
    } catch {
      // Storage unavailable -- no "last used" hint, nothing else changes.
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 dark:from-gamev2ink-950 dark:to-gamev2ink-900 px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <Link href={dashboardHref} className="inline-flex items-center gap-1.5 text-sm font-bold text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-white">
          <FiArrowLeft className="w-4 h-4" /> Dashboard
        </Link>

        <header className="text-center mt-6 mb-8">
          <h1 className="text-3xl sm:text-4xl font-black text-gamev2ink-900 dark:text-white">Game Room</h1>
          <p className="font-tamil text-lg leading-relaxed text-gamev2ink-500 dark:text-gamev2ink-400">விளையாட்டு அறை</p>
          <p className="text-stone-500 dark:text-stone-400 mt-2">Choose your experience</p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <ModeCard
            href={newHref}
            mode="v2"
            lastMode={lastMode}
            badge="Recommended · New"
            icon="🎮"
            title="New Game Room"
            subtitle="GameRoom V2"
            description="New games, progression, achievements, classroom experiences and improved visuals."
            featured
          />
          <ModeCard
            href={classicHref}
            mode="classic"
            lastMode={lastMode}
            badge="Classic"
            icon="🕹️"
            title="Classic Game Room"
            subtitle="Original GameRoom"
            description="Continue using the familiar existing experience."
          />
        </div>

        <p className="text-center text-xs text-stone-400 dark:text-stone-500 mt-6">You can switch between them at any time from inside either Game Room.</p>
      </div>
    </div>
  )
}

function ModeCard({
  href,
  mode,
  lastMode,
  badge,
  icon,
  title,
  subtitle,
  description,
  featured,
}: {
  href: string
  mode: GameRoomMode
  lastMode: GameRoomMode | null
  badge: string
  icon: string
  title: string
  subtitle: string
  description: string
  featured?: boolean
}) {
  return (
    <Link
      href={href}
      onClick={() => rememberGameRoomMode(mode)}
      className={`group relative flex flex-col rounded-3xl p-6 border-2 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gamev2spark-300 ${
        featured
          ? 'bg-gradient-to-br from-gamev2ink-700 via-gamev2ink-800 to-gamev2ink-950 border-gamev2ink-700 text-white'
          : 'bg-white dark:bg-gamev2ink-900 border-stone-200 dark:border-gamev2ink-700 text-gamev2ink-900 dark:text-white'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide ${
            featured ? 'bg-gamev2spark-400 text-gamev2ink-950' : 'bg-stone-100 dark:bg-gamev2ink-800 text-stone-600 dark:text-stone-300'
          }`}
        >
          {badge}
        </span>
        {lastMode === mode && <span className={`text-[11px] font-bold ${featured ? 'text-white/70' : 'text-stone-400'}`}>Last used</span>}
      </div>
      <span className="text-5xl mt-5" aria-hidden>
        {icon}
      </span>
      <h2 className="text-xl font-black mt-3">{title}</h2>
      <p className={`text-sm font-bold ${featured ? 'text-white/70' : 'text-stone-500 dark:text-stone-400'}`}>{subtitle}</p>
      <p className={`text-sm mt-3 flex-1 ${featured ? 'text-white/85' : 'text-stone-600 dark:text-stone-300'}`}>{description}</p>
      <span className={`mt-5 inline-flex items-center gap-1.5 font-extrabold ${featured ? 'text-gamev2spark-300' : 'text-gamev2ink-700 dark:text-gamev2ink-200'}`}>
        Open <FiArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}
