'use client'

import { useEffect, useState } from 'react'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { AttendanceCalendar } from '@/components/attendance/AttendanceCalendar'

interface ClassOption {
  id: string
  name: string
  grade_level: string | null
  teacher: { profile: { first_name: string; last_name: string } | null } | null
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
  marked_by_profile: { first_name: string; last_name: string } | null
}

const STATUS_LABEL: Record<AttendanceRecord['status'], string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  excused: 'Excused',
}

const STATUS_COLOR: Record<AttendanceRecord['status'], string> = {
  present: 'bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300',
  absent: 'bg-terracotta-100 text-terracotta-800 dark:bg-terracotta-950 dark:text-terracotta-300',
  late: 'bg-gold-100 text-gold-800 dark:bg-gold-950 dark:text-gold-300',
  excused: 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Read-only counterpart to the teacher's AttendanceClient -- same
// calendar-driven navigation, but no marking UI, and a class selector
// that spans every teacher instead of just the signed-in one's classes.
export function AdminAttendanceClient({ classes }: { classes: ClassOption[] }) {
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [date, setDate] = useState(todayISO())
  const [loading, setLoading] = useState(false)
  const [roster, setRoster] = useState<RosterStudent[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [markedDates, setMarkedDates] = useState<string[]>([])
  const [calendarMonth, setCalendarMonth] = useState(date.slice(0, 7))

  useEffect(() => {
    if (!classId) return
    let cancelled = false
    fetch(`/api/admin/attendance?classId=${classId}&month=${calendarMonth}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setMarkedDates(d.markedDates ?? [])
      })
    return () => {
      cancelled = true
    }
  }, [classId, calendarMonth])

  useEffect(() => {
    if (!classId || !date) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/admin/attendance?classId=${classId}&date=${date}`)
      const data = await res.json().catch(() => ({}))
      if (cancelled) return
      setLoading(false)

      if (!res.ok) {
        setError(data.error || 'Failed to load attendance')
        return
      }

      setRoster(data.roster ?? [])
      setAttendance(data.attendance ?? [])
    }

    load()
    return () => {
      cancelled = true
    }
  }, [classId, date])

  if (classes.length === 0) {
    return <EmptyState title="No classes yet" description="Once classes are created, attendance shows up here." />
  }

  const dateStatus = Object.fromEntries(markedDates.map((d) => [d, 'marked' as const]))
  const attendanceByStudent = Object.fromEntries(attendance.map((a) => [a.student_id, a]))

  return (
    <div className="space-y-4">
      <select
        value={classId}
        onChange={(e) => setClassId(e.target.value)}
        className="w-full sm:w-auto px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
      >
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} {c.teacher?.profile ? `— ${c.teacher.profile.first_name} ${c.teacher.profile.last_name}` : '(no teacher)'}
          </option>
        ))}
      </select>

      <div className="grid md:grid-cols-2 gap-4 items-start">
        <div>
          <p className="text-sm text-stone-500 dark:text-stone-400 mb-2">
            Click a date to view what was marked for this class that day. Dates with attendance recorded are shaded.
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

          {loading ? (
            <SkeletonTable rows={8} columns={4} />
          ) : roster.length === 0 ? (
            <EmptyState title="No students enrolled in this class" />
          ) : (
            <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 divide-y divide-stone-100 dark:divide-stone-800">
              {roster.map((s) => {
                const record = attendanceByStudent[s.id]
                return (
                  <div key={s.id} className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-stone-800 dark:text-stone-100">
                        {s.first_name} {s.last_name}
                      </p>
                      {record?.notes && <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{record.notes}</p>}
                      {record?.marked_by_profile && (
                        <p className="text-xs text-stone-400 dark:text-stone-600 mt-0.5">
                          Marked by {record.marked_by_profile.first_name} {record.marked_by_profile.last_name}
                        </p>
                      )}
                    </div>
                    <span
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 ${
                        record ? STATUS_COLOR[record.status] : 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-600'
                      }`}
                    >
                      {record ? STATUS_LABEL[record.status] : 'Not marked'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
