'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { FiSearch, FiChevronRight } from 'react-icons/fi'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { TopicStatusBadge, Pill, type TopicStatusValue } from '@/components/gameRoomV2/shell/ui'
import { CATEGORY_LABELS, type TopicSummary } from '@/lib/gameRoomV2/builtin/summaries'

const inputClass =
  'w-full px-3 py-2 min-h-[44px] rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent'

// Built-in Tamil topics with search and filters. Used by the student
// Topic Library and the teacher "Built-in Tamil Content" view.
export function TopicLibraryClient({
  topics,
  statuses,
  initialGame = '',
  games,
}: {
  topics: TopicSummary[]
  statuses?: Record<string, TopicStatusValue>
  initialGame?: string
  games: { id: string; name: string }[]
}) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [game, setGame] = useState(initialGame)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return topics.filter((t) => {
      if (q && ![t.tamilTitle, t.englishTitle, t.description].join(' ').toLowerCase().includes(q)) return false
      if (category && t.category !== category) return false
      if (difficulty && t.difficulty !== difficulty) return false
      if (game && !t.engines.some((e) => e.engineId === game)) return false
      return true
    })
  }, [topics, search, category, difficulty, game])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="relative block lg:col-span-1">
          <span className="sr-only">Search topics</span>
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" aria-hidden />
          <input className={`${inputClass} pl-9 font-tamil leading-relaxed`} placeholder="Search topics" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <select aria-label="Category" className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select aria-label="Difficulty" className={inputClass} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option value="">Any difficulty</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <select aria-label="Game" className={inputClass} value={game} onChange={(e) => setGame(e.target.value)}>
          <option value="">Any game</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-stone-500 dark:text-stone-400">
        {filtered.length} of {topics.length} topics
      </p>

      {filtered.length === 0 ? (
        <EmptyState title="No topics match" description="Try a different search or clear a filter." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <Link
              key={t.key}
              href={`/gameroom-v2/topics/${t.key}`}
              className="group flex flex-col p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-primary-300 dark:hover:border-primary-800 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-tamil text-lg font-semibold leading-relaxed text-stone-800 dark:text-stone-100 break-words">{t.tamilTitle}</p>
                  <p className="text-sm text-stone-500 dark:text-stone-400">{t.englishTitle}</p>
                </div>
                <FiChevronRight className="w-5 h-5 text-stone-400 group-hover:text-primary-700 flex-shrink-0 mt-1" aria-hidden />
              </div>
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-2 line-clamp-2 flex-1">{t.description}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                {statuses && <TopicStatusBadge status={statuses[t.key] ?? 'new'} />}
                <Pill>{CATEGORY_LABELS[t.category]}</Pill>
                <Pill>{t.difficulty}</Pill>
                <Pill>{t.engines.length} games</Pill>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
