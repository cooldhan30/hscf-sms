'use client'

import { useState } from 'react'
import { AttendanceCalendar, type AttendanceCellStatus } from '@/components/attendance/AttendanceCalendar'

export interface AttendanceRecordRow {
  date: string
  status: AttendanceCellStatus
  notes: string | null
  class: { name: string }
}

const STATUS_LABEL: Record<string, string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  excused: 'Excused',
}

const STATUS_COLOR: Record<string, string> = {
  present: 'bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300',
  absent: 'bg-terracotta-100 text-terracotta-800 dark:bg-terracotta-950 dark:text-terracotta-300',
  late: 'bg-gold-100 text-gold-800 dark:bg-gold-950 dark:text-gold-300',
  excused: 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
}

// Same two-column calendar-plus-detail-panel layout as the teacher's
// AttendanceClient (and the admin cross-class view) -- click a date on
// the calendar, see that day's record on the right. Read-only: no
// marking UI, just whatever the teacher already recorded. Shared between
// the student and parent attendance pages (a parent viewing their child's
// attendance needs exactly the same view a student sees of their own).
export function AttendanceRecordView({ records }: { records: AttendanceRecordRow[] }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(records[0]?.date ?? null)

  const dateStatus = Object.fromEntries(records.map((r) => [r.date, r.status]))
  const recordByDate = new Map(records.map((r) => [r.date, r]))
  const selected = selectedDate ? recordByDate.get(selectedDate) : undefined

  return (
    <div className="grid md:grid-cols-2 gap-4 items-start">
      <div>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-2">
          Click a date to see that day&apos;s attendance.
        </p>
        <AttendanceCalendar dateStatus={dateStatus} selectedDate={selectedDate ?? undefined} onDateClick={setSelectedDate} />
      </div>

      <div className="space-y-3">
        {selectedDate && (
          <p className="font-bold text-stone-800 dark:text-stone-100">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        )}

        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4">
          {selected ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-stone-800 dark:text-stone-100">{selected.class.name}</p>
                {selected.notes && <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{selected.notes}</p>}
              </div>
              <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 ${STATUS_COLOR[selected.status]}`}>
                {STATUS_LABEL[selected.status]}
              </span>
            </div>
          ) : (
            <p className="text-sm text-stone-400 dark:text-stone-600">No attendance recorded for this date.</p>
          )}
        </div>
      </div>
    </div>
  )
}
