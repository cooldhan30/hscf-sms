'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiSearch, FiPlayCircle, FiUsers, FiX, FiClock, FiCheck } from 'react-icons/fi'
import { engineIcon } from '@/components/gameRoomV2/shell/ui'
import { toast } from '@/lib/toast'
import { DEFAULT_TIME_LIMIT, QUESTION_COUNT_OPTIONS, TIME_LIMIT_OPTIONS } from '@/lib/gameRoomV2/gameOptions'
import { MyQuestions } from './MyQuestions'
import type { LauncherProps, LauncherTopic } from './types'

// The GameRoom home: four choices on one screen -- Topic, Game, Questions,
// Time per question -- then Play (students, a solo game) or Start live
// with my class (teachers). Either choice can come first: picking a game
// narrows the topics to ones it can play, and picking a topic narrows the
// games. The server re-checks everything (sessions/start, live/host).

const chip = (on: boolean, disabled = false) =>
  `min-h-[44px] px-4 rounded-full text-sm font-semibold border-2 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 ${
    on
      ? 'bg-primary-700 border-primary-700 text-white'
      : disabled
        ? 'border-stone-200 dark:border-stone-800 text-stone-300 dark:text-stone-600 cursor-not-allowed'
        : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:border-primary-400'
  }`

function StepTitle({ n, title, done, hint }: { n: number; title: string; done: boolean; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-3">
      <span
        className={`w-7 h-7 shrink-0 rounded-full text-sm font-bold flex items-center justify-center self-center ${done ? 'bg-primary-700 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'}`}
        aria-hidden
      >
        {done ? <FiCheck className="w-4 h-4" /> : n}
      </span>
      <h2 className="text-lg font-bold text-primary-900 dark:text-white">{title}</h2>
      {hint && <span className="text-sm text-stone-500 dark:text-stone-400 truncate">{hint}</span>}
    </div>
  )
}

export function GameLauncher({ role, topics, games, classes, mySets, initialTopicKey }: LauncherProps & { initialTopicKey?: string | null }) {
  const router = useRouter()
  const [topicKey, setTopicKey] = useState<string | null>(initialTopicKey ?? null)
  const [gameId, setGameId] = useState<string | null>(null)
  const [count, setCount] = useState<number | null>(10)
  const [time, setTime] = useState<number>(DEFAULT_TIME_LIMIT)
  const [classId, setClassId] = useState<string | null>(classes.length === 1 ? classes[0].id : null)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('All')
  const [starting, setStarting] = useState(false)
  const gameStepRef = useRef<HTMLDivElement>(null)
  const topicStepRef = useRef<HTMLElement>(null)

  const topic = topics.find((t) => t.key === topicKey) ?? null
  const game = games.find((g) => g.id === gameId) ?? null
  const choice = topic && game ? topic.games.find((g) => g.engineId === game.id) ?? null : null
  const available = choice?.questionCount ?? null
  const effectiveCount = count !== null && available !== null && count >= available ? null : count

  const groups = useMemo(() => ['All', ...Array.from(new Set(topics.map((t) => t.group)))], [topics])
  const visibleTopics = useMemo(() => {
    const q = query.trim().toLowerCase()
    return topics.filter(
      (t) =>
        (group === 'All' || t.group === group) &&
        (!gameId || t.games.some((g) => g.engineId === gameId)) &&
        (!q || [t.title, t.tamilTitle ?? '', t.group].some((v) => v.toLowerCase().includes(q)))
    )
  }, [topics, query, group, gameId])
  const visibleGames = topic ? games.filter((g) => topic.games.some((x) => x.engineId === g.id)) : games
  const kidsGames = visibleGames.filter((g) => g.kids)
  const otherGames = visibleGames.filter((g) => !g.kids)

  const needsClass = role === 'teacher'
  const ready = !!choice && (!needsClass || !!classId)

  function pickTopic(t: LauncherTopic) {
    if (topicKey === t.key) {
      setTopicKey(null)
      return
    }
    setTopicKey(t.key)
    // A game that can't play the new topic is cleared, not kept silently.
    if (gameId && !t.games.some((g) => g.engineId === gameId)) setGameId(null)
    if (!gameId) gameStepRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // "Use" on one of the teacher's own sets: select it as the topic.
  function selectOwnSet(setId: string) {
    const t = topics.find((x) => x.key === `set:${setId}`)
    if (!t) return
    setQuery('')
    setGroup('All')
    setTopicKey(t.key)
    if (gameId && !t.games.some((g) => g.engineId === gameId)) setGameId(null)
    topicStepRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function start() {
    if (!choice || !ready) return
    setStarting(true)
    try {
      const res =
        role === 'student'
          ? await fetch('/api/gameroom-v2/sessions/start', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ questionSetId: choice.setId, engineId: choice.engineId, questionCount: effectiveCount, timeLimitSeconds: time }),
            })
          : await fetch('/api/gameroom-v2/live/host', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ questionSetId: choice.setId, engineId: choice.engineId, classId, questionCount: effectiveCount, timeLimitSeconds: time }),
            })
      const data = await res.json().catch(() => ({}))
      const next = role === 'student' ? data.sessionId && `/gameroom-v2/play/${data.sessionId}` : data.liveSessionId && `/gameroom-v2/live/host/${data.liveSessionId}`
      if (!res.ok || !next) {
        toast.error(data.error || 'Could not start the game. Please try again.')
        setStarting(false)
        return
      }
      router.push(next)
    } catch {
      toast.error('Could not start the game. Check your connection and try again.')
      setStarting(false)
    }
  }

  const selectedClass = classes.find((c) => c.id === classId)
  const card = 'bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4 sm:p-5'

  return (
    <div className="space-y-4 pb-36 sm:pb-28">
      {role === 'teacher' && <MyQuestions sets={mySets} onUse={selectOwnSet} />}

      {/* 1. Topic */}
      <section className={`${card} scroll-mt-4`} ref={topicStepRef} aria-labelledby="launcher-topic">
        <div id="launcher-topic">
          <StepTitle n={1} title="Topic" done={!!topic} hint={topic ? topic.tamilTitle ?? topic.title : undefined} />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <label className="relative flex-1">
            <span className="sr-only">Search topics</span>
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topics -- e.g. animals, விலங்கு"
              className="w-full min-h-[44px] pl-9 pr-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-sm focus:outline-none focus:ring-4 focus:ring-primary-300"
            />
          </label>
          {gameId && (
            <button type="button" onClick={() => setGameId(null)} className="min-h-[44px] px-3 rounded-xl text-sm font-semibold text-primary-700 dark:text-primary-400 border border-primary-200 dark:border-primary-800 inline-flex items-center gap-1.5">
              <FiX className="w-4 h-4" aria-hidden /> Showing topics for {game?.name}
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 mb-1" role="radiogroup" aria-label="Topic group">
          {groups.map((g) => (
            <button key={g} type="button" role="radio" aria-checked={group === g} onClick={() => setGroup(g)} className={`${chip(group === g)} !min-h-[36px] !px-3 shrink-0`}>
              {g}
            </button>
          ))}
        </div>
        {visibleTopics.length === 0 ? (
          <p className="text-sm text-stone-500 py-6 text-center">No topics match. Try another search{gameId ? ' or another game' : ''}.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[20rem] overflow-y-auto -mx-1 px-1 py-1" role="radiogroup" aria-label="Topic">
            {visibleTopics.map((t) => (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={topicKey === t.key}
                onClick={() => pickTopic(t)}
                className={`text-left rounded-xl border-2 px-3 py-2 min-h-[60px] focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 ${
                  topicKey === t.key ? 'border-primary-600 bg-primary-50 dark:bg-primary-950' : 'border-stone-200 dark:border-stone-800 hover:border-primary-300'
                }`}
              >
                {t.tamilTitle ? (
                  <>
                    <span className="block font-tamil font-semibold text-stone-800 dark:text-stone-100 leading-snug">{t.tamilTitle}</span>
                    <span className="block text-xs text-stone-500 dark:text-stone-400 truncate">
                      {t.title}
                      {t.custom && ` · ${t.group}`}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="block font-semibold text-stone-800 dark:text-stone-100 leading-snug">{t.title}</span>
                    <span className="block text-xs text-stone-500 dark:text-stone-400 truncate">{t.group}</span>
                  </>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 2. Game */}
      <section className={`${card} scroll-mt-4`} ref={gameStepRef} aria-label="Game">
        <StepTitle n={2} title="Game" done={!!game} hint={topic ? `${visibleGames.length} games for this topic` : 'or pick a game first'} />
        {[
          { label: 'Little Learners · ages 4-9', list: kidsGames },
          { label: 'Games', list: otherGames },
        ]
          .filter((s) => s.list.length > 0)
          .map((s) => (
            <div key={s.label} className="mb-3 last:mb-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-2">{s.label}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2" role="radiogroup" aria-label={s.label}>
                {s.list.map((g) => {
                  const Icon = engineIcon(g.id)
                  const on = gameId === g.id
                  return (
                    <button
                      key={g.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      title={g.description}
                      onClick={() => setGameId(on ? null : g.id)}
                      className={`text-left rounded-xl border-2 p-3 min-h-[76px] flex flex-col gap-1.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 ${
                        on ? 'border-primary-600 bg-primary-50 dark:bg-primary-950' : 'border-stone-200 dark:border-stone-800 hover:border-primary-300'
                      }`}
                    >
                      <Icon className={`w-6 h-6 ${on ? 'text-primary-700 dark:text-primary-300' : 'text-primary-600 dark:text-primary-400'}`} aria-hidden />
                      <span className="font-semibold text-sm text-stone-800 dark:text-stone-100 leading-tight">{g.name}</span>
                      {g.tamilName && <span className="font-tamil text-xs text-stone-500 dark:text-stone-400 leading-tight">{g.tamilName}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
      </section>

      {/* 3 + 4. Questions and time */}
      <section className={`${card} grid gap-5 md:grid-cols-2`} aria-label="Game settings">
        <div>
          <StepTitle n={3} title="Questions" done={!!choice} hint={available !== null ? `${available} in this topic` : undefined} />
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Number of questions">
            {QUESTION_COUNT_OPTIONS.map((n) => {
              const disabled = available !== null && n >= available
              return (
                <button key={n} type="button" role="radio" aria-checked={effectiveCount === n} disabled={disabled} onClick={() => setCount(n)} className={chip(effectiveCount === n, disabled)}>
                  {n}
                </button>
              )
            })}
            <button type="button" role="radio" aria-checked={effectiveCount === null} onClick={() => setCount(null)} className={chip(effectiveCount === null)}>
              All{available !== null ? ` ${available}` : ''}
            </button>
          </div>
        </div>
        <div>
          <StepTitle n={4} title="Time per question" done={!!choice} />
          {game?.kids ? (
            <p className="text-sm text-stone-600 dark:text-stone-300 flex items-start gap-2 min-h-[44px]">
              <FiClock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden /> {game.name} has no timer -- little learners play at their own pace.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Time per question">
              {TIME_LIMIT_OPTIONS.map((s) => (
                <button key={s} type="button" role="radio" aria-checked={time === s} onClick={() => setTime(s)} className={chip(time === s)}>
                  {s}s{s === 60 ? ' · relaxed' : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {needsClass && classes.length > 1 && (
        <section className={card} aria-label="Class">
          <StepTitle n={5} title="Class" done={!!classId} />
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Class">
            {classes.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={classId === c.id} onClick={() => setClassId(c.id)} className={chip(classId === c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        </section>
      )}
      {needsClass && classes.length === 0 && (
        <p className={`${card} text-sm text-stone-600 dark:text-stone-300`}>You are not assigned to a class yet, so you cannot start a live game. Ask an admin to add you as a class teacher.</p>
      )}

      {/* Play: always visible at the bottom of the screen */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 dark:border-stone-800 bg-white/95 dark:bg-stone-950/95 backdrop-blur [padding-bottom:env(safe-area-inset-bottom)]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <p className="text-sm text-stone-600 dark:text-stone-300 min-w-0 flex-1 truncate">
            {choice ? (
              <>
                <span className="font-semibold">{topic!.tamilTitle ?? topic!.title}</span> · {game!.name} · {effectiveCount ?? `all ${available}`} questions
                {!game!.kids && ` · ${time}s each`}
                {needsClass && selectedClass && ` · ${selectedClass.name}`}
              </>
            ) : !topic && !game ? (
              'Choose a topic and a game.'
            ) : !topic ? (
              'Now choose a topic.'
            ) : (
              'Now choose a game.'
            )}
          </p>
          <button
            type="button"
            onClick={start}
            disabled={!ready || starting}
            className="min-h-[52px] px-6 rounded-xl bg-primary-700 hover:bg-primary-800 disabled:opacity-50 text-white text-lg font-bold inline-flex items-center justify-center gap-2 focus:outline-none focus:ring-4 focus:ring-primary-300"
          >
            {role === 'student' ? <FiPlayCircle className="w-5 h-5" aria-hidden /> : <FiUsers className="w-5 h-5" aria-hidden />}
            {starting ? 'Starting...' : role === 'student' ? 'Play' : 'Start live with my class'}
          </button>
        </div>
      </div>
    </div>
  )
}
