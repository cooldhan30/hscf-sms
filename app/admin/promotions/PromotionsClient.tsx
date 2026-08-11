'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiArrowRight, FiRotateCcw, FiUsers } from 'react-icons/fi'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/ConfirmDialogProvider'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { GRADE_LEVEL_OPTIONS } from '@/lib/constants'
import { toast } from '@/lib/toast'

export interface PromotionClass {
  id: string
  name: string
  grade_level: string | null
  academic_year: string
}

export interface PromotionHistoryRow {
  id: string
  student_count: number
  created_at: string
  undone_at: string | null
  source: { name: string; academic_year: string } | null
  target: { name: string; academic_year: string } | null
}

interface PreviewStudent {
  student_id: string
  first_name: string
  last_name: string
  current_grade_level: string | null
  current_academic_year: string | null
  already_in_target: boolean
}

export function PromotionsClient({
  classes,
  history,
}: {
  classes: PromotionClass[]
  history: PromotionHistoryRow[]
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [sourceId, setSourceId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [preview, setPreview] = useState<PreviewStudent[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const source = classes.find((c) => c.id === sourceId)
  const target = classes.find((c) => c.id === targetId)
  const sameClass = Boolean(sourceId) && sourceId === targetId
  const canPreview = Boolean(sourceId && targetId) && !sameClass

  // The preview is invalidated by any change to either end of the move --
  // showing a stale roster next to a newly-picked target is how an admin
  // promotes the wrong cohort.
  function pickSource(id: string) {
    setSourceId(id)
    setPreview(null)
    setError(null)
  }

  function pickTarget(id: string) {
    setTargetId(id)
    setPreview(null)
    setError(null)
  }

  async function loadPreview() {
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/admin/promotions?sourceClassId=${sourceId}&targetClassId=${targetId}`)
    const data = await res.json().catch(() => ({}))
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Could not load the class roster')
      return
    }

    setPreview(data.students as PreviewStudent[])
  }

  async function commit() {
    if (!preview || !source || !target) return

    const moving = preview.filter((s) => !s.already_in_target)

    const proceed = await confirm({
      title: `Promote ${moving.length} student${moving.length === 1 ? '' : 's'}?`,
      description:
        `${moving.length} student${moving.length === 1 ? '' : 's'} will move from "${source.name}" ` +
        `(${source.academic_year}) to "${target.name}" (${target.academic_year}), and their grade level ` +
        `will be updated to match. You can undo this afterwards.`,
      confirmLabel: 'Promote class',
      tone: 'danger',
    })
    if (!proceed) return

    setLoading(true)
    const res = await fetch('/api/admin/promotions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceClassId: sourceId, targetClassId: targetId }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Promotion failed')
      return
    }

    toast.success(`Promoted ${moving.length} student${moving.length === 1 ? '' : 's'} to ${target.name}`)
    setPreview(null)
    setSourceId('')
    setTargetId('')
    router.refresh()
  }

  async function undo(row: PromotionHistoryRow) {
    const proceed = await confirm({
      title: 'Undo this promotion?',
      description:
        `All ${row.student_count} student${row.student_count === 1 ? '' : 's'} will be returned to ` +
        `"${row.source?.name ?? 'the previous class'}", with the grade level and academic year they had before.`,
      confirmLabel: 'Undo promotion',
      tone: 'danger',
    })
    if (!proceed) return

    const res = await fetch(`/api/admin/promotions/${row.id}/undo`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      toast.error(data.error || 'Could not undo this promotion')
      return
    }

    toast.success('Promotion undone')
    router.refresh()
  }

  const movingCount = preview?.filter((s) => !s.already_in_target).length ?? 0
  const skippedCount = preview?.filter((s) => s.already_in_target).length ?? 0

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 space-y-4">
        <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-3 sm:items-end">
          <ClassSelect label="Promote from" value={sourceId} onChange={pickSource} classes={classes} />
          <div className="hidden sm:flex items-center justify-center pb-2.5 text-stone-400">
            <FiArrowRight className="w-5 h-5" />
          </div>
          <ClassSelect label="Promote to" value={targetId} onChange={pickTarget} classes={classes} />
        </div>

        {sameClass && (
          <p className="text-sm text-terracotta-700 dark:text-terracotta-300">
            Pick two different classes.
          </p>
        )}

        {error && (
          <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <Button variant="secondary" onClick={loadPreview} disabled={!canPreview || loading} icon={<FiUsers />}>
          {loading ? 'Loading...' : 'Preview students'}
        </Button>
      </div>

      {preview && (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-bold text-primary-900 dark:text-white">
              {movingCount} student{movingCount === 1 ? '' : 's'} will move
            </h2>
            {skippedCount > 0 && (
              <Badge variant="neutral" size="sm">
                {skippedCount} already in {target?.name}
              </Badge>
            )}
          </div>

          {preview.length === 0 ? (
            <EmptyState
              title="No students to promote"
              description="This class has no actively enrolled students."
            />
          ) : (
            <ul className="divide-y divide-stone-200 dark:divide-stone-800">
              {preview.map((s) => (
                <li key={s.student_id} className="py-2.5 flex items-center justify-between gap-3">
                  <span
                    className={
                      s.already_in_target
                        ? 'text-stone-400 dark:text-stone-600 line-through'
                        : 'text-stone-800 dark:text-stone-100'
                    }
                  >
                    {s.first_name} {s.last_name}
                  </span>
                  <span className="text-sm text-stone-500 dark:text-stone-400">
                    {s.already_in_target
                      ? 'Already enrolled'
                      : `${gradeLabel(s.current_grade_level)} → ${gradeLabel(target?.grade_level ?? null)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {movingCount > 0 && (
            <Button variant="primary" onClick={commit} disabled={loading} fullWidth>
              {loading ? 'Promoting...' : `Promote ${movingCount} student${movingCount === 1 ? '' : 's'}`}
            </Button>
          )}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-bold text-primary-900 dark:text-white">Recent promotions</h2>
        {history.length === 0 ? (
          <EmptyState title="No promotions yet" description="Promoted classes will be listed here." />
        ) : (
          <ul className="space-y-2">
            {history.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
              >
                <div>
                  <p className="text-stone-800 dark:text-stone-100 font-medium">
                    {row.source?.name ?? 'Deleted class'} → {row.target?.name ?? 'Deleted class'}
                  </p>
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    {row.student_count} student{row.student_count === 1 ? '' : 's'} ·{' '}
                    {new Date(row.created_at).toLocaleDateString()}
                  </p>
                </div>
                {row.undone_at ? (
                  <Badge variant="neutral" size="sm">
                    Undone
                  </Badge>
                ) : (
                  <Button variant="ghost" size="sm" icon={<FiRotateCcw />} onClick={() => undo(row)}>
                    Undo
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function gradeLabel(value: string | null): string {
  if (!value) return '—'
  return GRADE_LEVEL_OPTIONS.find((g) => g.value === value)?.label || value
}

function ClassSelect({
  label,
  value,
  onChange,
  classes,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  classes: PromotionClass[]
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
      >
        <option value="">Select a class...</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.academic_year})
          </option>
        ))}
      </select>
    </div>
  )
}
