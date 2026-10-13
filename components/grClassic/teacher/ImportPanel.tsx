'use client'

import { useRef, useState } from 'react'
import { FiCheckCircle, FiDownload, FiUpload } from 'react-icons/fi'
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, TEMPLATES, templateCsv } from '@/lib/grClassic/csv'
import { downloadText } from '@/lib/grClassic/format'
import type { Category, Question, QuestionKind } from '@/lib/grClassic/types'
import { Button, Card, Pill } from '../ui'
import { grcApi } from './api'

type PreviewRow = { line: number; status: 'ok' | 'duplicate' | 'error'; errors: string[]; summary: string; topic: string; newTopic: boolean }
type Preview = { kind: QuestionKind; rows: PreviewRow[]; counts: { ok: number; duplicate: number; error: number } }

// CSV import: download a template -> fill it in -> upload -> check the
// preview -> import. Only rows marked "Ready" are imported.
export function ImportPanel({ kinds, onImported, onClose }: { kinds?: QuestionKind[]; onImported: (questions: Question[], categories: Category[]) => void; onClose?: () => void }) {
  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const choose = async (file: File | undefined) => {
    setPreview(null)
    setError('')
    setDone(null)
    if (!file) return
    if (file.size > MAX_IMPORT_BYTES) return setError('That file is too big (max 512 KB).')
    const text = await file.text()
    setCsv(text)
    setFileName(file.name)
    setBusy(true)
    const res = await grcApi<Preview>('/questions/import', { method: 'POST', body: { csv: text, commit: false } })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setPreview(res.data)
  }

  const commit = async () => {
    setBusy(true)
    const res = await grcApi<{ imported: number; questions: Question[]; categories: Category[] }>('/questions/import', { method: 'POST', body: { csv, commit: true } })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setDone(res.data.imported)
    setPreview(null)
    onImported(res.data.questions, res.data.categories)
  }

  const reset = () => {
    setPreview(null)
    setCsv('')
    setFileName('')
    setDone(null)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900">Import questions from a spreadsheet</h3>
          <p className="text-sm text-slate-600">Download a template, fill it in (Excel or Google Sheets), save it as <b>CSV UTF-8</b>, then upload it. Up to {MAX_IMPORT_ROWS} questions per file.</p>
        </div>
        {onClose && (
          <Button tone="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(kinds ?? (Object.keys(TEMPLATES) as QuestionKind[])).map((k) => (
          <Button key={k} tone="plain" size="sm" onClick={() => downloadText(TEMPLATES[k].file, templateCsv(k))}>
            <FiDownload aria-hidden /> {TEMPLATES[k].label} template
          </Button>
        ))}
      </div>

      <div className="mt-4">
        <input ref={fileRef} id="grc-csv" type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
        <label htmlFor="grc-csv" className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 font-bold text-slate-700 hover:border-teal-500 hover:bg-teal-50">
          <FiUpload aria-hidden /> {fileName ? `Chosen: ${fileName} — choose another` : 'Choose a CSV file'}
        </label>
      </div>

      {busy && <p className="mt-3 font-bold text-slate-600" role="status">Checking…</p>}
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-4 py-3 font-bold text-rose-800 ring-1 ring-rose-200">
          {error}
        </p>
      )}
      {done !== null && (
        <div role="status" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3 font-bold text-emerald-900 ring-1 ring-emerald-200">
          <span className="flex items-center gap-2">
            <FiCheckCircle aria-hidden /> Imported {done} question{done === 1 ? '' : 's'} into your library.
          </span>
          <Button tone="plain" size="sm" onClick={reset}>
            Import another file
          </Button>
        </div>
      )}

      {preview && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="green">{preview.counts.ok} ready</Pill>
            {preview.counts.duplicate > 0 && <Pill tone="amber">{preview.counts.duplicate} already in library</Pill>}
            {preview.counts.error > 0 && <Pill tone="red">{preview.counts.error} need fixing</Pill>}
            <span className="text-sm font-semibold text-slate-500">{TEMPLATES[preview.kind].label}</span>
          </div>
          <div className="relative mt-3 max-h-96 overflow-auto rounded-2xl ring-1 ring-slate-200">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs font-extrabold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Question</th>
                  <th className="px-3 py-2">Topic</th>
                  <th className="px-3 py-2">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {preview.rows.map((r) => (
                  <tr key={r.line} className={r.status === 'error' ? 'bg-rose-50/60' : ''}>
                    <td className="px-3 py-2 font-bold text-slate-500">{r.line}</td>
                    <td className="px-3 py-2 font-semibold text-slate-900">{r.summary}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {r.topic || '—'} {r.newTopic && <Pill tone="blue">new</Pill>}
                    </td>
                    <td className="px-3 py-2">
                      {r.status === 'ok' ? <Pill tone="green">Ready</Pill> : r.status === 'duplicate' ? <Pill tone="amber">Skip</Pill> : <Pill tone="red">Fix</Pill>}
                      {r.errors.length > 0 && <span className="mt-1 block text-xs font-semibold text-slate-600">{r.errors.join(' ')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            {preview.counts.error > 0 && <span className="text-sm font-semibold text-slate-600">Rows marked “Fix” won’t be imported. Fix them in the file and upload again, or import the rest now.</span>}
            <Button tone="teal" onClick={commit} disabled={busy || preview.counts.ok === 0}>
              Import {preview.counts.ok} question{preview.counts.ok === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
