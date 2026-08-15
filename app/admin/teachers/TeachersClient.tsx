'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiSearch, FiPlus, FiEdit2, FiSlash, FiCheckCircle, FiTrash2, FiRotateCcw } from 'react-icons/fi'
import { DataTable, type DataTableColumn } from '@/components/dashboard/DataTable'
import { Modal } from '@/components/dashboard/Modal'
import { Button } from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/ConfirmDialogProvider'
import { toast } from '@/lib/toast'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import type { SmsProfile, SmsTeacher } from '@/types/database'

type TeacherRow = SmsTeacher & { profile: SmsProfile }

interface FormState {
  id?: string
  firstName: string
  lastName: string
  email: string
  phone: string
  avatarUrl: string
  employeeId: string
  subjectSpecialty: string
  bio: string
}

const EMPTY_FORM: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  avatarUrl: '',
  employeeId: '',
  subjectSpecialty: '',
  bio: '',
}

export function TeachersClient({
  initialTeachers,
  deletedTeachers,
}: {
  initialTeachers: TeacherRow[]
  deletedTeachers: TeacherRow[]
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [tab, setTab] = useState<'active' | 'deleted'>('active')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 200)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const sourceTeachers = tab === 'active' ? initialTeachers : deletedTeachers

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return sourceTeachers
    return sourceTeachers.filter((t) => {
      const name = `${t.profile.first_name} ${t.profile.last_name}`.toLowerCase()
      return (
        name.includes(q) ||
        (t.profile.email ?? '').toLowerCase().includes(q) ||
        (t.employee_id ?? '').toLowerCase().includes(q) ||
        (t.subject_specialty ?? '').toLowerCase().includes(q)
      )
    })
  }, [sourceTeachers, debouncedSearch])

  function openAdd() {
    setForm(EMPTY_FORM)
    setError(null)
    setModalOpen(true)
  }

  function openEdit(t: TeacherRow) {
    setForm({
      id: t.id,
      firstName: t.profile.first_name,
      lastName: t.profile.last_name,
      email: t.profile.email ?? '',
      phone: t.profile.phone ?? '',
      avatarUrl: t.profile.avatar_url ?? '',
      employeeId: t.employee_id ?? '',
      subjectSpecialty: t.subject_specialty ?? '',
      bio: t.bio ?? '',
    })
    setError(null)
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const isEdit = Boolean(form.id)
    const url = isEdit ? `/api/admin/teachers/${form.id}` : '/api/admin/teachers'
    const method = isEdit ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        avatarUrl: form.avatarUrl,
        employeeId: form.employeeId,
        subjectSpecialty: form.subjectSpecialty,
        bio: form.bio,
      }),
    })

    const data = await res.json().catch(() => ({}))
    setSaving(false)

    if (!res.ok) {
      setError(data.error || 'Something went wrong')
      return
    }

    setModalOpen(false)
    toast.success(isEdit ? 'Teacher updated' : 'Teacher added')
    if (data.tempPassword) {
      toast.success(`Temp password for ${form.email}: ${data.tempPassword}`, { duration: 30000 })
    }
    router.refresh()
  }

  async function toggleActive(t: TeacherRow) {
    const nextActive = !t.profile.is_active
    const name = `${t.profile.first_name} ${t.profile.last_name}`
    const confirmed = await confirm({
      title: nextActive ? `Re-enable ${name}?` : `Disable ${name}?`,
      description: nextActive ? undefined : 'They will lose access immediately.',
      confirmLabel: nextActive ? 'Re-enable' : 'Disable',
      tone: nextActive ? 'default' : 'danger',
    })
    if (!confirmed) return

    const res = await fetch(`/api/admin/teachers/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: nextActive }),
    })

    if (res.ok) {
      toast.success(nextActive ? `${name} re-enabled` : `${name} disabled`)
      router.refresh()
    } else {
      toast.error('Failed to update teacher status')
    }
  }

  async function deleteTeacher(t: TeacherRow) {
    const name = `${t.profile.first_name} ${t.profile.last_name}`
    const confirmed = await confirm({
      title: `Delete ${name}?`,
      description: 'They lose access immediately and move to the Deleted tab. Their attendance, grade, and assignment history is kept, and they can be restored later.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!confirmed) return

    const res = await fetch(`/api/admin/teachers/${t.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))

    if (res.ok) {
      toast.success(`${name} deleted`)
      router.refresh()
    } else {
      toast.error(data.error || 'Failed to delete teacher')
    }
  }

  async function restoreTeacher(t: TeacherRow) {
    const name = `${t.profile.first_name} ${t.profile.last_name}`
    const res = await fetch(`/api/admin/teachers/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: true }),
    })

    if (res.ok) {
      toast.success(`${name} restored`)
      router.refresh()
    } else {
      toast.error('Failed to restore teacher')
    }
  }

  async function purgeTeacher(t: TeacherRow) {
    const name = `${t.profile.first_name} ${t.profile.last_name}`
    const confirmed = await confirm({
      title: `Permanently delete ${name}?`,
      description:
        'This cannot be undone. Their login and profile are erased entirely. Attendance, grades, and assignments they recorded stay on students’ records but lose the "by" attribution; chat messages they sent are removed.',
      confirmLabel: 'Permanently Delete',
      tone: 'danger',
    })
    if (!confirmed) return

    const res = await fetch(`/api/admin/teachers/${t.id}/purge`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))

    if (res.ok) {
      toast.success(`${name} permanently deleted`)
      router.refresh()
    } else {
      toast.error(data.error || 'Failed to permanently delete teacher')
    }
  }

  const columns: DataTableColumn<TeacherRow>[] = [
    {
      header: 'Name',
      accessor: (t) => (
        <div>
          <p className="font-semibold text-stone-800 dark:text-stone-100">
            {t.profile.first_name} {t.profile.last_name}
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400">{t.profile.email}</p>
        </div>
      ),
    },
    { header: 'Employee ID', accessor: (t) => t.employee_id || '—' },
    { header: 'Specialty', accessor: (t) => t.subject_specialty || '—' },
    { header: 'Phone', accessor: (t) => t.profile.phone || '—' },
    {
      header: 'Status',
      accessor: (t) => (
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
            t.profile.is_active
              ? 'bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300'
              : 'bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
          }`}
        >
          {t.profile.is_active ? 'Active' : 'Disabled'}
        </span>
      ),
    },
    {
      header: '',
      accessor: (t) =>
        tab === 'deleted' ? (
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => restoreTeacher(t)}
              className="p-2 rounded-lg text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
              aria-label="Restore teacher"
            >
              <FiRotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => purgeTeacher(t)}
              className="p-2 rounded-lg text-terracotta-600 hover:bg-terracotta-50 dark:hover:bg-terracotta-950/40 transition-colors"
              aria-label="Permanently delete teacher"
            >
              <FiTrash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => openEdit(t)}
              className="p-2 rounded-lg text-stone-500 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
              aria-label="Edit teacher"
            >
              <FiEdit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => toggleActive(t)}
              className={`p-2 rounded-lg transition-colors ${
                t.profile.is_active
                  ? 'text-terracotta-600 hover:bg-terracotta-50 dark:hover:bg-terracotta-950/40'
                  : 'text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40'
              }`}
              aria-label={t.profile.is_active ? 'Disable teacher' : 'Enable teacher'}
            >
              {t.profile.is_active ? <FiSlash className="w-4 h-4" /> : <FiCheckCircle className="w-4 h-4" />}
            </button>
            <button
              onClick={() => deleteTeacher(t)}
              className="p-2 rounded-lg text-terracotta-600 hover:bg-terracotta-50 dark:hover:bg-terracotta-950/40 transition-colors"
              aria-label="Delete teacher"
            >
              <FiTrash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      className: 'text-right',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-stone-200 dark:border-stone-800">
        {(['active', 'deleted'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-primary-600 text-primary-700 dark:text-primary-300'
                : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
            }`}
          >
            {key === 'active' ? 'Active' : `Deleted (${deletedTeachers.length})`}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Search teachers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          />
        </div>
        {tab === 'active' && (
          <Button variant="primary" icon={<FiPlus />} onClick={openAdd}>
            Add Teacher
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        keyFor={(t) => t.id}
        emptyTitle="No teachers found"
        emptyDescription="Add your first teacher to get started."
      />

      <Modal open={modalOpen} title={form.id ? 'Edit Teacher' : 'Add Teacher'} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} required />
            <Field label="Last Name" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} required />
          </div>

          <Field
            label="Email"
            type="email"
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
            required
            disabled={Boolean(form.id)}
          />
          {form.id && (
            <p className="text-xs text-stone-500 dark:text-stone-400 -mt-2">
              Email can&apos;t be changed after account creation.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <Field label="Avatar URL" value={form.avatarUrl} onChange={(v) => setForm({ ...form, avatarUrl: v })} />
          </div>

          <Field label="Employee ID" value={form.employeeId} onChange={(v) => setForm({ ...form, employeeId: v })} />
          <Field
            label="Subject Specialty"
            value={form.subjectSpecialty}
            onChange={(v) => setForm({ ...form, subjectSpecialty: v })}
          />

          <div>
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Bio</label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            />
          </div>

          {!form.id && (
            <p className="text-xs text-stone-500 dark:text-stone-400">
              An invitation email will be sent so the teacher can set their own password.
            </p>
          )}

          <Button type="submit" variant="primary" fullWidth disabled={saving}>
            {saving ? 'Saving...' : form.id ? 'Save Changes' : 'Create Teacher'}
          </Button>
        </form>
      </Modal>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  disabled = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  disabled?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent disabled:opacity-60"
      />
    </div>
  )
}
