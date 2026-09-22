'use client'

import { useMemo, useState } from 'react'
import { FiCompass, FiAward, FiChevronRight } from 'react-icons/fi'
import {
  GameTile,
  GameV2Card,
  GameV2Badge,
  GameV2Empty,
  WorldCard,
  StudentStatusBar,
  type GameTileAccent,
} from '@/components/gameRoomV2'
import { GAME_ENGINES_V2 } from '@/lib/gameRoomV2/registry'
import { LEARNING_WORLDS, type GameEngine } from '@/lib/gameRoomV2/domain'

const TILE_ACCENTS: GameTileAccent[] = ['ink', 'coral', 'mint', 'cyan', 'magenta', 'lime']
const ENGINE_ICON: Record<string, string> = {
  'classic-quiz': '❓',
  'tower-defense': '🏰',
  'boss-battle': '⚔️',
  'racing': '🏁',
  'treasure-quest': '🗺️',
  'word-ninja': '🥷',
  'space-mission': '🚀',
  'kingdom-builder': '🏯',
  'mystery-mansion': '🕵️',
  'crossword': '📝',
  'matching': '🧩',
  'memory': '🃏',
}

// Featured = the flagship "big arcade" engines that carry the visual
// identity of the platform; the rest (including the lightweight
// crossword/matching/memory activities) live in the full Game Library
// below. Both sections read from the SAME registry array -- there's no
// separate "featured" data source to drift out of sync.
const FEATURED_ENGINE_IDS = ['tower-defense', 'racing', 'boss-battle', 'treasure-quest']

function GameGrid({ engines, onSelect }: { engines: GameEngine[]; onSelect: (engine: GameEngine) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {engines.map((engine, i) => (
        <GameTile
          key={engine.id}
          title={engine.name}
          tamilTitle={engine.tamilName}
          icon={<span>{ENGINE_ICON[engine.id] ?? '🎮'}</span>}
          accent={TILE_ACCENTS[i % TILE_ACCENTS.length]}
          status={engine.status}
          onClick={() => onSelect(engine)}
        />
      ))}
    </div>
  )
}

function SectionHeader({ tamilTitle, title, subtitle }: { tamilTitle?: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-gamev2ink-900 dark:text-white">{title}</h2>
        {tamilTitle && (
          <p className="font-tamil text-base text-gamev2ink-500 dark:text-gamev2ink-400 leading-relaxed">
            {tamilTitle}
          </p>
        )}
        {subtitle && <p className="text-sm text-gamev2ink-400 dark:text-gamev2ink-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

export function HomeScreenClient({ studentName }: { studentName: string }) {
  const [infoEngine, setInfoEngine] = useState<GameEngine | null>(null)

  const featuredEngines = useMemo(
    () => FEATURED_ENGINE_IDS.map((id) => GAME_ENGINES_V2.find((e) => e.id === id)).filter((e): e is GameEngine => Boolean(e)),
    []
  )

  // No real gameplay exists yet for ANY engine (every registry entry is
  // status COMING_SOON) -- clicking a tile can only ever show what it
  // is, never launch something that doesn't exist. This is the actual
  // enforcement of "do not create fake functionality": there is no
  // silent no-op button here, there's a real info popover explaining
  // the honest current status.
  function handleSelectEngine(engine: GameEngine) {
    setInfoEngine(engine)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 dark:from-gamev2ink-950 dark:to-gamev2ink-900 px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* ============ HEADER / ARCADE MARQUEE ============ */}
        <header className="relative rounded-3xl overflow-hidden border-2 border-gamev2ink-100 dark:border-gamev2ink-800 shadow-xl">
          <div className="relative bg-gradient-to-br from-gamev2ink-700 via-gamev2ink-800 to-gamev2ink-950 px-6 sm:px-10 py-8 sm:py-12">
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1.5px, transparent 1.5px)',
                backgroundSize: '22px 22px',
              }}
              aria-hidden
            />
            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gamev2spark-400">
                Tamizhi GameRoom · Internal Preview
              </p>
              <h1 className="text-3xl sm:text-4xl font-black text-white mt-1">Welcome back, {studentName}! 👋</h1>
              <p className="text-gamev2ink-200 mt-2 max-w-lg">
                Pick a world, jump into a game, or continue where you left off.
              </p>
            </div>
          </div>
        </header>

        {/* ============ STUDENT XP / LEVEL / COINS ============ */}
        <StudentStatusBar name={studentName} xp={0} coins={0} />

        {/* ============ CONTINUE PLAYING ============ */}
        <section className="space-y-4">
          <SectionHeader title="Continue Playing" />
          <GameV2Card>
            <GameV2Empty
              title="No games in progress"
              description="Once you start a game, you can pick up right where you left off here."
            />
          </GameV2Card>
        </section>

        {/* ============ TODAY'S CHALLENGE ============ */}
        <section className="space-y-4">
          <SectionHeader title="Today's Challenge" tamilTitle="இன்றைய சவால்" />
          <GameV2Card className="bg-gradient-to-br from-gamev2spark-50 to-white dark:from-gamev2spark-500/10 dark:to-gamev2ink-900">
            <GameV2Empty
              title="No challenge published yet"
              description="Your teacher hasn't set today's challenge. Check back soon!"
            />
          </GameV2Card>
        </section>

        {/* ============ FEATURED GAMES ============ */}
        <section className="space-y-4">
          <SectionHeader title="Featured Games" subtitle="The big arcade experiences -- coming soon." />
          <GameGrid engines={featuredEngines} onSelect={handleSelectEngine} />
        </section>

        {/* ============ LEARNING WORLDS ============ */}
        <section className="space-y-4">
          <SectionHeader title="Learning Worlds" subtitle="Six worlds, each with its own identity." />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {LEARNING_WORLDS.map((world) => (
              <WorldCard key={world.id} world={world} onClick={() => {}} />
            ))}
          </div>
        </section>

        {/* ============ FULL GAME LIBRARY ============ */}
        <section className="space-y-4">
          <SectionHeader
            title="Game Library"
            subtitle={`${GAME_ENGINES_V2.length} games and activities -- every one is COMING_SOON while V2 is in development.`}
          />
          <GameGrid engines={GAME_ENGINES_V2} onSelect={handleSelectEngine} />
        </section>

        {/* ============ ACHIEVEMENTS PREVIEW ============ */}
        <section className="space-y-4">
          <SectionHeader title="Achievements" />
          <GameV2Card>
            <div className="flex flex-wrap gap-5">
              <GameV2Badge icon="🔥" label="Streak" locked />
              <GameV2Badge icon="⭐" label="Perfect Round" locked />
              <GameV2Badge icon="🏆" label="Top of Class" locked />
              <GameV2Badge icon="🎯" label="Sharp Shooter" locked />
              <GameV2Badge icon="🚀" label="Explorer" locked />
            </div>
            <p className="text-sm text-gamev2ink-400 dark:text-gamev2ink-500 mt-4">
              Every badge unlocks once a game is playable and you&apos;ve earned it -- none of these are earned yet.
            </p>
          </GameV2Card>
        </section>

        {/* ============ RECENT ACCOMPLISHMENTS ============ */}
        <section className="space-y-4">
          <SectionHeader title="Recent Accomplishments" />
          <GameV2Card>
            <GameV2Empty
              icon={FiAward}
              title="Nothing here yet"
              description="Finish a game to see your accomplishments show up in this list."
            />
          </GameV2Card>
        </section>
      </div>

      {infoEngine && (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-gamev2ink-950/60 backdrop-blur-sm p-4"
          onClick={() => setInfoEngine(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-gamev2ink-900 border-2 border-gamev2ink-100 dark:border-gamev2ink-800 shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-4xl mb-2" aria-hidden>
                  {ENGINE_ICON[infoEngine.id] ?? '🎮'}
                </p>
                <h3 className="text-lg font-extrabold text-gamev2ink-900 dark:text-white">{infoEngine.name}</h3>
                {infoEngine.tamilName && (
                  <p className="font-tamil text-sm text-gamev2ink-500 dark:text-gamev2ink-400">{infoEngine.tamilName}</p>
                )}
              </div>
              <span className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gamev2ink-100 dark:bg-gamev2ink-800 text-gamev2ink-600 dark:text-gamev2ink-300">
                <FiCompass className="w-3 h-3" /> {infoEngine.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-sm text-gamev2ink-600 dark:text-gamev2ink-300 mt-3">{infoEngine.description}</p>
            <p className="text-xs text-gamev2ink-400 dark:text-gamev2ink-500 mt-3">
              This game isn&apos;t playable yet -- it&apos;s being built as part of GameRoom V2.
            </p>
            <button
              type="button"
              onClick={() => setInfoEngine(null)}
              className="mt-5 w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl font-bold text-gamev2ink-700 dark:text-gamev2ink-200 border-2 border-gamev2ink-200 dark:border-gamev2ink-700 hover:bg-gamev2ink-50 dark:hover:bg-gamev2ink-800 transition-colors"
            >
              Got it <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
