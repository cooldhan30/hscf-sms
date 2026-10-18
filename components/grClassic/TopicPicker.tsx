'use client'

import { useState } from 'react'
import { FiPlay, FiRadio } from 'react-icons/fi'
import { NO_TOPIC, QUESTION_COUNTS, SECONDS_PER_QUESTION, typesFor, type TopicSummary } from '@/lib/grClassic/topicPlay'
import type { GameType, TeacherClass } from '@/lib/grClassic/types'
import { grcApi } from './teacher/api'
import { Button, ButtonLink, Card, Segmented, Shell, TYPE_META } from './ui'

// Play by topic: every topic in the shared question library is a ready
// game. Pick the topic, the game type, how many questions and the time per
// question, then start. Teachers start a live game for a class ('host');
// students play on their own ('solo'). The questions are drawn at random
// by the server.
export function TopicPicker({ topics, mode, classes = [] }: { topics: TopicSummary[]; mode: 'host' | 'solo'; classes?: TeacherClass[] }) {
  const [topicId, setTopicId] = useState<string | null>(null)
  const [type, setType] = useState<GameType>('quiz')
  const [count, setCount] = useState(10)
  const [seconds, setSeconds] = useState(20)
  const [classId, setClassId] = useState(classes.length === 1 ? classes[0].id : '')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  const topic = topics.find((t) => t.id === topicId) ?? null
  const types = topic ? typesFor(topic) : []
  const available = topic ? topic.counts[type] : 0
  // count 0 = All
  const all = count === 0 || count >= available
  const shownCount = all ? 0 : count
  const race = type !== 'quiz'

  const choose = (t: TopicSummary) => {
    setTopicId(t.id)
    setError('')
    if (!typesFor(t).includes(type)) setType(typesFor(t)[0])
    // On a phone the settings are below the topics: bring them into view.
    setTimeout(() => document.getElementById('grc-topic-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  const n = all ? available : count
  const soloHref = topic ? `/gr-classic/practice/topic?topic=${topic.id}&type=${type}&count=${n}&seconds=${seconds}` : '#'

  const startLive = async () => {
    if (!topic) return
    if (!classId) return setError('Choose the class that is playing.')
    setStarting(true)
    setError('')
    const res = await grcApi<{ sessionId: string }>('/live/topic', { method: 'POST', body: { topic: topic.id, type, count: n, seconds, classId } })
    if (!res.ok) {
      setStarting(false)
      return setError(res.error)
    }
    // Same site and base path as this page (e.g. /tamizhi).
    window.location.assign(`${window.location.pathname.split('/gr-classic')[0]}/gr-classic/live/${res.data.sessionId}`)
  }

  return (
    <Shell back={{ href: mode === 'host' ? '/gr-classic/teacher' : '/gr-classic/student', label: 'Back' }} width="max-w-5xl">
      <h1 className="text-3xl font-black text-slate-900">{mode === 'host' ? 'Quick live game' : 'Play by topic'}</h1>
      <p className="font-semibold text-slate-600">
        {mode === 'host' ? 'Pick a topic, choose how many questions and the time for each, and start — the questions come from the shared library.' : 'Pick a topic, choose how many questions and the time for each, and play!'}
      </p>

      {topics.length === 0 ? (
        <p className="mt-6 rounded-3xl border-2 border-dashed border-slate-300 p-8 text-center font-bold text-slate-500">
          {mode === 'host' ? 'The question library is empty — add questions in the Question Library first.' : 'No topics yet — your teachers are adding questions.'}
        </p>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Topics">
          {topics.map((t) => {
            const selected = t.id === topicId
            return (
              <li key={t.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => choose(t)}
                  className={`flex h-full w-full flex-col items-start gap-2 rounded-3xl p-4 text-left ring-2 transition hover:-translate-y-0.5 ${selected ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-900 ring-slate-200 hover:ring-slate-400'}`}
                >
                  <span className={`text-lg font-extrabold leading-snug ${t.id === NO_TOPIC ? 'italic' : ''}`}>{t.name}</span>
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
          <h2 id="grc-topic-settings" className="scroll-mt-4 text-xl font-black text-slate-900">
            {topic.name}
          </h2>
          {types.length > 1 && <Segmented label="Game" value={type} onChange={setType} options={types.map((g) => ({ value: g, label: TYPE_META[g].label }))} />}
          <div className="grid gap-5 sm:grid-cols-2">
            <Segmented label="Number of questions" value={shownCount} onChange={setCount} options={[...QUESTION_COUNTS.filter((c) => c < available).map((c) => ({ value: c as number, label: String(c) })), { value: 0, label: `All ${available}` }]} />
            {mode === 'host' && race ? (
              <p className="self-end text-sm font-semibold text-slate-500">{TYPE_META[type].label} is a race: everyone plays at their own pace, so there is no time per question.</p>
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
              <Button tone="primary" size="lg" disabled={starting || classes.length === 0} onClick={startLive}>
                <FiRadio aria-hidden /> {starting ? 'Starting…' : 'Start live game'}
              </Button>
            ) : (
              <ButtonLink tone="primary" size="lg" href={soloHref} prefetch={false}>
                <FiPlay aria-hidden /> Start
              </ButtonLink>
            )}
            <span className="text-sm font-semibold text-slate-500">
              {n} {TYPE_META[type].label} {n === 1 ? 'question' : 'questions'}, picked at random{mode === 'host' && race ? '' : ` · ${seconds}s each`}
            </span>
          </div>
        </Card>
      )}
    </Shell>
  )
}
