'use client'

import { useEffect, useRef, useState } from 'react'
import { FiArchive, FiEdit2, FiPlus, FiUpload } from 'react-icons/fi'
import { summarize } from '@/lib/grClassic/csv'
import type { Category, Question, QuestionKind } from '@/lib/grClassic/types'
import { Button, ButtonLink, Card, Pill, Shell } from '../ui'
import { grcApi } from './api'
import { ImportPanel } from './ImportPanel'
import { KIND_LABEL, QuestionEditor, inputClass } from './QuestionEditor'
import { GAME_FOR_KIND, savePick } from './pick'

const KINDS: QuestionKind[] = ['choice', 'match', 'order']
const TAB_LABEL: Record<QuestionKind, string> = { choice: 'Quiz', match: 'Matching', order: 'Word Builder' }

type Page = { kind: QuestionKind; questions: Question[]; total: number }

// The shared question library, one page at a time (it is far too big to
// load at once): the server sends the questions that match the type tab,
// topic, "only mine" and search, newest first, and "Load more" fetches the
// next page.
export function QuestionLibrary({ first, counts: initialCounts, categories: initialCategories }: { first: Page; counts: Record<QuestionKind, number>; categories: Category[] }) {
  const [questions, setQuestions] = useState(first.questions)
  const [total, setTotal] = useState(first.total)
  const [counts, setCounts] = useState(initialCounts)
  const [categories, setCategories] = useState(initialCategories)
  const [kind, setKind] = useState<QuestionKind>(first.kind)
  const [search, setSearch] = useState('')
  const [topic, setTopic] = useState('')
  const [onlyMine, setOnlyMine] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [panel, setPanel] = useState<'none' | 'add' | 'import'>('none')
  const [editing, setEditing] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [justImported, setJustImported] = useState<Question[]>([])

  // Fetch a page from the server. Replies to older requests (the teacher
  // kept typing or switched tabs) are ignored.
  const latest = useRef(0)
  const load = async (append: boolean) => {
    const ask = ++latest.current
    setLoading(true)
    setLoadError('')
    const params = new URLSearchParams({ kind, topic, q: search.trim(), offset: String(append ? questions.length : 0) })
    if (onlyMine) params.set('mine', '1')
    const res = await grcApi<{ questions: Question[]; total: number }>(`/questions?${params}`)
    if (ask !== latest.current) return
    setLoading(false)
    if (!res.ok) return setLoadError(res.error)
    setQuestions((qs) => (append ? [...qs, ...res.data.questions.filter((q) => !qs.some((x) => x.id === q.id))] : res.data.questions))
    setTotal(res.data.total)
  }
  // New filters: start again from the first page (search waits for a pause in typing).
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    const t = setTimeout(() => load(false), search ? 300 : 0)
    return () => clearTimeout(t)
  }, [kind, topic, onlyMine, search]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = questions

  const saved = (q: Question, duplicate: boolean) => {
    const isNew = !editing && !duplicate && !questions.some((x) => x.id === q.id)
    if (q.kind === kind) setQuestions((qs) => [q, ...qs.filter((x) => x.id !== q.id)])
    if (isNew) {
      setCounts((c) => ({ ...c, [q.kind]: c[q.kind] + 1 }))
      if (q.kind === kind) setTotal((n) => n + 1)
    }
    setEditing(null)
    setNotice(duplicate ? `That question is already in the shared library${q.mine ? '' : ` (by ${q.author})`} — nothing new was added.` : editing ? 'Saved. Games that use this question now show the new version.' : 'Question added to your library.')
  }

  const archive = async (id: string) => {
    const res = await grcApi(`/questions/${id}`, { method: 'DELETE' })
    setConfirmArchive(null)
    if (!res.ok) return setNotice(res.error)
    setQuestions((qs) => qs.filter((q) => q.id !== id))
    setTotal((n) => Math.max(0, n - 1))
    setCounts((c) => ({ ...c, [kind]: Math.max(0, c[kind] - 1) }))
    setNotice('Question archived. Games that already use it keep working.')
  }

  return (
    <Shell back={{ href: '/gr-classic/teacher', label: 'My Games' }} width="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Question Library</h1>
          <p className="font-semibold text-slate-600">Shared by all teachers — write a question once, and anyone can use it in their games.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button tone="plain" onClick={() => setPanel(panel === 'import' ? 'none' : 'import')}>
            <FiUpload aria-hidden /> Import CSV
          </Button>
          <Button tone="primary" onClick={() => setPanel(panel === 'add' ? 'none' : 'add')}>
            <FiPlus aria-hidden /> Add question
          </Button>
        </div>
      </div>

      {notice && (
        <p role="status" className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white">
          {notice}
          <button type="button" className="text-sm font-bold text-white/80 hover:text-white" onClick={() => setNotice('')}>
            Dismiss
          </button>
        </p>
      )}

      {panel === 'import' && (
        <div className="mt-5">
          <ImportPanel
            onClose={() => setPanel('none')}
            onImported={(qs, cats) => {
              setCategories(cats)
              setJustImported(qs)
              setCounts((c) => {
                const next = { ...c }
                for (const q of qs) next[q.kind] += 1
                return next
              })
              // Show the newest first: same type tab, all topics, no search.
              if (qs[0] && qs[0].kind !== kind) setKind(qs[0].kind)
              else load(false)
            }}
          />
        </div>
      )}

      {justImported.length > 0 && (
        <Card className="mt-5 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="font-bold text-slate-800">
            Imported {justImported.length} {TAB_LABEL[justImported[0].kind].toLowerCase()} question{justImported.length === 1 ? '' : 's'}. Ready to play them?
          </p>
          <MakeGameLink kind={justImported[0].kind} questions={justImported.filter((q) => q.kind === justImported[0].kind)} label={`Make a game with ${justImported.length === 1 ? 'it' : `these ${justImported.length}`}`} />
        </Card>
      )}

      <div role="tablist" aria-label="Question types" className="mt-6 flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={kind === k}
            onClick={() => {
              setKind(k)
              setEditing(null)
            }}
            className={`rounded-2xl px-4 py-2.5 font-extrabold ring-2 transition ${kind === k ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200 hover:ring-slate-300'}`}
          >
            {TAB_LABEL[k]} <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${kind === k ? 'bg-white text-slate-900' : 'bg-slate-100'}`}>{counts[k].toLocaleString()}</span>
          </button>
        ))}
      </div>

      {panel === 'add' && (
        <Card className="mt-5 p-5">
          <h2 className="mb-3 text-lg font-extrabold text-slate-900">New {KIND_LABEL[kind].toLowerCase()}</h2>
          <QuestionEditor key={kind} kind={kind} categories={categories} defaultCategoryId={topic || null} onSaved={saved} onCancel={() => setPanel('none')} />
        </Card>
      )}

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Whose questions">
        {[
          { mine: false, label: 'All teachers' },
          { mine: true, label: 'Only mine' },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            aria-pressed={onlyMine === o.mine}
            onClick={() => setOnlyMine(o.mine)}
            className={`rounded-xl px-3.5 py-2 text-sm font-bold ring-2 transition ${onlyMine === o.mine ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200 hover:ring-slate-300'}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_16rem]">
        <input className={inputClass} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions (Tamil or English)" aria-label="Search questions" />
        <select className={inputClass} value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Filter by topic">
          <option value="">All topics</option>
          <option value="none">No topic</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-4 text-sm font-semibold text-slate-500" aria-live="polite">
        {loading && shown.length === 0 ? 'Loading…' : `${total.toLocaleString()} question${total === 1 ? '' : 's'}${search.trim() || topic || onlyMine ? ' match' : ''}${shown.length < total ? ` · showing ${shown.length.toLocaleString()}` : ''}`}
      </p>
      {loadError && (
        <p role="alert" className="mt-2 rounded-xl bg-rose-50 px-4 py-3 font-bold text-rose-800 ring-1 ring-rose-200">
          {loadError}
        </p>
      )}

      <ul className={`mt-3 space-y-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
        {shown.length === 0 && !loading && (
          <li className="rounded-3xl border-2 border-dashed border-slate-300 p-8 text-center font-bold text-slate-500">
            {counts[kind] > 0 ? (onlyMine && !search.trim() && !topic ? 'You haven’t written any of these yet — switch to “All teachers” to see everyone’s.' : 'No questions match.') : `No ${TAB_LABEL[kind].toLowerCase()} questions yet — add one or import a spreadsheet.`}
          </li>
        )}
        {shown.map((q) => (
          <li key={q.id}>
            <Card className="p-4 sm:p-5">
              {editing === q.id ? (
                <>
                  {q.mine === false && (
                    <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                      {q.author} wrote this question. Your changes also update every game that uses it.
                    </p>
                  )}
                  <QuestionEditor kind={q.kind} initial={q} categories={categories} onSaved={saved} onCancel={() => setEditing(null)} />
                </>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold leading-snug text-slate-900">{q.kind === 'choice' ? q.prompt : summarize(q)}</p>
                    {q.kind === 'choice' && (
                      <p className="mt-1 text-sm text-slate-600">
                        {q.options.map((o, i) => (
                          <span key={i} className={i === q.answerIndex ? 'font-extrabold text-emerald-700' : ''}>
                            {i > 0 && ' · '}
                            {o}
                            {i === q.answerIndex && ' ✓'}
                          </span>
                        ))}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {q.author && <Pill tone={q.mine ? 'green' : 'slate'}>by {q.author}</Pill>}
                      {q.category && <Pill>{q.category}</Pill>}
                      {q.difficulty && q.difficulty !== 'easy' && <Pill tone="amber">{q.difficulty}</Pill>}
                      {q.promptEn && <Pill tone="blue">English: {q.promptEn}</Pill>}
                    </div>
                  </div>
                  {confirmArchive === q.id ? (
                    <div className="flex items-center gap-2" role="group" aria-label="Confirm archive">
                      <span className="text-sm font-bold text-slate-700">Archive this question?</span>
                      <Button tone="primary" size="sm" onClick={() => archive(q.id)}>
                        Archive
                      </Button>
                      <Button tone="plain" size="sm" onClick={() => setConfirmArchive(null)}>
                        Keep
                      </Button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 gap-1">
                      <Button tone="ghost" size="sm" onClick={() => setEditing(q.id)}>
                        <FiEdit2 aria-hidden /> Edit
                      </Button>
                      <Button tone="ghost" size="sm" onClick={() => setConfirmArchive(q.id)}>
                        <FiArchive aria-hidden /> Archive
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>

      {shown.length < total && (
        <div className="mt-5 text-center">
          <Button tone="plain" onClick={() => load(true)} disabled={loading}>
            {loading ? 'Loading…' : `Load more (${(total - shown.length).toLocaleString()} more)`}
          </Button>
        </div>
      )}

      {shown.length > 0 && (
        <div className="mt-8 text-center">
          <MakeGameLink kind={kind} questions={shown.slice(0, 100)} label={`Make a ${TAB_LABEL[kind]} game with ${shown.length === 1 ? 'this question' : `these ${Math.min(shown.length, 100)} questions`}`} />
          <p className="mt-2 text-sm font-semibold text-slate-500">You can add or remove questions on the next screen. For a game from whole topics, use Quick live game.</p>
        </div>
      )}
    </Shell>
  )
}

// Opens Create Game on the right game type with these questions ticked.
function MakeGameLink({ kind, questions, label }: { kind: QuestionKind; questions: Question[]; label: string }) {
  const type = GAME_FOR_KIND[kind]
  return (
    <ButtonLink href={`/gr-classic/teacher/create?type=${type}`} tone="primary" onClick={() => savePick({ type, ids: questions.map((q) => q.id) })}>
      {label}
    </ButtonLink>
  )
}
