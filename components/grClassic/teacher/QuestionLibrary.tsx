'use client'

import { useMemo, useState } from 'react'
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

// The teacher's question library: every question they've written or
// imported, ready to reuse in any game of the matching type.
export function QuestionLibrary({ questions: initial, categories: initialCategories }: { questions: Question[]; categories: Category[] }) {
  const [questions, setQuestions] = useState(initial)
  const [categories, setCategories] = useState(initialCategories)
  const [kind, setKind] = useState<QuestionKind>(() => KINDS.find((k) => initial.some((q) => q.kind === k)) ?? 'choice')
  const [search, setSearch] = useState('')
  const [topic, setTopic] = useState('')
  const [panel, setPanel] = useState<'none' | 'add' | 'import'>('none')
  const [editing, setEditing] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [justImported, setJustImported] = useState<Question[]>([])

  const shown = useMemo(() => {
    const s = search.trim().toLocaleLowerCase()
    return questions.filter((q) => q.kind === kind && (!topic || q.categoryId === topic) && (!s || `${summarize(q)} ${q.prompt} ${q.promptEn ?? ''} ${q.category}`.toLocaleLowerCase().includes(s)))
  }, [questions, kind, topic, search])

  const saved = (q: Question, duplicate: boolean) => {
    setQuestions((qs) => [q, ...qs.filter((x) => x.id !== q.id)])
    setEditing(null)
    setNotice(duplicate ? 'You already had that question — nothing new was added.' : editing ? 'Saved. Games that use this question now show the new version.' : 'Question added to your library.')
  }

  const archive = async (id: string) => {
    const res = await grcApi(`/questions/${id}`, { method: 'DELETE' })
    setConfirmArchive(null)
    if (!res.ok) return setNotice(res.error)
    setQuestions((qs) => qs.filter((q) => q.id !== id))
    setNotice('Question archived. Games that already use it keep working.')
  }

  return (
    <Shell back={{ href: '/gr-classic/teacher', label: 'My Games' }} width="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Question Library</h1>
          <p className="font-semibold text-slate-600">Write a question once, use it in any game.</p>
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
              setQuestions((all) => [...qs, ...all])
              setCategories(cats)
              setJustImported(qs)
              if (qs[0]) setKind(qs[0].kind)
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
            {TAB_LABEL[k]} <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${kind === k ? 'bg-white text-slate-900' : 'bg-slate-100'}`}>{questions.filter((q) => q.kind === k).length}</span>
          </button>
        ))}
      </div>

      {panel === 'add' && (
        <Card className="mt-5 p-5">
          <h2 className="mb-3 text-lg font-extrabold text-slate-900">New {KIND_LABEL[kind].toLowerCase()}</h2>
          <QuestionEditor key={kind} kind={kind} categories={categories} defaultCategoryId={topic || null} onSaved={saved} onCancel={() => setPanel('none')} />
        </Card>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_16rem]">
        <input className={inputClass} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your questions" aria-label="Search questions" />
        <select className={inputClass} value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Filter by topic">
          <option value="">All topics</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <ul className="mt-4 space-y-3">
        {shown.length === 0 && (
          <li className="rounded-3xl border-2 border-dashed border-slate-300 p-8 text-center font-bold text-slate-500">
            {questions.some((q) => q.kind === kind) ? 'No questions match.' : `No ${TAB_LABEL[kind].toLowerCase()} questions yet — add one or import a spreadsheet.`}
          </li>
        )}
        {shown.map((q) => (
          <li key={q.id}>
            <Card className="p-4 sm:p-5">
              {editing === q.id ? (
                <QuestionEditor kind={q.kind} initial={q} categories={categories} onSaved={saved} onCancel={() => setEditing(null)} />
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

      {shown.length > 0 && (
        <div className="mt-8 text-center">
          <MakeGameLink kind={kind} questions={shown} label={`Make a ${TAB_LABEL[kind]} game with ${shown.length === 1 ? 'this question' : `these ${shown.length} questions`}`} />
          <p className="mt-2 text-sm font-semibold text-slate-500">You can add or remove questions on the next screen.</p>
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
