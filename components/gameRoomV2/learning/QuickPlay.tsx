'use client'

import { useMemo, useState } from 'react'
import { FiPlay, FiShuffle } from 'react-icons/fi'
import type { TopicSummary } from '@/lib/gameRoomV2/builtin/summaries'
import { useStartGame } from './useStartGame'

type Difficulty = '' | 'easy' | 'medium' | 'hard'
type Status = 'new' | 'practicing' | 'mastered'

const selectClass =
  'w-full px-3 py-2 min-h-[44px] rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent'

// Quick Play: pick a topic, difficulty and game -- or "Surprise Me",
// which picks a random topic you haven't mastered yet (preferring ones
// you've started) and a random compatible game. Deliberately simple
// random selection; not personalised or AI-driven.
export function QuickPlay({ topics, statuses }: { topics: TopicSummary[]; statuses: Record<string, Status> }) {
  const { start, starting } = useStartGame()
  const [difficulty, setDifficulty] = useState<Difficulty>('')
  const [topicKey, setTopicKey] = useState('')
  const [engineId, setEngineId] = useState('')

  const filteredTopics = useMemo(() => topics.filter((t) => !difficulty || t.difficulty === difficulty), [topics, difficulty])
  const topic = filteredTopics.find((t) => t.key === topicKey) ?? null
  const engine = topic?.engines.find((e) => e.engineId === engineId) ?? null

  function surprise() {
    const pool = filteredTopics.length > 0 ? filteredTopics : topics
    const practicing = pool.filter((t) => statuses[t.key] === 'practicing')
    const unmastered = pool.filter((t) => statuses[t.key] !== 'mastered')
    const candidates = practicing.length > 0 && Math.random() < 0.5 ? practicing : unmastered.length > 0 ? unmastered : pool
    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    const game = pick.engines[Math.floor(Math.random() * pick.engines.length)]
    setTopicKey(pick.key)
    setEngineId(game.engineId)
    start(game.setId, game.engineId, 'surprise')
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Difficulty</span>
          <select
            className={selectClass}
            value={difficulty}
            onChange={(e) => {
              setDifficulty(e.target.value as Difficulty)
              setTopicKey('')
              setEngineId('')
            }}
          >
            <option value="">Any difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Topic</span>
          <select
            className={`${selectClass} font-tamil leading-relaxed`}
            value={topicKey}
            onChange={(e) => {
              setTopicKey(e.target.value)
              setEngineId('')
            }}
          >
            <option value="">Choose a topic</option>
            {filteredTopics.map((t) => (
              <option key={t.key} value={t.key}>
                {t.tamilTitle} -- {t.englishTitle}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Game</span>
          <select className={selectClass} value={engineId} disabled={!topic} onChange={(e) => setEngineId(e.target.value)}>
            <option value="">{topic ? 'Choose a game' : 'Pick a topic first'}</option>
            {topic?.engines.map((e) => (
              <option key={e.engineId} value={e.engineId}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          disabled={!engine || starting !== null}
          onClick={() => engine && start(engine.setId, engine.engineId, 'quick')}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-primary-700 hover:bg-primary-800 dark:bg-primary-600 dark:hover:bg-primary-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiPlay className="w-4 h-4" aria-hidden /> {starting === 'quick' ? 'Starting...' : 'Play'}
        </button>
        <button
          type="button"
          disabled={starting !== null}
          onClick={surprise}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 text-sm font-semibold hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors disabled:opacity-50"
        >
          <FiShuffle className="w-4 h-4" aria-hidden /> {starting === 'surprise' ? 'Starting...' : 'Surprise Me'}
        </button>
      </div>
    </div>
  )
}
