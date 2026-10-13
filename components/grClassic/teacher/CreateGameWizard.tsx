'use client'

import { useMemo, useState } from 'react'
import { FiArrowDown, FiArrowUp, FiCheckCircle, FiPlus, FiTrash2, FiUpload } from 'react-icons/fi'
import { STARTER_CATEGORIES } from '@/lib/grClassic/categories'
import { tilesFor } from '@/lib/grClassic/graphemes'
import { LIBRARY } from '@/lib/grClassic/sampleData'
import { QUESTION_KIND_FOR_GAME, type Difficulty, type Game, type GameType, type Question } from '@/lib/grClassic/types'
import { GamePlayer } from '../games/GamePlayer'
import { Advanced, Button, ButtonLink, Card, PrototypeNote, Segmented, Shell, TYPE_META } from '../ui'

const input = 'w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-base font-semibold text-slate-900 ring-2 ring-slate-200 placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-teal-500'
const label = 'mb-1.5 block text-sm font-bold text-slate-700'

// Create Game: 1. choose game type -> 2. choose questions -> 3. save or play.
// Everything beyond a title and questions has a default and sits under
// "Advanced options".
export function CreateGameWizard({ edit }: { edit?: Game }) {
  const [step, setStep] = useState<1 | 2 | 3>(edit ? 2 : 1)
  const [type, setType] = useState<GameType>(edit?.type ?? 'quiz')
  const [title, setTitle] = useState(edit?.title ?? '')
  const [category, setCategory] = useState(edit?.category ?? STARTER_CATEGORIES[0])
  const [categories, setCategories] = useState(STARTER_CATEGORIES)
  const [questions, setQuestions] = useState<Question[]>(edit?.questions ?? [])
  const [difficulty, setDifficulty] = useState<Difficulty>(edit?.difficulty ?? 'easy')
  const [liveSeconds, setLiveSeconds] = useState(edit?.liveSeconds ?? 20)
  const [error, setError] = useState('')
  const [previewing, setPreviewing] = useState(false)

  const game: Game = { id: edit?.id ?? 'draft', title: title.trim() || 'My new game', type, category, difficulty, questions, liveSeconds, updatedAt: new Date().toISOString() }

  const save = () => {
    if (!title.trim()) return setError('Give your game a name.')
    if (questions.length === 0) return setError('Add at least one question.')
    setError('')
    setStep(3)
  }

  if (previewing) return <GamePlayer game={game} mode="preview" exit={{ onClick: () => setPreviewing(false) }} />

  return (
    <Shell back={{ href: '/gr-classic/teacher', label: 'My Games' }} width="max-w-4xl">
      <ol className="mb-6 flex items-center gap-2 text-sm font-bold" aria-label="Steps">
        {['Game type', 'Questions', 'Save or play'].map((s, i) => (
          <li key={s} aria-current={step === i + 1 ? 'step' : undefined} className={`flex items-center gap-2 ${step === i + 1 ? 'text-slate-900' : 'text-slate-400'}`}>
            <span className={`grid h-7 w-7 place-items-center rounded-full ${step > i ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{i + 1}</span>
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
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t)
                    setQuestions([])
                    setStep(2)
                  }}
                  className={`flex flex-col items-start gap-3 rounded-3xl bg-white p-6 text-left ring-2 ring-slate-200 transition hover:-translate-y-1 hover:shadow-lg hover:ring-slate-400`}
                >
                  <span className={`grid h-14 w-14 place-items-center rounded-2xl text-white ${m.band}`}>
                    <Icon aria-hidden className="h-7 w-7" />
                  </span>
                  <span className="text-xl font-black text-slate-900">{m.label}</span>
                  <span className="-mt-2 font-bold text-slate-500">{m.ta}</span>
                  <span className="text-sm font-semibold text-slate-600">{m.blurb}</span>
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
              <label htmlFor="grc-title" className={label}>
                Game name
              </label>
              <input id="grc-title" className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. உயிர் எழுத்துக்கள் வினாடி வினா" />
            </div>
            <CategoryPicker value={category} categories={categories} onChange={setCategory} onAdd={(c) => setCategories((cs) => [...cs, c])} />
          </Card>

          <h2 className="mb-2 mt-6 text-lg font-extrabold text-slate-900">
            Questions in this game <span className="text-slate-400">({questions.length})</span>
          </h2>
          <SelectedList questions={questions} onChange={setQuestions} />

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <LibraryPicker kind={QUESTION_KIND_FOR_GAME[type]} selected={questions} onToggle={(q) => setQuestions((qs) => (qs.some((x) => x.id === q.id) ? qs.filter((x) => x.id !== q.id) : [...qs, q]))} />
            <NewQuestion type={type} category={category} onAdd={(q) => setQuestions((qs) => [...qs, q])} />
          </div>

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
            <Button tone="primary" onClick={save}>
              <FiCheckCircle aria-hidden /> Save game
            </Button>
          </div>
        </>
      )}

      {step === 3 && (
        <Card className="mx-auto max-w-xl p-8 text-center">
          <FiCheckCircle aria-hidden className="mx-auto h-16 w-16 text-emerald-500" />
          <h1 className="mt-3 text-3xl font-black text-slate-900">Game saved!</h1>
          <p className="mt-1 font-semibold text-slate-600">
            “{game.title}” · {questions.length} {type === 'match' ? 'boards' : 'questions'}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Button tone="primary" onClick={() => setPreviewing(true)}>
              Play it
            </Button>
            <ButtonLink tone="indigo" href={`/gr-classic/host/${edit?.id ?? 'g-uyir-quiz'}`}>
              Host live
            </ButtonLink>
            <ButtonLink tone="teal" href={`/gr-classic/teacher/assign/${edit?.id ?? 'g-uyir-quiz'}`}>
              Assign
            </ButtonLink>
          </div>
          <ButtonLink tone="ghost" href="/gr-classic/teacher" className="mt-4">
            Back to My Games
          </ButtonLink>
          <PrototypeNote>the game isn&apos;t stored yet, so Host and Assign open a sample game.</PrototypeNote>
        </Card>
      )}
    </Shell>
  )
}

function CategoryPicker({ value, categories, onChange, onAdd }: { value: string; categories: string[]; onChange: (c: string) => void; onAdd: (c: string) => void }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  return (
    <div>
      <label htmlFor="grc-category" className={label}>
        Topic
      </label>
      {adding ? (
        <div className="flex gap-2">
          <input autoFocus className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="New topic name" aria-label="New topic name" />
          <Button
            tone="teal"
            size="sm"
            onClick={() => {
              const n = name.trim()
              if (n) {
                if (!categories.includes(n)) onAdd(n)
                onChange(n)
              }
              setAdding(false)
              setName('')
            }}
          >
            Add
          </Button>
        </div>
      ) : (
        <select
          id="grc-category"
          className={input}
          value={value}
          onChange={(e) => (e.target.value === '__new' ? setAdding(true) : onChange(e.target.value))}
        >
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
          <option value="__new">+ New topic…</option>
        </select>
      )}
    </div>
  )
}

function questionLabel(q: Question): string {
  if (q.kind === 'choice') return q.prompt
  if (q.kind === 'match') return `${q.prompt} (${q.pairs.map((p) => p.left).join(', ')})`
  return q.answer
}

function SelectedList({ questions, onChange }: { questions: Question[]; onChange: (qs: Question[]) => void }) {
  if (questions.length === 0) {
    return <p className="rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center font-semibold text-slate-500">No questions yet — pick from the library or write a new one below.</p>
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
          <Button tone="ghost" size="sm" aria-label="Remove" onClick={() => onChange(questions.filter((x) => x.id !== q.id))}>
            <FiTrash2 aria-hidden />
          </Button>
        </li>
      ))}
    </ol>
  )
}

function LibraryPicker({ kind, selected, onToggle }: { kind: Question['kind']; selected: Question[]; onToggle: (q: Question) => void }) {
  const [search, setSearch] = useState('')
  const items = useMemo(() => LIBRARY.filter((q) => q.kind === kind && (questionLabel(q) + q.category).toLowerCase().includes(search.toLowerCase())), [kind, search])
  const groups = useMemo(() => Array.from(new Set(items.map((q) => q.category))), [items])
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-extrabold text-slate-900">From the question library</h3>
        <Button tone="ghost" size="sm" disabled title="CSV upload arrives in Phase 2">
          <FiUpload aria-hidden /> CSV
        </Button>
      </div>
      <input className={`${input} mt-3`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions or topics" aria-label="Search the library" />
      <div className="mt-3 max-h-80 space-y-4 overflow-y-auto pr-1">
        {groups.length === 0 && <p className="text-sm font-semibold text-slate-500">Nothing matches.</p>}
        {groups.map((g) => (
          <fieldset key={g}>
            <legend className="mb-1 text-xs font-extrabold uppercase tracking-wide text-slate-500">{g}</legend>
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

function NewQuestion({ type, category, onAdd }: { type: GameType; category: string; onAdd: (q: Question) => void }) {
  return (
    <Card className="p-5">
      <h3 className="text-lg font-extrabold text-slate-900">Write a new question</h3>
      <p className="mb-3 text-sm text-slate-500">It&apos;s saved to your library too, so you can reuse it.</p>
      {type === 'quiz' && <ChoiceForm category={category} onAdd={onAdd} />}
      {type === 'match' && <MatchForm category={category} onAdd={onAdd} />}
      {type === 'word-builder' && <OrderForm category={category} onAdd={onAdd} />}
    </Card>
  )
}

const newId = () => `new-${Math.random().toString(36).slice(2, 9)}`

function ChoiceForm({ category, onAdd }: { category: string; onAdd: (q: Question) => void }) {
  const [prompt, setPrompt] = useState('')
  const [options, setOptions] = useState(['', '', '', ''])
  const [answer, setAnswer] = useState(0)
  const [explanation, setExplanation] = useState('')
  const [error, setError] = useState('')
  const add = () => {
    const filled = options.map((o) => o.trim())
    const kept = filled.filter(Boolean)
    if (!prompt.trim()) return setError('Write the question.')
    if (kept.length < 2) return setError('Give at least two answers.')
    if (!filled[answer]) return setError('Mark which answer is right.')
    onAdd({ id: newId(), kind: 'choice', category, prompt: prompt.trim(), options: kept, answerIndex: kept.indexOf(filled[answer]), explanation: explanation.trim() || undefined })
    setPrompt('')
    setOptions(['', '', '', ''])
    setAnswer(0)
    setExplanation('')
    setError('')
  }
  return (
    <div className="space-y-3">
      <input className={input} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Question" aria-label="Question" />
      <fieldset className="space-y-2">
        <legend className={label}>Answers — tick the right one</legend>
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name="grc-answer" className="h-5 w-5 accent-emerald-600" checked={answer === i} onChange={() => setAnswer(i)} aria-label={`Answer ${i + 1} is right`} />
            <input className={input} value={o} onChange={(e) => setOptions((os) => os.map((x, k) => (k === i ? e.target.value : x)))} placeholder={i < 2 ? `Answer ${i + 1}` : `Answer ${i + 1} (optional)`} aria-label={`Answer ${i + 1}`} />
          </div>
        ))}
      </fieldset>
      <input className={input} value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Why it's right (optional)" aria-label="Explanation" />
      <FormFooter error={error} onAdd={add} />
    </div>
  )
}

function MatchForm({ category, onAdd }: { category: string; onAdd: (q: Question) => void }) {
  const [rows, setRows] = useState([
    ['', ''],
    ['', ''],
    ['', ''],
  ])
  const [error, setError] = useState('')
  const add = () => {
    const pairs = rows.map(([l, r]) => ({ left: l.trim(), right: r.trim() })).filter((p) => p.left && p.right)
    if (pairs.length < 2) return setError('Give at least two pairs.')
    if (new Set(pairs.map((p) => p.right)).size !== pairs.length) return setError('Each partner must be different.')
    onAdd({ id: newId(), kind: 'match', category, prompt: 'பொருத்துக', promptEn: 'Match the pairs', pairs })
    setRows([
      ['', ''],
      ['', ''],
      ['', ''],
    ])
    setError('')
  }
  return (
    <div className="space-y-2">
      {rows.map(([l, r], i) => (
        <div key={i} className="flex items-center gap-2">
          <input className={input} value={l} onChange={(e) => setRows((rs) => rs.map((x, k) => (k === i ? [e.target.value, x[1]] : x)))} placeholder="Item" aria-label={`Item ${i + 1}`} />
          <span aria-hidden className="font-black text-slate-400">↔</span>
          <input className={input} value={r} onChange={(e) => setRows((rs) => rs.map((x, k) => (k === i ? [x[0], e.target.value] : x)))} placeholder="Partner" aria-label={`Partner ${i + 1}`} />
        </div>
      ))}
      {rows.length < 6 && (
        <Button tone="ghost" size="sm" onClick={() => setRows((rs) => [...rs, ['', '']])}>
          <FiPlus aria-hidden /> Another pair
        </Button>
      )}
      <FormFooter error={error} onAdd={add} />
    </div>
  )
}

function OrderForm({ category, onAdd }: { category: string; onAdd: (q: Question) => void }) {
  const [answer, setAnswer] = useState('')
  const [clue, setClue] = useState('')
  const [error, setError] = useState('')
  const unit = answer.trim().includes(' ') ? 'words' : 'letters'
  const tiles = answer.trim() ? tilesFor({ unit, answer }) : []
  const add = () => {
    if (tiles.length < 2) return setError('Type a word (or a sentence) with at least two parts.')
    onAdd({ id: newId(), kind: 'order', category, unit, answer: answer.trim(), prompt: unit === 'letters' ? 'எழுத்துக்களை அடுக்கிச் சொல்லை அமை' : 'சொற்களை அடுக்கி வாக்கியம் அமை', promptEn: clue.trim() || undefined })
    setAnswer('')
    setClue('')
    setError('')
  }
  return (
    <div className="space-y-3">
      <input className={input} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Word or sentence, e.g. கண்ணாடி" aria-label="Word or sentence" />
      <input className={input} value={clue} onChange={(e) => setClue(e.target.value)} placeholder="Clue / meaning (optional), e.g. mirror" aria-label="Clue" />
      {tiles.length > 0 && (
        <div>
          <p className={label}>Students will get these {unit === 'letters' ? 'letter' : 'word'} tiles:</p>
          <ul className="flex flex-wrap gap-2" aria-label="Tile preview">
            {tiles.map((t, i) => (
              <li key={i} className="rounded-xl bg-amber-400 px-3 py-2 text-xl font-extrabold text-amber-950">
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
      <FormFooter error={error} onAdd={add} />
    </div>
  )
}

function FormFooter({ error, onAdd }: { error: string; onAdd: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
      <p role="alert" className="text-sm font-bold text-rose-700">
        {error}
      </p>
      <Button tone="teal" size="sm" onClick={onAdd}>
        <FiPlus aria-hidden /> Add question
      </Button>
    </div>
  )
}
