'use client'

import { useEffect, useMemo, useState } from 'react'
import { FiSearch } from 'react-icons/fi'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { toast } from '@/lib/toast'

interface WordRow {
  id: string
  word: string
  targetLetter: string
  groupId: string
  difficulty: 'easy' | 'medium' | 'hard'
  meaningEnglish: string
  meaningTamil: string | null
  reviewStatus: 'generated' | 'reviewed' | 'approved'
  enabled: boolean
}

const GROUP_LABELS: Record<string, string> = {
  l_group: 'ல் / ள் / ழ்',
  n_group: 'ன் / ண் / ந்',
  r_group: 'ர் / ற்',
}

const REVIEW_STATUS_ORDER = ['generated', 'reviewed', 'approved'] as const

export function WordBankAdminClient() {
  const [words, setWords] = useState<WordRow[] | null>(null)
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<string>('all')
  const [reviewFilter, setReviewFilter] = useState<string>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMeaning, setEditMeaning] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/mayangoli/admin/words')
      .then((res) => res.json())
      .then((data) => setWords(data.words ?? []))
      .catch(() => setWords([]))
  }, [])

  const filtered = useMemo(() => {
    if (!words) return []
    const q = search.trim().toLowerCase()
    return words.filter((w) => {
      if (groupFilter !== 'all' && w.groupId !== groupFilter) return false
      if (reviewFilter !== 'all' && w.reviewStatus !== reviewFilter) return false
      if (q && !w.word.toLowerCase().includes(q) && !w.meaningEnglish.toLowerCase().includes(q)) return false
      return true
    })
  }, [words, search, groupFilter, reviewFilter])

  async function patchWord(id: string, body: Record<string, unknown>) {
    setSavingId(id)
    const res = await fetch(`/api/mayangoli/admin/words/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    setSavingId(null)

    if (!res.ok) {
      toast.error(data.error || 'Failed to update word')
      return false
    }
    setWords((prev) => (prev ? prev.map((w) => (w.id === id ? { ...w, ...body } : w)) : prev))
    return true
  }

  async function toggleEnabled(w: WordRow) {
    await patchWord(w.id, { enabled: !w.enabled })
  }

  async function promoteReview(w: WordRow) {
    const currentIdx = REVIEW_STATUS_ORDER.indexOf(w.reviewStatus)
    const next = REVIEW_STATUS_ORDER[Math.min(currentIdx + 1, REVIEW_STATUS_ORDER.length - 1)]
    if (next === w.reviewStatus) return
    const ok = await patchWord(w.id, { reviewStatus: next })
    if (ok) toast.success(`Marked "${w.word}" as ${next}`)
  }

  function startEdit(w: WordRow) {
    setEditingId(w.id)
    setEditMeaning(w.meaningEnglish)
  }

  async function saveEdit(w: WordRow) {
    if (!editMeaning.trim()) return
    const ok = await patchWord(w.id, { meaningEnglish: editMeaning.trim() })
    if (ok) setEditingId(null)
  }

  if (words === null) {
    return <p className="text-sm text-stone-400 dark:text-stone-500">Loading...</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search word or meaning..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          />
        </div>
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white text-sm"
        >
          <option value="all">All Groups</option>
          {Object.entries(GROUP_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={reviewFilter}
          onChange={(e) => setReviewFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white text-sm"
        >
          <option value="all">All Statuses</option>
          {REVIEW_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-stone-500 dark:text-stone-400">
        {filtered.length} of {words.length} words
      </p>

      {filtered.length === 0 ? (
        <EmptyState title="No words match" description="Try a different search or filter." />
      ) : (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden">
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {filtered.map((w) => (
              <div key={w.id} className={`p-4 flex flex-col gap-2 ${!w.enabled ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-black font-tamil text-stone-800 dark:text-stone-100">{w.word}</span>
                    <Badge variant="neutral" size="sm">
                      {GROUP_LABELS[w.groupId]}
                    </Badge>
                    <Badge variant="secondary" size="sm">
                      {w.difficulty}
                    </Badge>
                    <Badge variant={w.reviewStatus === 'approved' ? 'success' : w.reviewStatus === 'reviewed' ? 'gold' : 'neutral'} size="sm">
                      {w.reviewStatus}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {w.reviewStatus !== 'approved' && (
                      <button
                        onClick={() => promoteReview(w)}
                        disabled={savingId === w.id}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-primary-700 text-primary-800 dark:border-primary-400 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950 disabled:opacity-50"
                      >
                        Mark {w.reviewStatus === 'generated' ? 'Reviewed' : 'Approved'}
                      </button>
                    )}
                    <button
                      onClick={() => toggleEnabled(w)}
                      disabled={savingId === w.id}
                      className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border disabled:opacity-50 ${
                        w.enabled
                          ? 'border-terracotta-600 text-terracotta-700 dark:text-terracotta-300 hover:bg-terracotta-50 dark:hover:bg-terracotta-950'
                          : 'border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950'
                      }`}
                    >
                      {w.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>

                {editingId === w.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editMeaning}
                      onChange={(e) => setEditMeaning(e.target.value)}
                      className="flex-1 px-2 py-1 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white"
                      autoFocus
                    />
                    <button onClick={() => saveEdit(w)} className="text-xs font-semibold text-primary-700 dark:text-primary-400">
                      Save
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-stone-500 dark:text-stone-400">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => startEdit(w)} className="text-left text-sm text-stone-500 dark:text-stone-400 hover:underline w-fit">
                    {w.meaningEnglish}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
