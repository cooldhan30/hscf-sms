'use client'

import { useEffect, useMemo, useState } from 'react'
import { FiArrowDown, FiArrowUp, FiBookOpen, FiCheckCircle, FiPlay, FiTrash2 } from 'react-icons/fi'
import { summarize } from '@/lib/grClassic/csv'
import { QUESTION_KIND_FOR_GAME, type Category, type Difficulty, type Game, type GameType, type Question } from '@/lib/grClassic/types'
import { GamePlayer } from '../games/GamePlayer'
import { Advanced, Button, ButtonLink, Card, Segmented, Shell, TYPE_META, countLabel } from '../ui'
import { grcApi } from './api'
import { inputClass, labelClass } from './QuestionEditor'
import { GAME_FOR_KIND, clearPick, peekPick } from './pick'
import { appPath } from '../appPath'

// Create Game: 1. choose game type -> 2. choose questions -> 3. save or play.
// Quick setup: pick a topic, how many questions and the time per question,
// and the game fills itself from the shared library. Teachers can also
// hand-pick questions. Questions are only chosen here, never written:
// writing and importing happen in the Question Library.
export function CreateGameWizard({ edit, library: initialLibrary, categories: initialCategories, startType }: { edit?: Game; library: Question[]; categories: Category[]; startType?: GameType }) {
  // Opened from the Question Library ("Make a game with these questions"):
  // start on the Questions step with that type and those questions ticked.
  const [start] = useState(() => {
    if (edit) return null
    const pick = peekPick()
    const type = pick?.type ?? startType
    if (!type) return null
    const ids = pick?.type === type ? pick.ids : []
    const chosen = ids.map((id) => initialLibrary.find((q) => q.id === id)).filter((q): q is Question => !!q && q.kind === QUESTION_KIND_FOR_GAME[type])
    const topics = Array.from(new Set(chosen.map((q) => q.categoryId ?? '')))
    const topicId = topics.length === 1 ? topics[0] : ''
    return { type, chosen, topicId, title: topicId ? (initialCategories.find((c) => c.id === topicId)?.name ?? '') : '' }
  })
  useEffect(() => clearPick(), [])
  const [step, setStep] = useState<1 | 2 | 3>(edit || start ? 2 : 1)
  const [type, setType] = useState<GameType>(edit?.type ?? start?.type ?? 'quiz')
  const [title, setTitle] = useState(edit?.title ?? start?.title ?? '')
  const categories = initialCategories
  const [categoryId, setCategoryId] = useState<string>(edit?.categoryId ?? start?.topicId ?? '')
  const library = initialLibrary
  const [questions, setQuestions] = useState<Question[]>(edit?.questions ?? start?.chosen ?? [])
  const [difficulty, setDifficulty] = useState<Difficulty>(edit?.difficulty ?? 'easy')
  const [liveSeconds, setLiveSeconds] = useState(edit?.liveSeconds ?? 20)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  // Quick setup fills the game while this is on; any hand edit turns it off.
  const [autoFill, setAutoFill] = useState(!edit && !start?.chosen.length)
  const [autoTitle, setAutoTitle] = useState(!edit)
  const [count, setCount] = useState(10) // 0 = all
  const kind = QUESTION_KIND_FOR_GAME[type]
  const category = categories.find((c) => c.id === categoryId)?.name ?? ''

  const poolFor = (topicId: string, t: GameType = type) => library.filter((q) => q.kind === QUESTION_KIND_FOR_GAME[t] && (!topicId || q.categoryId === topicId))
  const pool = poolFor(categoryId)
  const topicCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const q of library) if (q.kind === kind && q.categoryId) m[q.categoryId] = (m[q.categoryId] ?? 0) + 1
    return m
  }, [library, kind])
  const fillFrom = (topicId: string, n: number, t: GameType = type) => {
    const qs = shuffle(poolFor(topicId, t))
    setQuestions(n ? qs.slice(0, n) : qs)
    setAutoFill(true)
  }
  const chooseTopic = (id: string) => {
    setCategoryId(id)
    if (autoTitle) setTitle(id ? (categories.find((c) => c.id === id)?.name ?? '') : '')
    if (autoFill || questions.length === 0) fillFrom(id, count)
  }
  const chooseCount = (n: number) => {
    setCount(n)
    if (autoFill || questions.length === 0) fillFrom(categoryId, n)
  }
  const switchType = (t: GameType) => {
    setType(t)
    setQuestions([])
    setAutoFill(true)
    if (categoryId) fillFrom(categoryId, count, t)
  }
  const pickByHand = (update: (qs: Question[]) => Question[]) => {
    setQuestions(update)
    setAutoFill(false)
  }

  const game: Game = { id: edit?.id ?? 'draft', title: title.trim() || 'My new game', type, category, categoryId: categoryId || null, difficulty, questions, liveSeconds, updatedAt: new Date().toISOString() }


  const save = async (thenHost = false) => {
    if (!title.trim()) return setError('Give your game a name.')
    if (questions.length === 0) return setError('Add at least one question.')
    setError('')
    setSaving(true)
    const body = { title, type, categoryId: categoryId || null, difficulty, liveSeconds, questionIds: questions.map((q) => q.id) }
    const res = edit ? await grcApi<{ id: string }>(`/games/${edit.id}`, { method: 'PATCH', body }) : await grcApi<{ id: string }>('/games', { method: 'POST', body })
    if (!res.ok) {
      setSaving(false)
      return setError(res.error)
    }
    // Same site and base path as this page (e.g. /tamizhi).
    if (thenHost) return window.location.assign(appPath(`/gr-classic/host/${res.data.id}`))
    setSaving(false)
    setSavedId(res.data.id)
    setStep(3)
  }

  if (previewing) return <GamePlayer game={game} play={{ source: 'local', questions }} mode="preview" exit={{ onClick: () => setPreviewing(false) }} />

  return (
    <Shell back={{ href: '/gr-classic/teacher', label: 'My Games' }} width="max-w-4xl">
      <ol className="mb-6 flex items-center gap-2 text-sm font-bold" aria-label="Steps">
        {['Game type', 'Questions', 'Save or play'].map((s, i) => (
          <li key={s} aria-current={step === i + 1 ? 'step' : undefined} className={`flex items-center gap-2 ${step === i + 1 ? 'text-slate-900' : 'text-slate-400'}`}>
            <span className={`grid h-7 w-7 place-items-center rounded-full ${step > i ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-600'}`}>{i + 1}</span>
            <span className="hidden sm:inline">{s}</span>
            {i < 2 && <span aria-hidden className="mx-1 h-0.5 w-6 bg-slate-200" />}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <>
          <h1 className="text-3xl font-black text-slate-900">What kind of game?</h1>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {(Object.keys(TYPE_META) as GameType[]).map((t) => {
              const m = TYPE_META[t]
              const Icon = m.icon
              const n = library.filter((q) => q.kind === QUESTION_KIND_FOR_GAME[t]).length
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    switchType(t)
                    setStep(2)
                  }}
                  className="flex flex-col items-start gap-3 rounded-3xl bg-white p-6 text-left ring-2 ring-slate-200 transition hover:-translate-y-1 hover:shadow-lg hover:ring-slate-400"
                >
                  <span className={`grid h-14 w-14 place-items-center rounded-2xl ${m.band} ${m.bandText}`}>
                    <Icon aria-hidden className="h-7 w-7" />
                  </span>
                  <span className="text-xl font-black text-slate-900">{m.label}</span>
                  <span className="-mt-2 font-bold text-slate-500">{m.ta}</span>
                  <span className="text-sm font-semibold text-slate-600">{m.blurb}</span>
                  <span className="text-xs font-bold text-slate-400">{n} in your library</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-black text-slate-900">{edit ? 'Edit game' : 'Add questions'}</h1>
            {!edit && (
              <Button tone="ghost" size="sm" onClick={() => setStep(1)}>
                Change type ({TYPE_META[type].label})
              </Button>
            )}
          </div>
          <Card className="mt-4 space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <CategoryPicker
                value={categoryId}
                categories={categories}
                counts={topicCounts}
                total={library.filter((q) => q.kind === kind).length}
                onChange={chooseTopic}
              />
              <div>
                <label htmlFor="grc-title" className={labelClass}>
                  Game name
                </label>
                <input
                  id="grc-title"
                  className={inputClass}
                  value={title}
                  maxLength={120}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    setAutoTitle(false)
                  }}
                  placeholder="e.g. உயிர் எழுத்துக்கள் வினாடி வினா"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Segmented
                label="Number of questions"
                value={count === 0 || count >= pool.length ? 0 : count}
                onChange={chooseCount}
                options={[...[5, 10, 15, 20].filter((n) => n < pool.length).map((n) => ({ value: n, label: String(n) })), { value: 0, label: `All ${pool.length}` }]}
              />
              <Segmented label="Time per question (live games)" value={liveSeconds} onChange={setLiveSeconds} options={[10, 20, 30, 60].map((s) => ({ value: s, label: `${s}s` }))} />
            </div>
            <p className="text-sm font-semibold text-slate-500">
              {pool.length === 0
                ? `No ${TYPE_META[type].label} questions ${category ? `in “${category}”` : 'in the library'} yet — add them in the Question Library first.`
                : `${pool.length} ${TYPE_META[type].label} question${pool.length === 1 ? '' : 's'} ${category ? `in “${category}”` : 'across all topics'} in the shared library. Choosing a topic or a number fills the game for you.`}
            </p>
          </Card>

          <h2 className="mb-2 mt-6 text-lg font-extrabold text-slate-900">
            Questions in this game <span className="text-slate-400">({questions.length})</span>
          </h2>
          <SelectedList questions={questions} onChange={(qs) => pickByHand(() => qs)} />

          <h2 className="mb-2 mt-8 text-lg font-extrabold text-slate-900">Or pick questions yourself</h2>

          <div>
            <LibraryPicker
              library={library.filter((q) => q.kind === kind)}
              topicId={categoryId}
              topicName={category}
              others={(Object.keys(TYPE_META) as GameType[]).filter((t) => t !== type).map((t) => ({ type: t, count: library.filter((q) => GAME_FOR_KIND[q.kind] === t).length })).filter((o) => o.count > 0)}
              onSwitchType={edit ? undefined : switchType}
              selected={questions}
              onToggle={(q) => pickByHand((qs) => (qs.some((x) => x.id === q.id) ? qs.filter((x) => x.id !== q.id) : [...qs, q]))}
            />
          </div>

          <div className="mt-5">
            <Advanced summary={`Difficulty: ${difficulty[0].toUpperCase() + difficulty.slice(1)}`}>
              <Segmented label="Difficulty" value={difficulty} onChange={setDifficulty} options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]} />
            </Advanced>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 font-bold text-rose-800 ring-1 ring-rose-200">
              {error}
            </p>
          )}
          <div className="sticky bottom-3 z-20 mt-6 flex flex-wrap justify-end gap-3 rounded-3xl bg-white/90 p-3 shadow-lg ring-1 ring-slate-200 backdrop-blur">
            <Button tone="plain" disabled={questions.length === 0} onClick={() => setPreviewing(true)}>
              Try it
            </Button>
            <Button tone="indigo" onClick={() => save(false)} disabled={saving}>
              <FiCheckCircle aria-hidden /> {saving ? 'Saving…' : 'Save game'}
            </Button>
            <Button tone="primary" onClick={() => save(true)} disabled={saving}>
              <FiPlay aria-hidden /> Save &amp; host live
            </Button>
          </div>
        </>
      )}

      {step === 3 && savedId && (
        <Card className="mx-auto max-w-xl p-8 text-center">
          <FiCheckCircle aria-hidden className="mx-auto h-16 w-16 text-emerald-500" />
          <h1 className="mt-3 text-3xl font-black text-slate-900">Game saved!</h1>
          <p className="mt-1 font-semibold text-slate-600">
            “{game.title}” · {countLabel(questions.length, type)}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <ButtonLink tone="primary" href={`/gr-classic/play/${savedId}?mode=preview`}>
              Play it
            </ButtonLink>
            <ButtonLink tone="indigo" prefetch={false} href={`/gr-classic/host/${savedId}`}>
              Host live
            </ButtonLink>
            <ButtonLink tone="teal" href={`/gr-classic/teacher/assign/${savedId}`}>
              Assign
            </ButtonLink>
          </div>
          <ButtonLink tone="ghost" href="/gr-classic/teacher" className="mt-4">
            Back to My Games
          </ButtonLink>
        </Card>
      )}
    </Shell>
  )
}

// Topics that have questions for this game type, each with how many questions of this game type it has.
function CategoryPicker({ value, categories, counts, total, onChange }: { value: string; categories: Category[]; counts: Record<string, number>; total: number; onChange: (id: string) => void }) {
  return (
    <div>
      <label htmlFor="grc-category" className={labelClass}>
        Topic
      </label>
      <select id="grc-category" className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Any topic ({total})</option>
        {categories.filter((c) => counts[c.id] || c.id === value).map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({counts[c.id] ?? 0})
          </option>
        ))}
      </select>
    </div>
  )
}

function questionLabel(q: Question): string {
  return q.kind === 'choice' ? q.prompt : summarize(q)
}

function SelectedList({ questions, onChange }: { questions: Question[]; onChange: (qs: Question[]) => void }) {
  if (questions.length === 0) {
    return <p className="rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center font-semibold text-slate-500">No questions yet — choose a topic above, or pick questions below.</p>
  }
  const move = (i: number, d: -1 | 1) => {
    const qs = questions.slice()
    ;[qs[i], qs[i + d]] = [qs[i + d], qs[i]]
    onChange(qs)
  }
  return (
    <ol className="space-y-2">
      {questions.map((q, i) => (
        <li key={q.id} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-900 text-sm font-extrabold text-white">{i + 1}</span>
          <span className="min-w-0 flex-1 truncate font-bold text-slate-800">{questionLabel(q)}</span>
          <Button tone="ghost" size="sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
            <FiArrowUp aria-hidden />
          </Button>
          <Button tone="ghost" size="sm" aria-label="Move down" disabled={i === questions.length - 1} onClick={() => move(i, 1)}>
            <FiArrowDown aria-hidden />
          </Button>
          <Button tone="ghost" size="sm" aria-label="Remove from game" onClick={() => onChange(questions.filter((x) => x.id !== q.id))}>
            <FiTrash2 aria-hidden />
          </Button>
        </li>
      ))}
    </ol>
  )
}

function LibraryPicker({ library, topicId, topicName, others, onSwitchType, selected, onToggle }: { library: Question[]; topicId: string; topicName: string; others: { type: GameType; count: number }[]; onSwitchType?: (t: GameType) => void; selected: Question[]; onToggle: (q: Question) => void }) {
  const [search, setSearch] = useState('')
  const [allTopics, setAllTopics] = useState(false)
  const inTopic = !!topicId && !allTopics
  const items = useMemo(() => library.filter((q) => (!inTopic || q.categoryId === topicId) && (questionLabel(q) + q.category).toLowerCase().includes(search.toLowerCase())), [library, search, inTopic, topicId])
  const groups = useMemo(() => Array.from(new Set(items.map((q) => q.category))), [items])
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-extrabold text-slate-900">From the shared question library</h3>
        <ButtonLink tone="ghost" size="sm" href="/gr-classic/teacher/library">
          <FiBookOpen aria-hidden /> Question Library
        </ButtonLink>
      </div>
      <input className={`${inputClass} mt-3`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions or topics" aria-label="Search the library" />
      {topicId && (
        <p className="mt-2 text-sm font-semibold text-slate-500">
          {inTopic ? `Showing “${topicName}” only. ` : 'Showing every topic. '}
          <button type="button" className="font-bold text-teal-700 underline underline-offset-2" onClick={() => setAllTopics((v) => !v)}>
            {inTopic ? 'Show all topics' : `Only “${topicName}”`}
          </button>
        </p>
      )}
      <div className="mt-3 max-h-[28rem] space-y-4 overflow-y-auto pr-1">
        {library.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-500">The library has no questions for this game type yet. Add them in the Question Library first.</p>
            {others.length > 0 && onSwitchType && (
              <div className="rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
                <p className="text-sm font-bold text-amber-900">Each game type uses its own kind of question. You have:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {others.map((o) => (
                    <Button key={o.type} tone="plain" size="sm" onClick={() => onSwitchType(o.type)}>
                      {o.count} for {TYPE_META[o.type].label} — switch
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {library.length > 0 && groups.length === 0 && <p className="text-sm font-semibold text-slate-500">{inTopic && !search ? 'No questions in this topic yet.' : 'Nothing matches.'}</p>}
        {groups.map((g) => (
          <fieldset key={g || 'none'}>
            <legend className="mb-1 text-xs font-extrabold uppercase tracking-wide text-slate-500">{g || 'No topic'}</legend>
            <ul className="space-y-1">
              {items
                .filter((q) => q.category === g)
                .map((q) => (
                  <li key={q.id}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2 hover:bg-slate-50">
                      <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-teal-600" checked={selected.some((x) => x.id === q.id)} onChange={() => onToggle(q)} />
                      <span className="font-semibold text-slate-800">
                        {questionLabel(q)}
                        {q.mine === false && <span className="ml-1 text-xs font-semibold text-slate-500">· by {q.author}</span>}
                      </span>
                    </label>
                  </li>
                ))}
            </ul>
          </fieldset>
        ))}
      </div>
    </Card>
  )
}

function shuffle<T>(items: T[]): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
