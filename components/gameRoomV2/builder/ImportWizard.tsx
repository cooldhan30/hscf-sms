'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from '@/lib/toast'
import { FiUploadCloud, FiDownload, FiAlertTriangle, FiCheckCircle, FiEdit2, FiTrash2, FiArrowLeft, FiArrowRight, FiPlayCircle, FiX } from 'react-icons/fi'
import { Card, primaryLinkButton, secondaryLinkButton } from '@/components/gameRoomV2/shell/ui'
import { TamilTextInput, TamilTextArea } from './TamilTextInput'
import { GAME_ENGINES_V2 } from '@/lib/gameRoomV2/registry'
import { checkEngineCompatibility, type GameRoomQuestionType } from '@/lib/gameRoomV2/domain'
import {
  IMPORT_LIMITS,
  CSV_TEMPLATE,
  TXT_TEMPLATE,
  buildQuestion,
  checkRows,
  decodeImportBytes,
  formatForFileName,
  parseImport,
  payloadProblems,
  type AnswerStyle,
  type ImportFormat,
  type ImportRow,
} from '@/lib/gameRoomV2/import/questionImport'

// Teacher question-set import: upload a .txt or .csv -> preview and fix
// -> name the set -> CREATE QUESTION SET. The result is saved through the
// same POST /api/gameroom-v2/question-sets the Builder uses (teacher
// guard, limits, payload validation and created_by all decided by the
// server), so an imported set is indistinguishable from a hand-built one.

type Step = 'upload' | 'review' | 'details' | 'done'

// Browsers report .csv as any of these (Windows Excel says vnd.ms-excel).
const ALLOWED_MIME = new Set(['', 'text/plain', 'text/csv', 'application/csv', 'text/comma-separated-values', 'text/x-csv', 'application/vnd.ms-excel'])

const TYPE_LABEL: Partial<Record<GameRoomQuestionType, string>> = {
  MULTIPLE_CHOICE: 'Multiple choice',
  TRUE_FALSE: 'True / false',
  TEXT_INPUT: 'Typed answer',
}

function download(name: string, text: string, mime: string) {
  // UTF-8 BOM on the CSV so Excel opens Tamil correctly.
  const blob = new Blob([mime === 'text/csv' ? '﻿' + text : text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function ImportWizard() {
  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [fileErrors, setFileErrors] = useState<string[]>([])
  const [notices, setNotices] = useState<string[]>([])
  const [rows, setRows] = useState<ImportRow[]>([])
  const [detected, setDetected] = useState(0)
  const [style, setStyle] = useState<AnswerStyle>('choices')
  const [onlyProblems, setOnlyProblems] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [paste, setPaste] = useState('')
  const [pasteFormat, setPasteFormat] = useState<ImportFormat>('txt')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [tamilTitle, setTamilTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState<'' | 'easy' | 'medium' | 'hard'>('')
  const [description, setDescription] = useState('')
  const [published, setPublished] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ id: string; count: number } | null>(null)

  const checks = useMemo(() => checkRows(rows), [rows])
  const built = useMemo(() => rows.map((r) => buildQuestion(r, rows, style)), [rows, style])
  const problems = useMemo(
    () => checks.map((c, i) => (c.errors.length ? c.errors : payloadProblems(built[i]))),
    [checks, built]
  )
  const needAttention = problems.filter((p) => p.length > 0).length
  const ready = rows.length - needAttention
  const tooMany = rows.length > IMPORT_LIMITS.maxQuestions
  const types = useMemo(() => Array.from(new Set(built.map((q) => q.questionType))), [built])
  const games = useMemo(
    () => checkEngineCompatibility(GAME_ENGINES_V2.filter((e) => e.status === 'ACTIVE'), types),
    [types]
  )

  function load(format: ImportFormat, text: string, name: string) {
    const res = parseImport(format, text)
    setFileName(name)
    setFileErrors(res.fileErrors)
    setNotices(res.notices)
    setRows(res.rows)
    setDetected(res.rows.length)
    setEditing(null)
    setOnlyProblems(false)
    setUploadError(null)
    if (!res.fileErrors.length && res.rows.length === 0) {
      setUploadError('No questions were found. Check the file against the template below.')
      return
    }
    if (!title) setTitle(name.replace(/\.(txt|csv)$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 200))
    setStep('review')
  }

  async function handleFile(file: File) {
    setUploadError(null)
    const format = formatForFileName(file.name)
    if (!format) {
      setUploadError(
        /\.xlsx?$/i.test(file.name)
          ? 'Excel files cannot be imported directly. In Excel choose File → Save As → "CSV UTF-8 (.csv)", then upload that file.'
          : 'Only .txt and .csv files can be imported.'
      )
      return
    }
    if (!ALLOWED_MIME.has(file.type)) {
      setUploadError(`This file does not look like plain text (${file.type}). Save it as .txt or .csv and try again.`)
      return
    }
    // Refuse before reading a byte into memory.
    if (file.size > IMPORT_LIMITS.maxFileBytes) {
      setUploadError(`The file is too large (${Math.round(file.size / 1024)} KB). The limit is ${IMPORT_LIMITS.maxFileBytes / 1024} KB -- split it into smaller sets.`)
      return
    }
    const decoded = decodeImportBytes(new Uint8Array(await file.arrayBuffer()))
    if ('error' in decoded) {
      setUploadError(decoded.error)
      return
    }
    load(format, decoded.text, file.name)
  }

  function handlePaste() {
    const bytes = new TextEncoder().encode(paste)
    const decoded = decodeImportBytes(bytes)
    if ('error' in decoded) {
      setUploadError(decoded.error)
      return
    }
    load(pasteFormat, decoded.text, pasteFormat === 'csv' ? 'pasted.csv' : 'pasted.txt')
  }

  function updateRow(i: number, patch: Partial<ImportRow>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }
  function removeRow(i: number) {
    setRows((rs) => rs.filter((_, j) => j !== i))
    setEditing(null)
  }
  function removeProblemRows() {
    setRows((rs) => rs.filter((_, j) => problems[j].length === 0))
    setEditing(null)
    setOnlyProblems(false)
  }

  async function create() {
    if (!title.trim()) {
      setSaveError('Give the set a name.')
      return
    }
    setSaving(true)
    setSaveError(null)
    const body = {
      title: title.trim(),
      tamilTitle: tamilTitle.trim() || null,
      topic: topic.trim() || null,
      difficulty: difficulty || null,
      description: description.trim() || null,
      tags: ['imported'],
      visibility: 'PRIVATE',
      published,
      questions: built.map((q) => ({
        questionType: q.questionType,
        prompt: q.prompt,
        payload: q.payload,
        explanation: q.explanation,
        mediaUrl: null,
        points: 100,
        dimension: null,
        conceptTags: q.conceptTags,
      })),
    }
    const res = await fetch('/api/gameroom-v2/question-sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}
    setSaving(false)
    if (!res || !res.ok) {
      setSaveError(data?.error || 'Could not create the set. Please try again.')
      return
    }
    setCreated({ id: data.questionSet.id, count: built.length })
    toast.success('Question set created')
    setStep('done')
  }

  // --- Upload ------------------------------------------------------------
  if (step === 'upload') {
    return (
      <div className="space-y-4">
        <Card className="p-5 sm:p-6 space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              const f = e.dataTransfer.files?.[0]
              if (f) void handleFile(f)
            }}
            className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${dragOver ? 'border-primary-500 bg-primary-50 dark:bg-primary-950' : 'border-stone-300 dark:border-stone-700'}`}
          >
            <FiUploadCloud className="w-10 h-10 mx-auto text-primary-700 dark:text-primary-400" aria-hidden />
            <p className="mt-3 font-semibold text-stone-800 dark:text-stone-100">Drop a .txt or .csv file here</p>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Up to {IMPORT_LIMITS.maxQuestions} questions, {IMPORT_LIMITS.maxFileBytes / 1024} KB. Tamil, English or both -- save as UTF-8.
            </p>
            <button type="button" onClick={() => inputRef.current?.click()} className={`${primaryLinkButton} mt-4`}>
              Choose file
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".txt,.csv,text/plain,text/csv"
              className="sr-only"
              aria-label="Question file"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void handleFile(f)
              }}
            />
          </div>
          {uploadError && (
            <p role="alert" className="flex items-start gap-2 text-sm font-medium text-terracotta-700 dark:text-terracotta-300">
              <FiAlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden /> {uploadError}
            </p>
          )}
          <details className="rounded-xl border border-stone-200 dark:border-stone-800 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-stone-700 dark:text-stone-200">Or paste the questions</summary>
            <div className="mt-3 space-y-2">
              <div className="flex gap-2 text-sm" role="radiogroup" aria-label="Pasted format">
                {(['txt', 'csv'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={pasteFormat === f}
                    onClick={() => setPasteFormat(f)}
                    className={`px-3 py-1.5 rounded-lg font-semibold ${pasteFormat === f ? 'bg-primary-700 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200'}`}
                  >
                    {f === 'txt' ? 'Question: / Answer: text' : 'CSV'}
                  </button>
                ))}
              </div>
              <textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                rows={8}
                lang="ta"
                maxLength={IMPORT_LIMITS.maxFileBytes}
                placeholder={'Question: தமிழ்நாட்டின் தலைநகர் எது?\nAnswer: சென்னை\nExplanation: …'}
                className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 p-3 font-tamil text-sm leading-relaxed"
              />
              <button type="button" disabled={!paste.trim()} onClick={handlePaste} className={`${secondaryLinkButton} disabled:opacity-50`}>
                Preview pasted questions
              </button>
            </div>
          </details>
        </Card>

        <Card className="p-5 sm:p-6 space-y-3">
          <h2 className="font-bold text-primary-900 dark:text-white">File format</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <p className="font-semibold text-stone-800 dark:text-stone-100">Text (.txt)</p>
              <pre className="rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 p-3 font-tamil whitespace-pre-wrap text-xs leading-relaxed">{`Question: தமிழில் உயிரெழுத்துகள் எத்தனை?
Answer: 12
Explanation: தமிழில் 12 உயிரெழுத்துகள் உள்ளன.

Question: தமிழ்நாட்டின் தலைநகர் எது?
Answer: சென்னை`}</pre>
              <p className="text-stone-500 dark:text-stone-400">
                Explanation is optional. Leave a blank line between questions. Optional: <code>Wrong answers: a | b | c</code>. Tamil labels (கேள்வி / விடை / விளக்கம்) work too.
              </p>
              <button type="button" onClick={() => download('tamizhi-questions-template.txt', TXT_TEMPLATE, 'text/plain')} className={secondaryLinkButton}>
                <FiDownload className="w-4 h-4" aria-hidden /> TXT template
              </button>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-stone-800 dark:text-stone-100">Spreadsheet (.csv)</p>
              <pre className="rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 p-3 font-tamil whitespace-pre-wrap text-xs leading-relaxed">{`question,answer,explanation
தமிழில் உயிரெழுத்துகள் எத்தனை?,12,தமிழில் 12 உயிரெழுத்துகள் உள்ளன.
தமிழ்நாட்டின் தலைநகர் எது?,சென்னை,`}</pre>
              <p className="text-stone-500 dark:text-stone-400">
                Required columns: <code>question</code>, <code>answer</code>. Optional: <code>explanation</code>, <code>topic</code>, <code>skill</code>, <code>type</code>, <code>wrong_answer_1</code>…<code>wrong_answer_3</code>. In Excel, save as &quot;CSV UTF-8&quot;.
              </p>
              <button type="button" onClick={() => download('tamizhi-questions-template.csv', CSV_TEMPLATE, 'text/csv')} className={secondaryLinkButton}>
                <FiDownload className="w-4 h-4" aria-hidden /> CSV template
              </button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  // --- Done --------------------------------------------------------------
  if (step === 'done' && created) {
    return (
      <Card className="p-6 sm:p-8 text-center space-y-4">
        <FiCheckCircle className="w-12 h-12 mx-auto text-emerald-600" aria-hidden />
        <div>
          <h2 className="text-xl font-bold text-primary-900 dark:text-white">Question set created</h2>
          <p className="text-stone-500 dark:text-stone-400">
            &ldquo;{title}&rdquo; -- {created.count} questions. It works like any set you build by hand.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href={`/gameroom-v2/live/host?set=${created.id}`} className={primaryLinkButton}>
            <FiPlayCircle className="w-4 h-4" aria-hidden /> Host Live with this set
          </Link>
          <Link href={`/gameroom-v2/builder/${created.id}`} className={secondaryLinkButton}>
            <FiEdit2 className="w-4 h-4" aria-hidden /> Open in Builder
          </Link>
          <Link href="/gameroom-v2/library?tab=my-sets" className={secondaryLinkButton}>
            Question Set Library
          </Link>
        </div>
      </Card>
    )
  }

  const blocked = fileErrors.length > 0 || tooMany || rows.length === 0

  // --- Details -----------------------------------------------------------
  if (step === 'details') {
    return (
      <Card className="p-5 sm:p-6 space-y-4">
        <p className="text-sm text-stone-500 dark:text-stone-400">
          {rows.length} questions ready from <span className="font-medium">{fileName}</span>.
        </p>
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">Set name *</span>
          <TamilTextInput value={title} onChange={setTitle} placeholder="e.g. Class 6 -- Tamil letters" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">Tamil name (optional)</span>
          <TamilTextInput value={tamilTitle} onChange={setTamilTitle} placeholder="தமிழ் எழுத்துகள்" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">Topic</span>
          <TamilTextInput value={topic} onChange={setTopic} placeholder="e.g. எழுத்துகள் / Letters" />
        </label>
        <div className="space-y-1">
          <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">Difficulty</span>
          <div className="flex gap-2" role="radiogroup" aria-label="Difficulty">
            {(['easy', 'medium', 'hard'] as const).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={difficulty === d}
                onClick={() => setDifficulty(difficulty === d ? '' : d)}
                className={`px-4 min-h-[40px] rounded-xl text-sm font-semibold capitalize ${difficulty === d ? 'bg-primary-700 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200'}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">Description</span>
          <TamilTextArea value={description} onChange={setDescription} placeholder="What is this set about?" rows={2} />
        </label>
        <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-200">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="w-4 h-4" />
          Ready to use (published). Untick to keep it as a draft.
        </label>
        {saveError && (
          <p role="alert" className="text-sm font-medium text-terracotta-700 dark:text-terracotta-300">
            {saveError}
          </p>
        )}
        <div className="flex flex-wrap justify-between gap-2 pt-2">
          <button type="button" onClick={() => setStep('review')} className={secondaryLinkButton}>
            <FiArrowLeft className="w-4 h-4" aria-hidden /> Back to preview
          </button>
          <button type="button" disabled={saving || !title.trim() || blocked || needAttention > 0} onClick={create} className={`${primaryLinkButton} disabled:opacity-50`}>
            {saving ? 'Creating…' : 'CREATE QUESTION SET'}
          </button>
        </div>
      </Card>
    )
  }

  // --- Review ------------------------------------------------------------
  const visible = rows.map((r, i) => ({ r, i })).filter(({ i }) => !onlyProblems || problems[i].length > 0)
  return (
    <div className="space-y-4">
      <Card className="p-5 sm:p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-stone-500 dark:text-stone-400">{fileName}</p>
            <p className="text-lg font-bold text-primary-900 dark:text-white" aria-live="polite">
              {detected} detected · {ready} ready · {needAttention} need attention
            </p>
          </div>
          <button type="button" onClick={() => setStep('upload')} className={secondaryLinkButton}>
            Choose another file
          </button>
        </div>
        {fileErrors.map((e) => (
          <p key={e} role="alert" className="flex items-start gap-2 text-sm font-medium text-terracotta-700 dark:text-terracotta-300">
            <FiAlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden /> {e}
          </p>
        ))}
        {notices.map((n) => (
          <p key={n} className="text-sm text-stone-500 dark:text-stone-400">
            {n}
          </p>
        ))}
        <fieldset className="space-y-1">
          <legend className="text-sm font-semibold text-stone-700 dark:text-stone-200">Questions without wrong answers should be played as</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['choices', 'Multiple choice', 'Wrong options are taken from the other answers in this file. Works in every quiz-style game.'],
                ['typed', 'Typed answer', 'Students type the answer. Works in Classic Quiz and Boss Battle.'],
              ] as const
            ).map(([id, label, hint]) => (
              <button
                key={id}
                type="button"
                aria-pressed={style === id}
                onClick={() => setStyle(id)}
                className={`text-left px-3 py-2 rounded-xl border max-w-xs ${style === id ? 'border-primary-600 bg-primary-50 dark:bg-primary-950' : 'border-stone-200 dark:border-stone-800'}`}
              >
                <span className="block text-sm font-semibold text-stone-800 dark:text-stone-100">{label}</span>
                <span className="block text-xs text-stone-500 dark:text-stone-400">{hint}</span>
              </button>
            ))}
          </div>
        </fieldset>
        {rows.length > 0 && (
          <div className="text-sm">
            <span className="font-semibold text-stone-700 dark:text-stone-200">Playable in: </span>
            {games.filter((g) => g.compatible).map((g) => g.engine.name).join(', ') || 'no game yet'}
            {games.some((g) => !g.compatible) && (
              <span className="block text-xs text-stone-500 dark:text-stone-400">
                Not in {games.filter((g) => !g.compatible).map((g) => g.engine.name).join(', ')} -- those games need other question types (e.g. matching pairs or sorting).
              </span>
            )}
          </div>
        )}
        {needAttention > 0 && (
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={onlyProblems} onClick={() => setOnlyProblems((v) => !v)} className={secondaryLinkButton}>
              {onlyProblems ? 'Show all' : `Show the ${needAttention} to fix`}
            </button>
            <button type="button" onClick={removeProblemRows} className={secondaryLinkButton}>
              <FiTrash2 className="w-4 h-4" aria-hidden /> Remove the {needAttention} with problems
            </button>
          </div>
        )}
      </Card>

      <ol className="space-y-2">
        {visible.map(({ r, i }) => {
          const p = problems[i]
          const q = built[i]
          const isEditing = editing === i
          return (
            <li key={`${r.line}-${i}`}>
              <Card className={`p-4 ${p.length ? 'border-terracotta-300 dark:border-terracotta-800' : ''}`}>
                <div className="flex items-start gap-3">
                  <span className={`shrink-0 mt-0.5 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${p.length ? 'bg-terracotta-100 text-terracotta-800 dark:bg-terracotta-950 dark:text-terracotta-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'}`}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <TamilTextArea value={r.question} onChange={(v) => updateRow(i, { question: v })} rows={2} placeholder="Question" />
                        <TamilTextInput value={r.answer} onChange={(v) => updateRow(i, { answer: v })} placeholder="Answer" />
                        <TamilTextArea value={r.explanation} onChange={(v) => updateRow(i, { explanation: v })} rows={2} placeholder="Explanation (optional)" />
                        <TamilTextInput
                          value={r.wrongAnswers.join(' | ')}
                          onChange={(v) => updateRow(i, { wrongAnswers: v.split('|').map((x) => x.trim()).filter(Boolean) })}
                          placeholder="Wrong answers (optional): a | b | c"
                        />
                        <button type="button" onClick={() => setEditing(null)} className={secondaryLinkButton}>
                          Done
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="font-tamil text-stone-900 dark:text-stone-50 whitespace-pre-wrap break-words leading-relaxed">{r.question || <em className="text-stone-400">(no question)</em>}</p>
                        <p className="text-sm">
                          <span className="text-stone-500 dark:text-stone-400">Answer: </span>
                          <span className="font-tamil font-semibold text-emerald-800 dark:text-emerald-300 break-words">{r.answer || <em className="text-stone-400">(missing)</em>}</span>
                        </p>
                        {r.explanation && <p className="text-sm font-tamil text-stone-600 dark:text-stone-300 whitespace-pre-wrap break-words">{r.explanation}</p>}
                        {!p.length && (
                          <p className="text-xs text-stone-500 dark:text-stone-400">
                            {TYPE_LABEL[q.questionType] ?? q.questionType}
                            {q.questionType === 'MULTIPLE_CHOICE' && Array.isArray(q.payload.options) && (
                              <> · options: <span className="font-tamil">{(q.payload.options as string[]).join(' / ')}</span></>
                            )}
                          </p>
                        )}
                      </>
                    )}
                    {p.map((e) => (
                      <p key={e} className="flex items-start gap-1.5 text-sm font-medium text-terracotta-700 dark:text-terracotta-300">
                        <FiAlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden /> {e}
                      </p>
                    ))}
                    {checks[i].warnings.map((w) => (
                      <p key={w} className="text-xs text-amber-700 dark:text-amber-300">
                        {w}
                      </p>
                    ))}
                    <p className="text-xs text-stone-400">line {r.line}</p>
                  </div>
                  {!isEditing && (
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => setEditing(i)} aria-label={`Edit question ${i + 1}`} className="w-9 h-9 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-300">
                        <FiEdit2 className="w-4 h-4" aria-hidden />
                      </button>
                      <button type="button" onClick={() => removeRow(i)} aria-label={`Remove question ${i + 1}`} className="w-9 h-9 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-300">
                        <FiX className="w-4 h-4" aria-hidden />
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            </li>
          )
        })}
      </ol>

      <div className="sticky bottom-0 z-10 -mx-4 px-4 py-3 bg-white/95 dark:bg-stone-950/95 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-stone-600 dark:text-stone-300">
          {blocked
            ? fileErrors[0] ?? (rows.length === 0 ? 'No questions left.' : '')
            : needAttention > 0
              ? `Fix or remove ${needAttention} question${needAttention === 1 ? '' : 's'} to continue.`
              : `${ready} questions ready.`}
        </p>
        <button type="button" disabled={blocked || needAttention > 0} onClick={() => setStep('details')} className={`${primaryLinkButton} disabled:opacity-50`}>
          Continue <FiArrowRight className="w-4 h-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
