'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FiSearch, FiPlus, FiEdit2, FiEye } from 'react-icons/fi'
import { DataTable, type DataTableColumn } from '@/components/dashboard/DataTable'
import { Modal } from '@/components/dashboard/Modal'
import { Button } from '@/components/ui/Button'
import { GRADE_LEVEL_OPTIONS } from '@/lib/constants'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { toast } from '@/lib/toast'
import type { SmsProfile, SmsStudent } from '@/types/database'

type StudentRow = SmsStudent & { profile: SmsProfile | null }

interface FormState {
  id?: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gradeLevel: string
  createLogin: boolean
  studentEmail: string
  parentFirstName: string
  parentLastName: string
  parentEmail: string
  parentPhone: string
}

const EMPTY_FORM: FormState = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gradeLevel: '',
  createLogin: false,
  studentEmail: '',
  parentFirstName: '',
  parentLastName: '',
  parentEmail: '',
  parentPhone: '',
}

export function StudentsClient({ initialStudents }: { initialStudents: StudentRow[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 200)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return initialStudents
    return initialStudents.filter((s) => {
      const name = `${s.first_name} ${s.last_name}`.toLowerCase()
      return name.includes(q) || (s.grade_level ?? '').toLowerCase().includes(q)
    })
  }, [initialStudents, debouncedSearch])

  function openAdd() {
    setForm(EMPTY_FORM)
    setError(null)
    setModalOpen(true)
  }

  function openEdit(s: StudentRow) {
    setForm({
      id: s.id,
      firstName: s.first_name,
      lastName: s.last_name,
      dateOfBirth: s.date_of_birth ?? '',
      gradeLevel: s.grade_level ?? '',
      createLogin: false,
      studentEmail: '',
      parentFirstName: '',
      parentLastName: '',
      parentEmail: '',
      parentPhone: '',
    })
    setError(null)
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const isEdit = Boolean(form.id)
    const url = isEdit ? `/api/admin/students/${form.id}` : '/api/admin/students'
    const method = isEdit ? 'PATCH' : 'POST'

    const body = isEdit
      ? {
          firstName: form.firstName,
          lastName: form.lastName,
          dateOfBirth: form.dateOfBirth,
          gradeLevel: form.gradeLevel,
        }
      : {
          firstName: form.firstName,
          lastName: form.lastName,
          dateOfBirth: form.dateOfBirth,
          gradeLevel: form.gradeLevel,
          createLogin: form.createLogin,
          studentEmail: form.studentEmail,
          parentFirstName: form.parentFirstName,
          parentLastName: form.parentLastName,
          parentEmail: form.parentEmail,
          parentPhone: form.parentPhone,
        }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json().catch(() => ({}))
    setSaving(false)

    if (!res.ok) {
      setError(data.error || 'Something went wrong')
      return
    }

    setModalOpen(false)
    if (data.studentTempPassword) {
      toast.success(`Temp password for ${form.studentEmail}: ${data.studentTempPassword}`, { duration: 30000 })
    }
    if (data.parentTempPassword) {
      toast.success(`Temp password for ${form.parentEmail}: ${data.parentTempPassword}`, { duration: 30000 })
    }
    router.refresh()
  }

  const columns: DataTableColumn<StudentRow>[] = [
    {
      header: 'Name',
      accessor: (s) => (
        <div>
          <p className="font-semibold text-stone-800 dark:text-stone-100">
            {s.first_name} {s.last_name}
          </p>
          {s.profile?.email && (
            <p className="text-xs text-stone-500 dark:text-stone-400">{s.profile.email}</p>
          )}
        </div>
      ),
    },
    {
      header: 'Grade Level',
      accessor: (s) => GRADE_LEVEL_OPTIONS.find((g) => g.value === s.grade_level)?.label || s.grade_level || '—',
    },
    {
      header: 'Login',
      accessor: (s) => (s.profile ? 'Yes' : 'No'),
    },
    {
      header: 'Status',
      accessor: (s) => (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300 capitalize">
          {s.enrollment_status}
        </span>
      ),
    },
    {
      header: '',
      accessor: (s) => (
        <div className="flex items-center gap-2 justify-end">
          <Link
            href={`/admin/students/${s.id}`}
            className="p-2 rounded-lg text-stone-500 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors inline-flex"
            aria-label="View student profile"
          >
            <FiEye className="w-4 h-4" />
          </Link>
          <button
            onClick={() => openEdit(s)}
            className="p-2 rounded-lg text-stone-500 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
            aria-label="Edit student"
          >
            <FiEdit2 className="w-4 h-4" />
          </button>
        </div>
      ),
      className: 'text-right',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          />
        </div>
        <Button variant="primary" icon={<FiPlus />} onClick={openAdd}>
          Add Student
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        keyFor={(s) => s.id}
        emptyTitle="No students found"
        emptyDescription="Add your first student to get started."
      />

      <Modal open={modalOpen} title={form.id ? 'Edit Student' : 'Add Student'} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            Student
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} required />
            <Field label="Last Name" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Date of Birth"
              type="date"
              value={form.dateOfBirth}
              onChange={(v) => setForm({ ...form, dateOfBirth: v })}
            />
            <div>
              <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                Grade Level
              </label>
              <select
                value={form.gradeLevel}
                onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
              >
                <option value="">Select...</option>
                {GRADE_LEVEL_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!form.id && (
            <>
              <label className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  checked={form.createLogin}
                  onChange={(e) => setForm({ ...form, createLogin: e.target.checked })}
                  className="w-4 h-4 rounded text-primary-600 focus:ring-primary-600"
                />
                <span className="text-sm text-stone-700 dark:text-stone-300">Create a login for this student</span>
              </label>
              {form.createLogin && (
                <Field
                  label="Student Email"
                  type="email"
                  value={form.studentEmail}
                  onChange={(v) => setForm({ ...form, studentEmail: v })}
                  required
                />
              )}

              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400 pt-2">
                Parent / Guardian (optional)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Parent First Name"
                  value={form.parentFirstName}
                  onChange={(v) => setForm({ ...form, parentFirstName: v })}
                />
                <Field
                  label="Parent Last Name"
                  value={form.parentLastName}
                  onChange={(v) => setForm({ ...form, parentLastName: v })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Parent Email"
                  type="email"
                  value={form.parentEmail}
                  onChange={(v) => setForm({ ...form, parentEmail: v })}
                />
                <Field
                  label="Parent Phone"
                  value={form.parentPhone}
                  onChange={(v) => setForm({ ...form, parentPhone: v })}
                />
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                If a parent account with this email already exists, the student will be linked to it instead of
                creating a duplicate. Otherwise a new parent account is invited by email.
              </p>
            </>
          )}

          <Button type="submit" variant="primary" fullWidth disabled={saving}>
            {saving ? 'Saving...' : form.id ? 'Save Changes' : 'Create Student'}
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
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
      />
    </div>
  )
}
