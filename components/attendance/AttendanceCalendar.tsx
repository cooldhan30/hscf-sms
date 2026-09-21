'use client'

import { useState } from 'react'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'

export type AttendanceCellStatus = 'present' | 'absent' | 'late' | 'excused' | 'holiday' | 'online' | 'marked'

const CELL_STYLES: Record<AttendanceCellStatus, string> = {
  present: 'bg-primary-500 text-white hover:bg-primary-600',
  marked: 'bg-primary-500 text-white hover:bg-primary-600',
  absent: 'bg-terracotta-500 text-white hover:bg-terracotta-600',
  late: 'bg-gold-500 text-white hover:bg-gold-600',
  excused: 'bg-stone-400 text-white hover:bg-stone-500 dark:bg-stone-600 dark:hover:bg-stone-500',
  holiday: 'bg-sky-500 text-white hover:bg-sky-600',
  online: 'bg-violet-500 text-white hover:bg-violet-600',
}

const LEGEND: { status: AttendanceCellStatus; label: string }[] = [
  { status: 'present', label: 'Present' },
  { status: 'absent', label: 'Absent' },
  { status: 'late', label: 'Tardy' },
  { status: 'excused', label: 'Excused' },
  { status: 'holiday', label: 'Holiday' },
  { status: 'online', label: 'Online' },
]

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function toISODate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function todayISO(): string {
  const d = new Date()
  return toISODate(d.getFullYear(), d.getMonth(), d.getDate())
}

// Reusable month-grid calendar for attendance. Two usage modes, both
// driven by the same `dateStatus` map (ISO date -> status):
//   - Read-only (student/parent/admin views): each date is shaded by
//     that student's actual status that day ('present' green, 'absent'
//     terracotta, etc).
//   - Interactive (teacher view): dates that have ANY attendance taken
//     for the class are shaded 'marked' (same green as present) as a
//     simple "attendance recorded" indicator, not tied to one student's
//     status. Clicking a date (marked or not) opens/selects it for
//     marking via onDateClick.
export function AttendanceCalendar({
  dateStatus,
  onDateClick,
  selectedDate,
  legend = true,
  initialYear,
  initialMonth,
  onMonthChange,
}: {
  dateStatus: Record<string, AttendanceCellStatus>
  onDateClick?: (date: string) => void
  selectedDate?: string
  legend?: boolean
  initialYear?: number
  initialMonth?: number
  // Called whenever the visible month changes via the chevrons, so a
  // parent tracking "which month is displayed" (e.g. to refetch which
  // dates are marked) doesn't go stale -- previously only clicking an
  // actual day told the parent anything, so navigating with the arrows
  // alone left old data (and its green shading) on screen until the
  // next click or a manual refresh.
  onMonthChange?: (year: number, month: number) => void
}) {
  const now = new Date()
  const [year, setYear] = useState(initialYear ?? now.getFullYear())
  const [month, setMonth] = useState(initialMonth ?? now.getMonth())

  function goToPrevMonth() {
    const [y, m] = month === 0 ? [year - 1, 11] : [year, month - 1]
    setYear(y)
    setMonth(m)
    onMonthChange?.(y, m)
  }

  function goToNextMonth() {
    const [y, m] = month === 11 ? [year + 1, 0] : [year, month + 1]
    setYear(y)
    setMonth(m)
    onMonthChange?.(y, m)
  }

  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const today = todayISO()
  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={goToPrevMonth}
          aria-label="Previous month"
          className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          <FiChevronLeft className="w-4 h-4" />
        </button>
        <h3 className="font-bold text-stone-800 dark:text-stone-100">{monthLabel}</h3>
        <button
          type="button"
          onClick={goToNextMonth}
          aria-label="Next month"
          className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          <FiChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-stone-400 dark:text-stone-500 mb-1">
        {WEEKDAY_LABELS.map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />
          const iso = toISODate(year, month, day)
          const status = dateStatus[iso]
          const isToday = iso === today
          const isSelected = iso === selectedDate
          const clickable = Boolean(onDateClick)

          return (
            <button
              key={iso}
              type="button"
              disabled={!clickable}
              onClick={() => onDateClick?.(iso === selectedDate ? '' : iso)}
              className={`aspect-square rounded-lg text-sm font-medium flex items-center justify-center transition-colors ${
                status
                  ? CELL_STYLES[status]
                  : 'text-stone-600 dark:text-stone-300' + (clickable ? ' hover:bg-stone-100 dark:hover:bg-stone-800' : '')
              } ${isSelected ? 'ring-2 ring-offset-2 ring-primary-600 dark:ring-offset-stone-900' : ''} ${
                isToday && !status ? 'font-bold text-primary-700 dark:text-primary-400' : ''
              } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {day}
            </button>
          )
        })}
      </div>

      {legend && (
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-stone-100 dark:border-stone-800">
          {LEGEND.map((l) => (
            <div key={l.status} className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
              <span className={`w-2.5 h-2.5 rounded-full ${CELL_STYLES[l.status].split(' ')[0]}`} />
              {l.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
