'use client'

import { useState } from 'react'
import { FiPlus, FiTrash2 } from 'react-icons/fi'
import { tilesFor } from '@/lib/grClassic/graphemes'
import { validateQuestion, type QuestionInput } from '@/lib/grClassic/validateQuestion'
import type { Category, Difficulty, Question, QuestionKind } from '@/lib/grClassic/types'
import { Button, Segmented } from '../ui'
import { grcApi } from './api'

export const inputClass = 'w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-base font-semibold text-slate-900 ring-2 ring-slate-200 placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-teal-500'
export const labelClass = 'mb-1.5 block text-sm font-bold text-slate-700'

export const KIND_LABEL: Record<QuestionKind, string> = { choice: 'Quiz question', match: 'Matching pairs', order: 'Word Builder' }

// Write or edit one question. Saves straight to the teacher's library
// (POST, or PATCH when editing) and hands the saved question back.
export function QuestionEditor({
  kind,
  initial,
  categories,
  defaultCategoryId,
  showTopic = true,
  onSaved,
  onCancel,
}: {
  kind: QuestionKind
  initial?: Question
  categories: Category[]
  defaultCategoryId?: string | null
  showTopic?: boolean
  onSaved: (q: Question, duplicate: boolean) => void
  onCancel?: () => void
}) {
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId ?? defaultCategoryId ?? '')
  const [prompt, setPrompt] = useState(initial?.kind === 'order' || initial?.kind === 'match' ? '' : (initial?.prompt ?? ''))
  const [promptEn, setPromptEn] = useState(initial?.promptEn ?? '')
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? 'easy')
  const [options, setOptions] = useState<string[]>(() => {
    const o = initial?.kind === 'choice' ? initial.options : []
    return [0, 1, 2, 3].map((i) => o[i] ?? '')
  })
  const [answerIndex, setAnswerIndex] = useState(initial?.kind === 'choice' ? initial.answerIndex : 0)
  const [explanation, setExplanation] = useState(initial?.kind === 'choice' ? (initial.explanation ?? '') : '')
  const [instruction, setInstruction] = useState(initial?.kind === 'match' ? initial.prompt : '')
  const [pairs, setPairs] = useState<{ left: string; right: string }[]>(() => {
    const p = initial?.kind === 'match' ? initial.pairs : []
    return p.length ? p : [0, 1, 2].map(() => ({ left: '', right: '' }))
  })
  const [answer, setAnswer] = useState(initial?.kind === 'order' ? initial.answer : '')
  const [hint, setHint] = useState(initial?.kind === 'order' ? (initial.hint ?? '') : '')
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const unit = answer.trim().includes(' ') ? 'words' : 'letters'
  const tiles = kind === 'order' && answer.trim() ? tilesFor({ unit, answer }) : []

  const input = (): QuestionInput => {
    const common = { kind, categoryId: categoryId || null, promptEn, difficulty }
    if (kind === 'choice') return { ...common, prompt, options, answerIndex, explanation }
    if (kind === 'match') return { ...common, prompt: instruction, pairs }
    return { ...common, answer, hint, unit }
  }

  const save = async () => {
    const v = validateQuestion(input())
    if (!v.ok) return setErrors(v.errors)
    setSaving(true)
    setErrors([])
    const res = initial
      ? await grcApi<{ question: Question }>(`/questions/${initial.id}`, { method: 'PATCH', body: input() })
      : await grcApi<{ question: Question; duplicate?: boolean }>('/questions', { method: 'POST', body: input() })
    setSaving(false)
    if (!res.ok) return setErrors([res.error])
    onSaved(res.data.question, 'duplicate' in res.data && Boolean(res.data.duplicate))
    if (!initial) {
      setPrompt('')
      setPromptEn('')
      setOptions(['', '', '', ''])
      setAnswerIndex(0)
      setExplanation('')
      setInstruction('')
      setPairs([0, 1, 2].map(() => ({ left: '', right: '' })))
      setAnswer('')
      setHint('')
    }
  }

  return (
    <div className="space-y-3">
      {kind === 'choice' && (
        <>
          <input className={inputClass} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Question" aria-label="Question" />
          <fieldset className="space-y-2">
            <legend className={labelClass}>Answers — tick the right one</legend>
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name={`grc-answer-${initial?.id ?? 'new'}`} className="h-5 w-5 shrink-0 accent-emerald-600" checked={answerIndex === i} onChange={() => setAnswerIndex(i)} aria-label={`Answer ${i + 1} is right`} />
                <input className={inputClass} value={o} onChange={(e) => setOptions((os) => os.map((x, k) => (k === i ? e.target.value : x)))} placeholder={i < 2 ? `Answer ${i + 1}` : `Answer ${i + 1} (optional)`} aria-label={`Answer ${i + 1}`} />
              </div>
            ))}
          </fieldset>
          <input className={inputClass} value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Why it's right (optional)" aria-label="Explanation" />
        </>
      )}

      {kind === 'match' && (
        <>
          <input className={inputClass} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Instruction (optional), e.g. சொல்லையும் பொருளையும் பொருத்துக" aria-label="Instruction" />
          {pairs.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className={inputClass} value={p.left} onChange={(e) => setPairs((ps) => ps.map((x, k) => (k === i ? { ...x, left: e.target.value } : x)))} placeholder="Item" aria-label={`Item ${i + 1}`} />
              <span aria-hidden className="font-black text-slate-400">↔</span>
              <input className={inputClass} value={p.right} onChange={(e) => setPairs((ps) => ps.map((x, k) => (k === i ? { ...x, right: e.target.value } : x)))} placeholder="Partner" aria-label={`Partner ${i + 1}`} />
              {pairs.length > 2 && (
                <Button tone="ghost" size="sm" aria-label={`Remove pair ${i + 1}`} onClick={() => setPairs((ps) => ps.filter((_, k) => k !== i))}>
                  <FiTrash2 aria-hidden />
                </Button>
              )}
            </div>
          ))}
          {pairs.length < 6 && (
            <Button tone="ghost" size="sm" onClick={() => setPairs((ps) => [...ps, { left: '', right: '' }])}>
              <FiPlus aria-hidden /> Another pair
            </Button>
          )}
        </>
      )}

      {kind === 'order' && (
        <>
          <input className={inputClass} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Word or sentence, e.g. கண்ணாடி" aria-label="Word or sentence" />
          <input className={inputClass} value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Hint for practice (optional)" aria-label="Hint" />
          {tiles.length > 0 && (
            <div>
              <p className={labelClass}>Students will get these {unit === 'letters' ? 'letter' : 'word'} tiles:</p>
              <ul className="flex flex-wrap gap-2" aria-label="Tile preview">
                {tiles.map((t, i) => (
                  <li key={i} className="rounded-xl bg-amber-400 px-3 py-2 text-xl font-extrabold text-amber-950">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <input className={inputClass} value={promptEn} onChange={(e) => setPromptEn(e.target.value)} placeholder={kind === 'order' ? 'Clue / meaning in English (optional), e.g. mirror' : 'English version (optional)'} aria-label="English text" />

      <div className="grid gap-3 sm:grid-cols-2">
        {showTopic && (
          <label className="block">
            <span className={labelClass}>Topic</span>
            <select className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">No topic</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <Segmented label="Difficulty" value={difficulty} onChange={setDifficulty} options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]} />
      </div>

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800 ring-1 ring-rose-200">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        {onCancel && (
          <Button tone="plain" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button tone="teal" size="sm" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Save changes' : (
            <>
              <FiPlus aria-hidden /> Add question
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
