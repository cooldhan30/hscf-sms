'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FiSearch, FiPlus, FiEdit2, FiUsers } from 'react-icons/fi'
import { JoinCodeBadge } from '@/components/classes/JoinCodeBadge'
import { DataTable, type DataTableColumn } from '@/components/dashboard/DataTable'
import { Modal } from '@/components/dashboard/Modal'
import { Button } from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/ConfirmDialogProvider'
import { GRADE_LEVEL_OPTIONS } from '@/lib/constants'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
// Type-only import, so the 'server-only' module it lives in is erased at
// compile time and never pulled into this client bundle.
import type { DuplicateClass } from '@/lib/duplicate-class'
import type { SmsClass, SmsProfile, SmsTeacher } from '@/types/database'

type TeacherWithProfile = SmsTeacher & { profile: SmsProfile }
type ClassRow = SmsClass & { teacher: TeacherWithProfile | null }

interface FormState {
  id?: string
  name: string
  gradeLevel: string
  teacherId: string
  scheduleDay: string
  startTime: string
  endTime: string
  room: string
}

const EMPTY_FORM: FormState = {
  name: '',
  gradeLevel: '',
  teacherId: '',
  scheduleDay: '',
  startTime: '',
  endTime: '',
  room: '',
}

export function ClassesClient({
  initialClasses,
  teachers,
}: {
  initialClasses: ClassRow[]
  teachers: TeacherWithProfile[]
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 200)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return initialClasses
    return initialClasses.filter((c) => {
      const teacherName = c.teacher ? `${c.teacher.profile.first_name} ${c.teacher.profile.last_name}` : ''
      return c.name.toLowerCase().includes(q) || teacherName.toLowerCase().includes(q)
    })
  }, [initialClasses, debouncedSearch])

  function openAdd() {
    setForm(EMPTY_FORM)
    setError(null)
    setModalOpen(true)
  }

  function openEdit(c: ClassRow) {
    setForm({
      id: c.id,
      name: c.name,
      gradeLevel: c.grade_level ?? '',
      teacherId: c.teacher_id ?? '',
      scheduleDay: c.schedule_day ?? '',
      startTime: c.start_time ?? '',
      endTime: c.end_time ?? '',
      room: c.room ?? '',
    })
    setError(null)
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submit(false)
  }

  // All admins share one class list, so the other admin may have already
  // created this exact class. The API answers 409 when it spots a
  // same-name/same-year match; show them what already exists and let them
  // decide, since multiple sections of one grade are legitimate.
  async function submit(confirmDuplicate: boolean) {
    setSaving(true)
    setError(null)

    const isEdit = Boolean(form.id)
    const url = isEdit ? `/api/admin/classes/${form.id}` : '/api/admin/classes'
    const method = isEdit ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        gradeLevel: form.gradeLevel,
        teacherId: form.teacherId || null,
        scheduleDay: form.scheduleDay,
        startTime: form.startTime,
        endTime: form.endTime,
        room: form.room,
        confirmDuplicate,
      }),
    })

    const data = await res.json().catch(() => ({}))
    setSaving(false)

    if (res.status === 409 && data.duplicate) {
      const proceed = await confirm({
        title: 'This class may already exist',
        description: `${describeDuplicate(data.duplicate)} ${
          isEdit ? 'Rename this class anyway?' : 'Create a second class with this name anyway?'
        }`,
        confirmLabel: isEdit ? 'Rename anyway' : 'Create anyway',
        tone: 'danger',
      })
      if (proceed) await submit(true)
      return
    }

    if (!res.ok) {
      setError(data.error || 'Something went wrong')
      return
    }

    setModalOpen(false)
    router.refresh()
  }

  const columns: DataTableColumn<ClassRow>[] = [
    { header: 'Class', accessor: (c) => <span className="font-semibold text-stone-800 dark:text-stone-100">{c.name}</span> },
    {
      header: 'Grade Level',
      accessor: (c) => GRADE_LEVEL_OPTIONS.find((g) => g.value === c.grade_level)?.label || c.grade_level || '—',
    },
    {
      header: 'Teacher',
      accessor: (c) =>
        c.teacher && c.teacher.profile.is_active ? `${c.teacher.profile.first_name} ${c.teacher.profile.last_name}` : 'Unassigned',
    },
    {
      header: 'Join Code',
      accessor: (c) => (c.join_code ? <JoinCodeBadge code={c.join_code} /> : '—'),
    },
    {
      header: 'Schedule',
      accessor: (c) =>
        c.schedule_day || c.start_time
          ? `${c.schedule_day ?? ''} ${c.start_time ?? ''}${c.end_time ? ` - ${c.end_time}` : ''}`.trim()
          : '—',
    },
    {
      header: '',
      accessor: (c) => (
        <div className="flex items-center gap-2 justify-end">
          <Link
            href={`/admin/classes/${c.id}`}
            className="p-2 rounded-lg text-stone-500 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors inline-flex"
            aria-label="View roster"
          >
            <FiUsers className="w-4 h-4" />
          </Link>
          <button
            onClick={() => openEdit(c)}
            className="p-2 rounded-lg text-stone-500 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
            aria-label="Edit class"
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
            placeholder="Search classes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          />
        </div>
        <Button variant="primary" icon={<FiPlus />} onClick={openAdd}>
          Add Class
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        keyFor={(c) => c.id}
        emptyTitle="No classes found"
        emptyDescription="Create your first class to get started."
      />

      <Modal open={modalOpen} title={form.id ? 'Edit Class' : 'Add Class'} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Field label="Class Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />

          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                Teacher
              </label>
              <select
                value={form.teacherId}
                onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
              >
                <option value="">Unassigned</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.profile.first_name} {t.profile.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Day" value={form.scheduleDay} onChange={(v) => setForm({ ...form, scheduleDay: v })} placeholder="Sunday" />
            <Field label="Start Time" value={form.startTime} onChange={(v) => setForm({ ...form, startTime: v })} placeholder="3:00 PM" />
            <Field label="End Time" value={form.endTime} onChange={(v) => setForm({ ...form, endTime: v })} placeholder="4:30 PM" />
          </div>

          <Field label="Room" value={form.room} onChange={(v) => setForm({ ...form, room: v })} />

          <Button type="submit" variant="primary" fullWidth disabled={saving}>
            {saving ? 'Saving...' : form.id ? 'Save Changes' : 'Create Class'}
          </Button>
        </form>
      </Modal>
    </div>
  )
}

// Enough detail for an admin to tell "my colleague already made this" from
// "this is the afternoon section, which is genuinely different".
function describeDuplicate(dup: DuplicateClass): string {
  const schedule = [dup.scheduleDay, [dup.startTime, dup.endTime].filter(Boolean).join(' - ')]
    .filter(Boolean)
    .join(' ')

  const details = [
    GRADE_LEVEL_OPTIONS.find((g) => g.value === dup.gradeLevel)?.label || dup.gradeLevel,
    schedule,
    dup.room ? `Room ${dup.room}` : null,
    dup.teacherName,
  ].filter(Boolean)

  const summary = details.length > 0 ? ` (${details.join(' · ')})` : ''
  return `"${dup.name}" already exists for ${dup.academicYear}${summary}.`
}

function Field({
  label,
  value,
  onChange,
  required = false,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
      />
    </div>
  )
}
