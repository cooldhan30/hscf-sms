'use client'

import { useEffect, useMemo, useState } from 'react'
import { FiArrowDown, FiArrowUp, FiCheckCircle, FiTrash2, FiUpload } from 'react-icons/fi'
import { summarize } from '@/lib/grClassic/csv'
import { QUESTION_KIND_FOR_GAME, type Category, type Difficulty, type Game, type GameType, type Question } from '@/lib/grClassic/types'
import { GamePlayer } from '../games/GamePlayer'
import { Advanced, Button, ButtonLink, Card, Segmented, Shell, TYPE_META, countLabel } from '../ui'
import { grcApi } from './api'
import { ImportPanel } from './ImportPanel'
import { QuestionEditor, inputClass, labelClass } from './QuestionEditor'
import { GAME_FOR_KIND, clearPick, peekPick } from './pick'

// Create Game: 1. choose game type -> 2. choose questions -> 3. save or play.
// Questions come from the teacher's library; new ones written here are
// saved to the library too. Everything beyond a name and questions has a
// default and sits under "Advanced options".
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
  const [categories, setCategories] = useState(initialCategories)
  const [categoryId, setCategoryId] = useState<string>(edit?.categoryId ?? start?.topicId ?? '')
  const [library, setLibrary] = useState(initialLibrary)
  const [questions, setQuestions] = useState<Question[]>(edit?.questions ?? start?.chosen ?? [])
  const [difficulty, setDifficulty] = useState<Difficulty>(edit?.difficulty ?? 'easy')
  const [liveSeconds, setLiveSeconds] = useState(edit?.liveSeconds ?? 20)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [importing, setImporting] = useState(false)
  const kind = QUESTION_KIND_FOR_GAME[type]
  const category = categories.find((c) => c.id === categoryId)?.name ?? ''

  const game: Game = { id: edit?.id ?? 'draft', title: title.trim() || 'My new game', type, category, categoryId: categoryId || null, difficulty, questions, liveSeconds, updatedAt: new Date().toISOString() }

  const addToGame = (q: Question) => setQuestions((qs) => (qs.some((x) => x.id === q.id) ? qs : [...qs, q]))
  const addToLibrary = (qs: Question[]) => setLibrary((lib) => [...qs, ...lib.filter((x) => !qs.some((q) => q.id === x.id))])

  const save = async () => {
    if (!title.trim()) return setError('Give your game a name.')
    if (questions.length === 0) return setError('Add at least one question.')
    setError('')
    setSaving(true)
    const body = { title, type, categoryId: categoryId || null, difficulty, liveSeconds, questionIds: questions.map((q) => q.id) }
    const res = edit ? await grcApi<{ id: string }>(`/games/${edit.id}`, { method: 'PATCH', body }) : await grcApi<{ id: string }>('/games', { method: 'POST', body })
    setSaving(false)
    if (!res.ok) return setError(res.error)
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
                    setType(t)
                    setQuestions([])
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
          <Card className="mt-4 grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <label htmlFor="grc-title" className={labelClass}>
                Game name
              </label>
              <input id="grc-title" className={inputClass} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. உயிர் எழுத்துக்கள் வினாடி வினா" />
            </div>
            <CategoryPicker
              value={categoryId}
              categories={categories}
              onChange={setCategoryId}
              onAdded={(c) => {
                setCategories((cs) => (cs.some((x) => x.id === c.id) ? cs : [...cs, c]))
                setCategoryId(c.id)
              }}
            />
          </Card>

          <h2 className="mb-2 mt-6 text-lg font-extrabold text-slate-900">
            Questions in this game <span className="text-slate-400">({questions.length})</span>
          </h2>
          <SelectedList questions={questions} onChange={setQuestions} />

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <LibraryPicker
              library={library.filter((q) => q.kind === kind)}
              others={(Object.keys(TYPE_META) as GameType[]).filter((t) => t !== type).map((t) => ({ type: t, count: library.filter((q) => GAME_FOR_KIND[q.kind] === t).length })).filter((o) => o.count > 0)}
              onSwitchType={edit ? undefined : (t) => {
                setType(t)
                setQuestions([])
              }}
              selected={questions} onToggle={(q) => setQuestions((qs) => (qs.some((x) => x.id === q.id) ? qs.filter((x) => x.id !== q.id) : [...qs, q]))} onImport={() => setImporting((v) => !v)} />
            <Card className="p-5">
              <h3 className="text-lg font-extrabold text-slate-900">Write a new question</h3>
              <p className="mb-3 text-sm text-slate-500">It&apos;s saved to your library too, so you can reuse it.</p>
              <QuestionEditor
                key={type}
                kind={kind}
                categories={categories}
                defaultCategoryId={categoryId || null}
                showTopic={false}
                onSaved={(q) => {
                  addToLibrary([q])
                  addToGame(q)
                }}
              />
            </Card>
          </div>

          {importing && (
            <div className="mt-5">
              <ImportPanel
                kinds={[kind]}
                onClose={() => setImporting(false)}
                onImported={(qs, cats) => {
                  setCategories(cats)
                  addToLibrary(qs)
                  qs.filter((q) => q.kind === kind).forEach(addToGame)
                }}
              />
            </div>
          )}

          <div className="mt-5">
            <Advanced summary={`${difficulty[0].toUpperCase() + difficulty.slice(1)} · ${liveSeconds}s per question when hosted live`}>
              <Segmented label="Difficulty" value={difficulty} onChange={setDifficulty} options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]} />
              <Segmented label="Time per question (live games)" value={liveSeconds} onChange={setLiveSeconds} options={[10, 20, 30, 60].map((s) => ({ value: s, label: `${s}s` }))} />
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
            <Button tone="primary" onClick={save} disabled={saving}>
              <FiCheckCircle aria-hidden /> {saving ? 'Saving…' : 'Save game'}
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

function CategoryPicker({ value, categories, onChange, onAdded }: { value: string; categories: Category[]; onChange: (id: string) => void; onAdded: (c: Category) => void }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const add = async () => {
    const n = name.trim()
    if (!n) return setAdding(false)
    const res = await grcApi<{ category: Category }>('/categories', { method: 'POST', body: { name: n } })
    if (!res.ok) return setError(res.error)
    onAdded(res.data.category)
    setAdding(false)
    setName('')
    setError('')
  }
  return (
    <div>
      <label htmlFor="grc-category" className={labelClass}>
        Topic
      </label>
      {adding ? (
        <>
          <div className="flex gap-2">
            <input autoFocus className={inputClass} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="New topic name" aria-label="New topic name" />
            <Button tone="teal" size="sm" onClick={add}>
              Add
            </Button>
          </div>
          {error && (
            <p role="alert" className="mt-1 text-sm font-bold text-rose-700">
              {error}
            </p>
          )}
        </>
      ) : (
        <select id="grc-category" className={inputClass} value={value} onChange={(e) => (e.target.value === '__new' ? setAdding(true) : onChange(e.target.value))}>
          <option value="">No topic</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="__new">+ New topic…</option>
        </select>
      )}
    </div>
  )
}

function questionLabel(q: Question): string {
  return q.kind === 'choice' ? q.prompt : summarize(q)
}

function SelectedList({ questions, onChange }: { questions: Question[]; onChange: (qs: Question[]) => void }) {
  if (questions.length === 0) {
    return <p className="rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center font-semibold text-slate-500">No questions yet — pick from your library or write a new one below.</p>
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

function LibraryPicker({ library, others, onSwitchType, selected, onToggle, onImport }: { library: Question[]; others: { type: GameType; count: number }[]; onSwitchType?: (t: GameType) => void; selected: Question[]; onToggle: (q: Question) => void; onImport: () => void }) {
  const [search, setSearch] = useState('')
  const items = useMemo(() => library.filter((q) => (questionLabel(q) + q.category).toLowerCase().includes(search.toLowerCase())), [library, search])
  const groups = useMemo(() => Array.from(new Set(items.map((q) => q.category))), [items])
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-extrabold text-slate-900">From your question library</h3>
        <Button tone="ghost" size="sm" onClick={onImport}>
          <FiUpload aria-hidden /> Import CSV
        </Button>
      </div>
      <input className={`${inputClass} mt-3`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions or topics" aria-label="Search the library" />
      <div className="mt-3 max-h-80 space-y-4 overflow-y-auto pr-1">
        {library.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-500">Your library has no questions for this game type yet. Write one, or import a spreadsheet.</p>
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
        {library.length > 0 && groups.length === 0 && <p className="text-sm font-semibold text-slate-500">Nothing matches.</p>}
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
                      <span className="font-semibold text-slate-800">{questionLabel(q)}</span>
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
