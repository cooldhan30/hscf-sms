'use client'

import { useState } from 'react'
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi'
import { Modal } from '@/components/dashboard/Modal'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { useConfirm } from '@/components/ui/ConfirmDialogProvider'
import { toast } from '@/lib/toast'
import { Pagination } from '@/components/ui/Pagination'
import { usePagination } from '@/lib/hooks/usePagination'
import { TextField, TextAreaField } from './FormField'

export interface ListManagerField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'date' | 'number'
  required?: boolean
}

export interface ListManagerColumn<T> {
  header: string
  accessor: (row: T) => React.ReactNode
}

// Generic admin CRUD list: table + add/edit modal + delete, driven entirely
// by a {fields, columns, endpoint} config. Powers Academic Years, Grade
// Levels, Sections, Calendar Events, and Email Templates in Settings so
// each entity doesn't need its own bespoke form component.
export function ListManager<T extends { id: string }>({
  title,
  description,
  endpoint,
  columns,
  fields,
  rows,
  onChanged,
  toggleField,
  itemLabel = () => 'this item',
}: {
  title: string
  description?: string
  endpoint: string
  columns: ListManagerColumn<T>[]
  fields: ListManagerField[]
  rows: T[]
  onChanged: () => void
  toggleField?: { key: keyof T & string; label: string }
  itemLabel?: (row: T) => string
}) {
  const confirm = useConfirm()
  const { page, setPage, pageCount, pageItems, total, pageSize, setPageSize } = usePagination(rows, 10)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function openAdd() {
    setEditingId(null)
    setForm(Object.fromEntries(fields.map((f) => [f.key, ''])))
    setError(null)
    setModalOpen(true)
  }

  function openEdit(row: T) {
    setEditingId(row.id)
    setForm(Object.fromEntries(fields.map((f) => [f.key, String((row as Record<string, unknown>)[f.key] ?? '')])))
    setError(null)
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const isEdit = Boolean(editingId)
    const url = isEdit ? `${endpoint}/${editingId}` : endpoint
    const method = isEdit ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)

    if (!res.ok) {
      setError(data.error || 'Something went wrong')
      return
    }

    setModalOpen(false)
    toast.success(isEdit ? 'Saved' : 'Added')
    onChanged()
  }

  async function handleDelete(row: T) {
    const confirmed = await confirm({
      title: `Delete ${itemLabel(row)}?`,
      description: 'This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!confirmed) return
    const res = await fetch(`${endpoint}/${row.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Deleted')
      onChanged()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || 'Failed to delete')
    }
  }

  async function handleToggle(row: T, next: boolean) {
    if (!toggleField) return
    await fetch(`${endpoint}/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [toggleField.key]: String(next) }),
    })
    onChanged()
  }

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="font-bold text-primary-900 dark:text-white">{title}</h3>
          {description && <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">{description}</p>}
        </div>
        <Button variant="primary" size="sm" icon={<FiPlus />} onClick={openAdd}>
          Add
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Nothing here yet" />
      ) : (
        <div>
        <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950/50">
                {columns.map((c) => (
                  <th key={c.header} className="text-left font-semibold text-stone-600 dark:text-stone-300 px-4 py-2.5 whitespace-nowrap">
                    {c.header}
                  </th>
                ))}
                {toggleField && <th className="px-4 py-2.5 text-left font-semibold text-stone-600 dark:text-stone-300">{toggleField.label}</th>}
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((row) => (
                <tr key={row.id} className="border-b border-stone-100 dark:border-stone-800/60 last:border-0">
                  {columns.map((c) => (
                    <td key={c.header} className="px-4 py-2.5 text-stone-700 dark:text-stone-200">
                      {c.accessor(row)}
                    </td>
                  ))}
                  {toggleField && (
                    <td className="px-4 py-2.5">
                      <Switch checked={Boolean((row as Record<string, unknown>)[toggleField.key])} onChange={(next) => handleToggle(row, next)} />
                    </td>
                  )}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => openEdit(row)}
                        className="p-1.5 rounded-lg text-stone-500 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
                        aria-label="Edit"
                      >
                        <FiEdit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(row)}
                        className="p-1.5 rounded-lg text-stone-500 hover:text-terracotta-700 hover:bg-terracotta-50 dark:hover:bg-terracotta-950/40 transition-colors"
                        aria-label="Delete"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pageCount={pageCount}
          onPageChange={setPage}
          total={total}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />
        </div>
      )}

      <Modal open={modalOpen} title={editingId ? `Edit ${title}` : `Add ${title}`} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {fields.map((f) =>
            f.type === 'textarea' ? (
              <TextAreaField key={f.key} label={f.label} value={form[f.key] ?? ''} onChange={(v) => setForm({ ...form, [f.key]: v })} />
            ) : (
              <TextField
                key={f.key}
                label={f.label}
                type={f.type}
                value={form[f.key] ?? ''}
                onChange={(v) => setForm({ ...form, [f.key]: v })}
                required={f.required}
              />
            )
          )}
          <Button type="submit" variant="primary" fullWidth disabled={saving}>
            {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add'}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
