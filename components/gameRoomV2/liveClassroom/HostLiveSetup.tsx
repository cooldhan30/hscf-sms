'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FiSearch, FiCheck, FiPlayCircle, FiAlertCircle } from 'react-icons/fi'
import { Card, engineIcon } from '@/components/gameRoomV2/shell/ui'
import { GameV2Loading } from '@/components/gameRoomV2'

// Host Live on ONE screen: Question set -> Class -> Game -> Start Now.
// No question counts, bosses, difficulties or other setup: the server
// creates the session (ownership, class authorization and set/game
// compatibility all re-checked there) and the teacher lands straight on
// the lobby with the join code.

interface HostSet {
  id: string
  title: string
  tamilTitle: string | null
  topic: string | null
  difficulty: string | null
  questionCount: number
  questionTypes: string[]
  source: 'mine' | 'builtin' | 'shared'
  games: { id: string; compatible: boolean; unsupportedTypes: string[] }[]
}
interface HostGame {
  id: string
  name: string
  tamilName: string | null
  description: string
  supportedTypes: string[]
}
interface Options {
  sets: HostSet[]
  classes: { id: string; name: string; grade_level: string | null }[]
  games: HostGame[]
}

const TYPE_LABEL: Record<string, string> = {
  MULTIPLE_CHOICE: 'multiple choice',
  TRUE_FALSE: 'true/false',
  TEXT_INPUT: 'typed answer',
  FILL_BLANK: 'fill in the blank',
  MATCH: 'matching pairs',
  CATEGORIZE: 'sorting into groups',
  ORDER_LETTERS: 'letter ordering',
  ORDER_WORDS: 'word ordering',
  IMAGE_CHOICE: 'picture choice',
  AUDIO_CHOICE: 'listening choice',
}
const typeList = (ts: string[]) => ts.map((t) => TYPE_LABEL[t] ?? t.toLowerCase()).join(', ')

const SOURCES: { id: 'all' | HostSet['source']; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'mine', label: 'My sets' },
  { id: 'builtin', label: 'Built-in' },
  { id: 'shared', label: 'Shared' },
]

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <Card className="!p-4 sm:!p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold text-primary-900 dark:text-white mb-3">
        <span className={`w-7 h-7 rounded-full text-sm flex items-center justify-center ${done ? 'bg-primary-700 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'}`} aria-hidden>
          {done ? <FiCheck className="w-4 h-4" /> : n}
        </span>
        {title}
      </h2>
      {children}
    </Card>
  )
}

export function HostLiveSetup() {
  const router = useRouter()
  const params = useSearchParams()
  const [opts, setOpts] = useState<Options | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [setId, setSetId] = useState<string | null>(params.get('set'))
  const [classId, setClassId] = useState<string | null>(params.get('class'))
  const [gameId, setGameId] = useState<string | null>(params.get('game'))
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<(typeof SOURCES)[number]['id']>('all')
  const [difficulty, setDifficulty] = useState('')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/gameroom-v2/live/host-options')
      .then(async (r) => {
        const d = await r.json().catch(() => null)
        if (!r.ok || !d) throw new Error(d?.error || 'Could not load your question sets and classes')
        setOpts(d)
        if (d.classes.length === 1) setClassId((c) => c ?? d.classes[0].id)
      })
      .catch((e: Error) => setLoadError(e.message))
  }, [])

  const set = opts?.sets.find((x) => x.id === setId) ?? null
  const visibleSets = useMemo(() => {
    if (!opts) return []
    const q = query.trim().toLowerCase()
    return opts.sets.filter(
      (x) =>
        (source === 'all' || x.source === source) &&
        (!difficulty || x.difficulty === difficulty) &&
        (!q || [x.title, x.tamilTitle ?? '', x.topic ?? ''].some((v) => v.toLowerCase().includes(q)))
    )
  }, [opts, query, source, difficulty])
  const compat = (gid: string) => set?.games.find((g) => g.id === gid)
  const gameOk = !!gameId && !!set && !!compat(gameId)?.compatible
  const ready = !!set && !!classId && gameOk

  // A preselected game that doesn't fit a newly chosen set is cleared
  // rather than silently kept.
  useEffect(() => {
    if (set && gameId && !set.games.find((g) => g.id === gameId)?.compatible) setGameId(null)
  }, [set, gameId])

  async function start() {
    if (!ready) return
    setStarting(true)
    setStartError(null)
    const res = await fetch('/api/gameroom-v2/live/host', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionSetId: setId, classId, engineId: gameId }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}
    if (!res || !res.ok) {
      setStarting(false)
      setStartError(data?.error || 'Could not start the live session. Please try again.')
      return
    }
    router.push(`/gameroom-v2/live/host/${data.liveSessionId}`)
  }

  if (loadError) {
    return (
      <Card>
        <p className="text-sm font-semibold text-terracotta-700">{loadError}</p>
      </Card>
    )
  }
  if (!opts) return <GameV2Loading label="Loading your question sets and classes..." />

  const selectedClass = opts.classes.find((c) => c.id === classId)
  const selectedGame = opts.games.find((g) => g.id === gameId)

  return (
    <div className="space-y-4 pb-28">
      <Step n={1} title="Question set" done={!!set}>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <label className="relative flex-1">
            <span className="sr-only">Search question sets</span>
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or topic"
              className="w-full min-h-[44px] pl-9 pr-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-sm focus:outline-none focus:ring-4 focus:ring-primary-300"
            />
          </label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            aria-label="Difficulty"
            className="min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-sm"
          >
            <option value="">Any difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3" role="radiogroup" aria-label="Show">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={source === s.id}
              onClick={() => setSource(s.id)}
              className={`px-3 min-h-[36px] rounded-full text-sm font-semibold border ${source === s.id ? 'bg-primary-700 text-white border-primary-700' : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-300 dark:border-stone-700'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {visibleSets.length === 0 ? (
          <p className="text-sm text-stone-500 py-4 text-center">No question sets match. Try another search, or import one from the library.</p>
        ) : (
          <ul className="max-h-[22rem] overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800 -mx-1 px-1" role="radiogroup" aria-label="Question set">
            {visibleSets.map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={setId === x.id}
                  onClick={() => setSetId(x.id)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl my-0.5 ${setId === x.id ? 'bg-primary-50 dark:bg-primary-950 ring-2 ring-primary-600' : 'hover:bg-stone-50 dark:hover:bg-stone-800'}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-stone-800 dark:text-stone-100 truncate">
                      {x.title}
                      {x.tamilTitle && x.tamilTitle !== x.title && <span className="font-tamil font-normal text-stone-500"> · {x.tamilTitle}</span>}
                    </span>
                    <span className="block text-xs text-stone-500 dark:text-stone-400 truncate">
                      {[x.topic, x.difficulty, `${x.questionCount} question${x.questionCount === 1 ? '' : 's'}`, typeList(x.questionTypes)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                    {x.source === 'mine' ? 'Mine' : x.source === 'builtin' ? 'Built-in' : 'Shared'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Step>

      <Step n={2} title="Class" done={!!selectedClass}>
        {opts.classes.length === 0 ? (
          <p className="text-sm text-stone-500">You are not assigned to any classes yet. Ask an admin to add you as a class teacher.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" role="radiogroup" aria-label="Class">
            {opts.classes.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={classId === c.id}
                onClick={() => setClassId(c.id)}
                className={`text-left rounded-xl border-2 px-3 py-2.5 min-h-[56px] ${classId === c.id ? 'border-primary-600 bg-primary-50 dark:bg-primary-950' : 'border-stone-200 dark:border-stone-800 hover:border-primary-300'}`}
              >
                <span className="block font-semibold text-stone-800 dark:text-stone-100">{c.name}</span>
                {c.grade_level && <span className="block text-xs text-stone-500">{c.grade_level}</span>}
              </button>
            ))}
          </div>
        )}
      </Step>

      <Step n={3} title="Game" done={gameOk}>
        {!set && <p className="text-sm text-stone-500 mb-2">Choose a question set to see which games it works with.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" role="radiogroup" aria-label="Game">
          {opts.games.map((g) => {
            const c = compat(g.id)
            const blocked = !!set && !c?.compatible
            const Icon = engineIcon(g.id)
            return (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={gameId === g.id}
                aria-disabled={blocked || !set}
                onClick={() => !blocked && set && setGameId(g.id)}
                className={`text-left rounded-xl border-2 px-3 py-2.5 min-h-[64px] flex gap-3 ${
                  gameId === g.id ? 'border-primary-600 bg-primary-50 dark:bg-primary-950' : blocked || !set ? 'border-stone-200 dark:border-stone-800 opacity-60 cursor-not-allowed' : 'border-stone-200 dark:border-stone-800 hover:border-primary-300'
                }`}
              >
                <Icon className="w-5 h-5 mt-0.5 shrink-0 text-primary-700 dark:text-primary-400" aria-hidden />
                <span className="min-w-0">
                  <span className="block font-semibold text-stone-800 dark:text-stone-100">
                    {g.name}
                    {g.tamilName && <span className="font-tamil font-normal text-stone-500"> · {g.tamilName}</span>}
                  </span>
                  {blocked ? (
                    <span className="flex items-start gap-1 text-xs text-terracotta-700 dark:text-terracotta-300">
                      <FiAlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
                      Needs {typeList(g.supportedTypes)} questions; this set has {typeList(c?.unsupportedTypes ?? [])}.
                    </span>
                  ) : (
                    <span className="block text-xs text-stone-500 dark:text-stone-400">{g.description}</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </Step>

      {/* Start Now: always visible at the bottom of the screen. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 dark:border-stone-800 bg-white/95 dark:bg-stone-950/95 backdrop-blur [padding-bottom:env(safe-area-inset-bottom)]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <p className="text-sm text-stone-600 dark:text-stone-300 min-w-0 flex-1 truncate">
            {ready ? (
              <>
                <span className="font-semibold">{set!.title}</span> · {selectedClass!.name} · {selectedGame!.name}
              </>
            ) : (
              'Choose a question set, a class and a game.'
            )}
          </p>
          {startError && <p className="text-sm font-semibold text-terracotta-700 sm:max-w-xs" role="alert">{startError}</p>}
          <button
            type="button"
            onClick={start}
            disabled={!ready || starting}
            className="min-h-[52px] px-6 rounded-xl bg-primary-700 hover:bg-primary-800 disabled:opacity-50 text-white text-lg font-bold inline-flex items-center justify-center gap-2 focus:outline-none focus:ring-4 focus:ring-primary-300"
          >
            <FiPlayCircle className="w-5 h-5" aria-hidden /> {starting ? 'Starting...' : 'Start Now'}
          </button>
        </div>
      </div>
    </div>
  )
}
