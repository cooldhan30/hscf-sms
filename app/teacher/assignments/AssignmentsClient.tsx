'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiEyeOff } from 'react-icons/fi'
import { DataTable, type DataTableColumn } from '@/components/dashboard/DataTable'
import { Modal } from '@/components/dashboard/Modal'
import { Button } from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/ConfirmDialogProvider'
import { AssignmentImageUpload } from '@/components/assignments/AssignmentImageUpload'
import { toast } from '@/lib/toast'
import type { SmsAssignment, SmsClass } from '@/types/database'

type AssignmentRow = SmsAssignment & { class: Pick<SmsClass, 'id' | 'name'> }
type ClassOption = Pick<SmsClass, 'id' | 'name'>

interface FormState {
  id?: string
  classId: string
  title: string
  description: string
  dueDate: string
  maxScore: string
  pointsDeductionPerDay: string
  published: boolean
  imageUrl: string
}

function emptyForm(defaultClassId: string): FormState {
  return {
    classId: defaultClassId,
    title: '',
    description: '',
    dueDate: '',
    maxScore: '100',
    pointsDeductionPerDay: '0',
    published: false,
    imageUrl: '',
  }
}

export function AssignmentsClient({
  classes,
  initialAssignments,
}: {
  classes: ClassOption[]
  initialAssignments: AssignmentRow[]
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const searchParams = useSearchParams()
  const requestedClassId = searchParams.get('classId')
  const [classFilter, setClassFilter] = useState(
    requestedClassId && classes.some((c) => c.id === requestedClassId) ? requestedClassId : 'all'
  )
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm(classes[0]?.id ?? ''))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(
    () => (classFilter === 'all' ? initialAssignments : initialAssignments.filter((a) => a.class_id === classFilter)),
    [initialAssignments, classFilter]
  )

  function openAdd() {
    setForm(emptyForm(classes[0]?.id ?? ''))
    setError(null)
    setModalOpen(true)
  }

  function openEdit(a: AssignmentRow) {
    setForm({
      id: a.id,
      classId: a.class_id,
      title: a.title,
      description: a.description ?? '',
      dueDate: a.due_date ?? '',
      maxScore: String(a.max_score),
      pointsDeductionPerDay: String(a.points_deduction_per_day ?? 0),
      published: a.published,
      imageUrl: a.image_url ?? '',
    })
    setError(null)
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const isEdit = Boolean(form.id)
    const url = isEdit ? `/api/teacher/assignments/${form.id}` : '/api/teacher/assignments'
    const method = isEdit ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classId: form.classId,
        title: form.title,
        description: form.description,
        dueDate: form.dueDate,
        maxScore: form.maxScore,
        pointsDeductionPerDay: form.pointsDeductionPerDay,
        published: form.published,
        imageUrl: form.imageUrl,
      }),
    })

    const data = await res.json().catch(() => ({}))
    setSaving(false)

    if (!res.ok) {
      setError(data.error || 'Something went wrong')
      return
    }

    setModalOpen(false)
    toast.success(isEdit ? 'Assignment updated' : 'Assignment created')
    router.refresh()
  }

  async function togglePublish(a: AssignmentRow) {
    const res = await fetch(`/api/teacher/assignments/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: !a.published }),
    })
    if (res.ok) {
      toast.success(a.published ? 'Assignment unpublished' : 'Assignment published')
      router.refresh()
    } else {
      toast.error('Failed to update assignment')
    }
  }

  async function remove(a: AssignmentRow) {
    const confirmed = await confirm({
      title: `Delete "${a.title}"?`,
      description: 'This also removes any grades entered for it.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!confirmed) return
    const res = await fetch(`/api/teacher/assignments/${a.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Assignment deleted')
      router.refresh()
    } else {
      toast.error('Failed to delete assignment')
    }
  }

  const columns: DataTableColumn<AssignmentRow>[] = [
    {
      header: 'Assignment',
      accessor: (a) => (
        <div>
          <p className="font-semibold text-stone-800 dark:text-stone-100">{a.title}</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">{a.class.name}</p>
        </div>
      ),
    },
    { header: 'Due', accessor: (a) => (a.due_date ? new Date(a.due_date).toLocaleDateString() : '—') },
    { header: 'Max Score', accessor: (a) => a.max_score },
    {
      header: 'Status',
      accessor: (a) => (
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
            a.published
              ? 'bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300'
              : 'bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
          }`}
        >
          {a.published ? 'Published' : 'Draft'}
        </span>
      ),
    },
    {
      header: '',
      accessor: (a) => (
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => togglePublish(a)}
            className="p-2 rounded-lg text-stone-500 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
            aria-label={a.published ? 'Unpublish' : 'Publish'}
          >
            {a.published ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
          </button>
          <button
            onClick={() => openEdit(a)}
            className="p-2 rounded-lg text-stone-500 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
            aria-label="Edit"
          >
            <FiEdit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => remove(a)}
            className="p-2 rounded-lg text-terracotta-600 hover:bg-terracotta-50 dark:hover:bg-terracotta-950/40 transition-colors"
            aria-label="Delete"
          >
            <FiTrash2 className="w-4 h-4" />
          </button>
        </div>
      ),
      className: 'text-right',
    },
  ]

  if (classes.length === 0) {
    return <p className="text-stone-500 dark:text-stone-400">You have no assigned classes yet.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
        >
          <option value="all">All Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Button variant="primary" icon={<FiPlus />} onClick={openAdd}>
          Add Assignment
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        keyFor={(a) => a.id}
        emptyTitle="No assignments yet"
        emptyDescription="Create your first assignment to get started."
      />

      <Modal open={modalOpen} title={form.id ? 'Edit Assignment' : 'Add Assignment'} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div>
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Class</label>
            <select
              value={form.classId}
              onChange={(e) => setForm({ ...form, classId: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Title</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            />
          </div>

          <AssignmentImageUpload currentUrl={form.imageUrl} onUploaded={(url) => setForm({ ...form, imageUrl: url })} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Due Date</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Max Score</label>
              <input
                type="number"
                min="1"
                required
                value={form.maxScore}
                onChange={(e) => setForm({ ...form, maxScore: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Late Penalty (points deducted per day late)
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={form.pointsDeductionPerDay}
              onChange={(e) => setForm({ ...form, pointsDeductionPerDay: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            />
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">0 = no late penalty.</p>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => setForm({ ...form, published: e.target.checked })}
              className="w-4 h-4 rounded text-primary-600 focus:ring-primary-600"
            />
            <span className="text-sm text-stone-700 dark:text-stone-300">
              Published (visible to students in this class)
            </span>
          </label>

          <Button type="submit" variant="primary" fullWidth disabled={saving}>
            {saving ? 'Saving...' : form.id ? 'Save Changes' : 'Create Assignment'}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
