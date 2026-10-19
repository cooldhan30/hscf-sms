'use client'

import { useState } from 'react'
import { FiPlay, FiRadio, FiSend } from 'react-icons/fi'
import { MAX_TOPICS, NO_TOPIC, QUESTION_COUNTS, SECONDS_PER_QUESTION, combineTopics, typesFor, type TopicSummary } from '@/lib/grClassic/topicPlay'
import type { GameType, TeacherClass } from '@/lib/grClassic/types'
import { grcApi } from './teacher/api'
import { Button, ButtonLink, Card, Segmented, Shell, TYPE_META } from './ui'
import { appPath } from './appPath'

// Play by topic: every topic in the shared question library is a ready
// game, and several topics can be combined into one. Pick the topics, the
// game type, how many questions and the time per question, then start. Teachers start a live game for a class ('host');
// students play on their own ('solo'). The questions are drawn at random
// by the server.
export function TopicPicker({ topics, mode, classes = [] }: { topics: TopicSummary[]; mode: 'host' | 'solo'; classes?: TeacherClass[] }) {
  const [picked, setPicked] = useState<string[]>([])
  const [type, setType] = useState<GameType>('quiz')
  const [count, setCount] = useState(10)
  const [seconds, setSeconds] = useState(20)
  const [classId, setClassId] = useState(classes.length === 1 ? classes[0].id : '')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  // The chosen topics, in the order they were picked, as one combined topic.
  const chosen = picked.map((id) => topics.find((t) => t.id === id)).filter((t): t is TopicSummary => !!t)
  const topic = combineTopics(chosen)
  const types = topic ? typesFor(topic) : []
  const available = topic ? topic.counts[type] : 0
  // count 0 = All
  const all = count === 0 || count >= available
  const shownCount = all ? 0 : count
  const race = type !== 'quiz'

  // Tap to add a topic, tap again to take it out.
  const toggle = (t: TopicSummary) => {
    setError('')
    const on = picked.includes(t.id)
    if (!on && picked.length >= MAX_TOPICS) return setError(`Pick at most ${MAX_TOPICS} topics.`)
    const next = on ? picked.filter((id) => id !== t.id) : [...picked, t.id]
    setPicked(next)
    const combined = combineTopics(next.map((id) => topics.find((x) => x.id === id)!))
    if (combined && !typesFor(combined).includes(type)) setType(typesFor(combined)[0])
    // On a phone the settings are below the topics: bring them into view (first pick only).
    if (!on && picked.length === 0) setTimeout(() => document.getElementById('grc-topic-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  const n = all ? available : count
  const query = topic ? `topics=${picked.join(',')}&type=${type}&count=${n}&seconds=${seconds}` : ''
  const soloHref = topic ? `/gr-classic/practice/topic?${query}` : '#'
  // Assigning uses the due date and timer set on the next screen.
  const assignHref = topic ? `/gr-classic/teacher/assign/topic?${query}` : '#'

  const startLive = async () => {
    if (!topic) return
    if (!classId) return setError('Choose the class that is playing.')
    setStarting(true)
    setError('')
    const res = await grcApi<{ sessionId: string }>('/live/topic', { method: 'POST', body: { topics: picked, type, count: n, seconds, classId } })
    if (!res.ok) {
      setStarting(false)
      return setError(res.error)
    }
    // Same site and base path as this page (e.g. /tamizhi).
    window.location.assign(appPath(`/gr-classic/live/${res.data.sessionId}`))
  }

  return (
    <Shell back={{ href: mode === 'host' ? '/gr-classic/teacher' : '/gr-classic/student', label: 'Back' }} width="max-w-5xl">
      <h1 className="text-3xl font-black text-slate-900">{mode === 'host' ? 'Quick live game' : 'Play by topic'}</h1>
      <p className="font-semibold text-slate-600">
        {mode === 'host' ? 'Pick one or more topics, choose how many questions and the time for each, and start — the questions come from the shared library.' : 'Pick one or more topics, choose how many questions and the time for each, and play!'}
      </p>

      {topics.length === 0 ? (
        <p className="mt-6 rounded-3xl border-2 border-dashed border-slate-300 p-8 text-center font-bold text-slate-500">
          {mode === 'host' ? 'The question library is empty — add questions in the Question Library first.' : 'No topics yet — your teachers are adding questions.'}
        </p>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Topics">
          {topics.map((t) => {
            const selected = picked.includes(t.id)
            return (
              <li key={t.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggle(t)}
                  className={`flex h-full w-full flex-col items-start gap-2 rounded-3xl p-4 text-left ring-2 transition hover:-translate-y-0.5 ${selected ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-900 ring-slate-200 hover:ring-slate-400'}`}
                >
                  <span className="flex w-full items-start gap-2">
                    <span className={`min-w-0 flex-1 text-lg font-extrabold leading-snug ${t.id === NO_TOPIC ? 'italic' : ''}`}>{t.name}</span>
                    <span aria-hidden className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-sm font-black ${selected ? 'bg-white text-slate-900' : 'ring-2 ring-slate-300'}`}>{selected ? '✓' : ''}</span>
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {typesFor(t).map((g) => (
                      <span key={g} className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${selected ? 'bg-white/15 text-white' : TYPE_META[g].soft}`}>
                        {t.counts[g]} · {TYPE_META[g].label}
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {topic && (
        <Card className="mt-6 scroll-mt-4 space-y-5 p-5 sm:p-6">
          <div>
            <h2 id="grc-topic-settings" className="scroll-mt-4 text-xl font-black text-slate-900">
              {topic.name}
            </h2>
            <p className="text-sm font-semibold text-slate-500">
              {chosen.length > 1 ? `${chosen.length} topics combined — questions are taken evenly from each.` : 'Tap more topics above to combine them into one game.'}
            </p>
          </div>
          {types.length > 1 && <Segmented label="Game" value={type} onChange={setType} options={types.map((g) => ({ value: g, label: TYPE_META[g].label }))} />}
          <div className="grid gap-5 sm:grid-cols-2">
            <Segmented label="Number of questions" value={shownCount} onChange={setCount} options={[...QUESTION_COUNTS.filter((c) => c < available).map((c) => ({ value: c as number, label: String(c) })), { value: 0, label: `All ${available}` }]} />
            {mode === 'host' && race ? (
              <p className="self-end text-sm font-semibold text-slate-500">{TYPE_META[type].label} is a race when played live: everyone plays at their own pace, so there is no time per question.</p>
            ) : (
              <Segmented label="Time per question" value={seconds} onChange={setSeconds} options={SECONDS_PER_QUESTION.map((s) => ({ value: s as number, label: `${s}s` }))} />
            )}
          </div>
          {mode === 'host' &&
            (classes.length === 0 ? (
              <p className="rounded-2xl bg-amber-50 px-4 py-3 font-bold text-amber-900 ring-1 ring-amber-200">You don’t have any classes yet. Ask the school admin to add you to a class first.</p>
            ) : (
              classes.length > 1 && <Segmented label="Class playing" value={classId} onChange={setClassId} options={classes.map((c) => ({ value: c.id, label: c.name }))} />
            ))}
          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 font-bold text-rose-800 ring-1 ring-rose-200">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {mode === 'host' ? (
              <>
                <Button tone="primary" size="lg" disabled={starting || classes.length === 0} onClick={startLive}>
                  <FiRadio aria-hidden /> {starting ? 'Starting…' : 'Start live game'}
                </Button>
                <ButtonLink tone="teal" size="lg" href={assignHref} prefetch={false}>
                  <FiSend aria-hidden /> Assign to classes
                </ButtonLink>
              </>
            ) : (
              <ButtonLink tone="primary" size="lg" href={soloHref} prefetch={false}>
                <FiPlay aria-hidden /> Start
              </ButtonLink>
            )}
            <span className="text-sm font-semibold text-slate-500">
              {n} {TYPE_META[type].label} {n === 1 ? 'question' : 'questions'}, picked at random{mode === 'host' && race ? '' : ` · ${seconds}s each${mode === 'host' ? ' when live' : ''}`}
            </span>
          </div>
        </Card>
      )}
    </Shell>
  )
}
