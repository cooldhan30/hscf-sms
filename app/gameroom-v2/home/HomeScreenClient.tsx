'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FiCompass, FiAward, FiChevronRight, FiPlay, FiUsers } from 'react-icons/fi'
import { GameRoomModeSwitch } from '@/components/gameRoomMode/GameRoomModeSwitch'
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

interface PlayableSet {
  id: string
  title: string
  tamilTitle: string | null
  questionCount: number
}

export interface HomeProgressionData {
  xp: number
  coins: number
  currentDailyStreak: number
  earnedAchievements: { id: string; name: string; icon: string }[]
}

export function HomeScreenClient({
  studentName,
  progression,
  previewLockedAchievements,
}: {
  studentName: string
  progression: HomeProgressionData
  previewLockedAchievements: { id: string; name: string; icon: string }[]
}) {
  const router = useRouter()
  const [infoEngine, setInfoEngine] = useState<GameEngine | null>(null)
  const [challengeMessage, setChallengeMessage] = useState<string | null>(null)
  const [playableSets, setPlayableSets] = useState<PlayableSet[] | null>(null)
  const [startingSetId, setStartingSetId] = useState<string | null>(null)
  const [startError, setStartError] = useState<string | null>(null)

  // Loads the sets this student may play on their own with the chosen
  // engine (published, in one of their classes, compatible).
  useEffect(() => {
    if (!infoEngine || infoEngine.status !== 'ACTIVE') return
    let cancelled = false
    setPlayableSets(null)
    setStartError(null)
    fetch(`/api/gameroom-v2/student/question-sets?engineId=${encodeURIComponent(infoEngine.id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setPlayableSets(Array.isArray(data?.questionSets) ? data.questionSets : [])
      })
      .catch(() => {
        if (!cancelled) setPlayableSets([])
      })
    return () => {
      cancelled = true
    }
  }, [infoEngine])

  async function handlePlay(setId: string) {
    if (!infoEngine) return
    setStartingSetId(setId)
    setStartError(null)
    const res = await fetch('/api/gameroom-v2/sessions/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionSetId: setId, engineId: infoEngine.id }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.sessionId) {
      setStartingSetId(null)
      setStartError(data.error || 'Could not start the game')
      return
    }
    router.push(`/gameroom-v2/play/${data.sessionId}`)
  }

  useEffect(() => {
    let cancelled = false
    fetch('/api/gameroom-v2/analytics/student-challenge')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && typeof data?.message === 'string') setChallengeMessage(data.message)
      })
      .catch(() => {
        // இன்றைய சவால் is a nice-to-have suggestion, not gameplay-
        // critical -- a fetch failure just leaves the section showing
        // its existing empty state rather than an error banner.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const featuredEngines = useMemo(
    () => FEATURED_ENGINE_IDS.map((id) => GAME_ENGINES_V2.find((e) => e.id === id)).filter((e): e is GameEngine => Boolean(e)),
    []
  )

  // An ACTIVE engine's popover lists the sets the student can play with
  // it; a COMING_SOON engine's popover only explains that it isn't
  // playable yet -- there is never a silent no-op button.
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
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gamev2spark-400">Tamizhi GameRoom</p>
                <GameRoomModeSwitch to="classic" tone="dark" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white mt-1">Welcome back, {studentName}! 👋</h1>
              <p className="text-gamev2ink-200 mt-2 max-w-lg">
                Pick a game below, or join your class&apos;s live game with a code from your teacher.
              </p>
              <Link
                href="/gameroom-v2/live/join"
                className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-extrabold bg-gamev2spark-400 text-gamev2ink-950 hover:bg-gamev2spark-300 transition-colors"
              >
                <FiUsers className="w-5 h-5" /> Join a Live Classroom game
              </Link>
            </div>
          </div>
        </header>

        {/* ============ STUDENT XP / LEVEL / COINS ============ */}
        <StudentStatusBar name={studentName} xp={progression.xp} coins={progression.coins} dailyStreak={progression.currentDailyStreak} />

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
            {challengeMessage ? (
              <p className="text-gamev2ink-800 dark:text-gamev2ink-100 font-semibold">{challengeMessage}</p>
            ) : (
              <GameV2Empty
                title="Play a game to get your first challenge"
                description="Once you've answered a few questions, இன்றைய சவால் will suggest a concept worth practicing."
              />
            )}
          </GameV2Card>
        </section>

        {/* ============ FEATURED GAMES ============ */}
        <section className="space-y-4">
          <SectionHeader title="Featured Games" subtitle="The big arcade experiences." />
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
            subtitle={`${GAME_ENGINES_V2.length} games and activities -- ${GAME_ENGINES_V2.filter((e) => e.status === 'ACTIVE').length} playable now, the rest coming soon.`}
          />
          <GameGrid engines={GAME_ENGINES_V2} onSelect={handleSelectEngine} />
        </section>

        {/* ============ ACHIEVEMENTS PREVIEW ============ */}
        <section className="space-y-4">
          <SectionHeader title="Achievements" />
          <GameV2Card>
            <div className="flex flex-wrap gap-5">
              {progression.earnedAchievements.map((a) => (
                <GameV2Badge key={a.id} icon={a.icon} label={a.name} />
              ))}
              {previewLockedAchievements.map((a) => (
                <GameV2Badge key={a.id} icon={a.icon} label={a.name} locked />
              ))}
            </div>
            <p className="text-sm text-gamev2ink-400 dark:text-gamev2ink-500 mt-4">
              {progression.earnedAchievements.length > 0
                ? `You've earned ${progression.earnedAchievements.length} achievement${progression.earnedAchievements.length === 1 ? '' : 's'} so far -- keep playing to unlock more.`
                : 'Play a game to start earning achievements -- every badge unlocks the moment you actually accomplish it.'}
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
            {infoEngine.status === 'ACTIVE' ? (
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-gamev2ink-400 dark:text-gamev2ink-500 mb-2">Choose a question set</p>
                {playableSets === null && <p className="text-sm text-gamev2ink-400">Loading...</p>}
                {playableSets?.length === 0 && (
                  <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400">
                    Your teacher hasn&apos;t shared any sets for this game yet. Ask them, or join their live game with a code.
                  </p>
                )}
                <ul className="space-y-2 max-h-64 overflow-y-auto">
                  {playableSets?.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        disabled={startingSetId !== null}
                        onClick={() => handlePlay(s.id)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 min-h-[44px] rounded-2xl border-2 border-gamev2ink-200 dark:border-gamev2ink-700 hover:border-gamev2ink-500 text-left disabled:opacity-60"
                      >
                        <span className="min-w-0">
                          <span className="block font-bold text-gamev2ink-800 dark:text-gamev2ink-100 truncate">{s.title}</span>
                          {s.tamilTitle && <span className="block font-tamil text-sm leading-relaxed text-gamev2ink-500 dark:text-gamev2ink-400 truncate">{s.tamilTitle}</span>}
                          <span className="block text-xs text-gamev2ink-400">{s.questionCount} questions</span>
                        </span>
                        <FiPlay className="w-5 h-5 flex-shrink-0 text-gamev2ink-500" aria-hidden />
                        <span className="sr-only">{startingSetId === s.id ? 'Starting' : 'Play'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {startError && <p className="text-sm text-gamev2coral-600 mt-2">{startError}</p>}
              </div>
            ) : (
              <p className="text-xs text-gamev2ink-400 dark:text-gamev2ink-500 mt-3">This game is coming soon.</p>
            )}
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
