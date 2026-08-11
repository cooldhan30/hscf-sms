'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { FiCheck, FiSave } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { AttendanceCalendar } from '@/components/attendance/AttendanceCalendar'

interface ClassOption {
  id: string
  name: string
  grade_level: string | null
}

interface RosterStudent {
  id: string
  first_name: string
  last_name: string
}

interface AttendanceRecord {
  student_id: string
  status: 'present' | 'absent' | 'late' | 'excused'
  notes: string | null
}

const STATUS_OPTIONS: { value: AttendanceRecord['status']; label: string; color: string }[] = [
  { value: 'present', label: 'Present', color: 'bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300' },
  { value: 'absent', label: 'Absent', color: 'bg-terracotta-100 text-terracotta-800 dark:bg-terracotta-950 dark:text-terracotta-300' },
  { value: 'late', label: 'Late', color: 'bg-gold-100 text-gold-800 dark:bg-gold-950 dark:text-gold-300' },
  { value: 'excused', label: 'Excused', color: 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300' },
]

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function AttendanceClient({ classes }: { classes: ClassOption[] }) {
  const searchParams = useSearchParams()
  const requestedClassId = searchParams.get('classId')
  const initialClassId =
    requestedClassId && classes.some((c) => c.id === requestedClassId) ? requestedClassId : classes[0]?.id ?? ''
  const [classId, setClassId] = useState(initialClassId)
  const [date, setDate] = useState(todayISO())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [roster, setRoster] = useState<RosterStudent[]>([])
  const [marks, setMarks] = useState<Record<string, { status: AttendanceRecord['status']; notes: string }>>({})
  const [error, setError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [markedDates, setMarkedDates] = useState<string[]>([])

  // Which dates in the visible month already have attendance recorded,
  // so the calendar can shade them -- refetched whenever the class or
  // save state changes (calendarMonth tracks the *displayed* month,
  // independent of the selected marking date).
  const [calendarMonth, setCalendarMonth] = useState(date.slice(0, 7))

  useEffect(() => {
    if (!classId) return
    let cancelled = false
    fetch(`/api/teacher/attendance?classId=${classId}&month=${calendarMonth}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setMarkedDates(d.markedDates ?? [])
      })
    return () => {
      cancelled = true
    }
  }, [classId, calendarMonth, savedMessage])

  useEffect(() => {
    if (!classId || !date) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      setSavedMessage(null)
      const res = await fetch(`/api/teacher/attendance?classId=${classId}&date=${date}`)
      const data = await res.json().catch(() => ({}))
      if (cancelled) return
      setLoading(false)

      if (!res.ok) {
        setError(data.error || 'Failed to load attendance')
        return
      }

      setRoster(data.roster ?? [])
      const initial: Record<string, { status: AttendanceRecord['status']; notes: string }> = {}
      for (const s of data.roster ?? []) {
        const existing = (data.attendance ?? []).find((a: AttendanceRecord) => a.student_id === s.id)
        initial[s.id] = { status: existing?.status ?? 'present', notes: existing?.notes ?? '' }
      }
      setMarks(initial)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [classId, date])

  function setMark(studentId: string, status: AttendanceRecord['status']) {
    setMarks((prev) => ({ ...prev, [studentId]: { ...prev[studentId], status } }))
  }

  function setNotes(studentId: string, notes: string) {
    setMarks((prev) => ({ ...prev, [studentId]: { ...prev[studentId], notes } }))
  }

  async function submit() {
    setSaving(true)
    setError(null)
    setSavedMessage(null)

    const records = roster.map((s) => ({
      studentId: s.id,
      status: marks[s.id]?.status ?? 'present',
      notes: marks[s.id]?.notes ?? '',
    }))

    const res = await fetch('/api/teacher/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, date, records }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)

    if (!res.ok) {
      setError(data.error || 'Failed to save attendance')
      return
    }

    setSavedMessage('Attendance saved.')
  }

  if (classes.length === 0) {
    return <EmptyState title="No classes assigned" description="Once you're assigned a class, you can take attendance here." />
  }

  const dateStatus = Object.fromEntries(markedDates.map((d) => [d, 'marked' as const]))

  return (
    <div className="space-y-4">
      <select
        value={classId}
        onChange={(e) => setClassId(e.target.value)}
        className="w-full sm:w-auto px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
      >
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <div className="grid md:grid-cols-2 gap-4 items-start">
        <div>
          <p className="text-sm text-stone-500 dark:text-stone-400 mb-2">
            Click a date to mark attendance for that day. Dates with attendance already recorded are shaded.
          </p>
          <AttendanceCalendar
            dateStatus={dateStatus}
            selectedDate={date}
            onDateClick={(d) => {
              setDate(d)
              setCalendarMonth(d.slice(0, 7))
            }}
            initialYear={Number(calendarMonth.slice(0, 4))}
            initialMonth={Number(calendarMonth.slice(5, 7)) - 1}
            legend={false}
          />
        </div>

        <div className="space-y-3">
          <p className="font-bold text-stone-800 dark:text-stone-100">
            {new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          {error && (
            <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {savedMessage && (
            <p className="flex items-center gap-2 text-sm text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-900 rounded-lg px-3 py-2">
              <FiCheck className="w-4 h-4" /> {savedMessage}
            </p>
          )}

          {loading ? (
            <SkeletonTable rows={8} columns={4} />
          ) : roster.length === 0 ? (
            <EmptyState title="No students enrolled in this class" />
          ) : (
            <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 divide-y divide-stone-100 dark:divide-stone-800">
              {roster.map((s) => (
                <div key={s.id} className="p-4 flex flex-col gap-3">
                  <div className="font-semibold text-stone-800 dark:text-stone-100">
                    {s.first_name} {s.last_name}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((opt) => {
                      const active = marks[s.id]?.status === opt.value
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setMark(s.id, opt.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            active ? opt.color : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                  <input
                    type="text"
                    placeholder="Notes (optional)"
                    value={marks[s.id]?.notes ?? ''}
                    onChange={(e) => setNotes(s.id, e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                  />
                </div>
              ))}
            </div>
          )}

          {roster.length > 0 && (
            <Button variant="primary" icon={<FiSave />} disabled={saving} onClick={submit}>
              {saving ? 'Saving...' : 'Save Attendance'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
