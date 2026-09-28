// sms_assignments.due_date (migration 004) is a plain Postgres DATE --
// "YYYY-MM-DD", no time or timezone. `new Date(dateStr)` parses that as
// UTC midnight, which then renders one calendar day EARLY via
// .toLocaleDateString() in any timezone behind UTC (this app's whole
// US-based user base) and makes "is this overdue" comparisons against
// `now` fire hours before the actual due date. Every date-only value
// must go through these instead of `new Date(str)` directly.

export function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatDateOnly(dateStr: string): string {
  return parseDateOnly(dateStr).toLocaleDateString()
}

// An assignment "due the 24th" stays on-time through the end of the
// 24th, local time -- not until UTC midnight, which lands mid-afternoon
// on the 24th itself for US timezones.
export function isPastDueDate(dateStr: string, now: Date = new Date()): boolean {
  const due = parseDateOnly(dateStr)
  due.setHours(23, 59, 59, 999)
  return now > due
}

// Assignment list order for every role: still-open work by nearest due
// date first, then past-due work (most recently due first), then
// anything with no due date.
export function sortByDueDate<T extends { due_date: string | null }>(rows: T[], now: Date = new Date()): T[] {
  const rank = (r: T) => (!r.due_date ? 2 : isPastDueDate(r.due_date, now) ? 1 : 0)
  return [...rows].sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    if (ra !== rb) return ra - rb
    if (ra === 2) return 0
    // due_date is YYYY-MM-DD, so string order is date order
    return ra === 0 ? a.due_date!.localeCompare(b.due_date!) : b.due_date!.localeCompare(a.due_date!)
  })
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// The school's first-ever class day. sms_academic_years.start_date
// isn't populated today, so this is a fixed stand-in rather than
// depending on an unset column.
const FIRST_SCHOOL_DAY = new Date(2026, 7, 9)

// Every Sunday from the school's first day (or the academic year's
// starting calendar year, if that year started later) through today,
// most recent first -- this school's classes run on Sundays only.
export function getSundaysInAcademicYear(academicYear: string, now: Date = new Date()): string[] {
  const startYear = Number(academicYear.split('-')[0])
  if (!Number.isFinite(startYear)) return []

  // Truncated to local midnight so today itself is included when it's a
  // Sunday -- comparing against a `now` that still carries a
  // time-of-day would otherwise exclude today depending on the hour.
  const todayLocalMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const yearStart = new Date(startYear, 7, 1)
  yearStart.setDate(yearStart.getDate() + ((7 - yearStart.getDay()) % 7))
  const cursor = yearStart > FIRST_SCHOOL_DAY ? yearStart : new Date(FIRST_SCHOOL_DAY)

  const sundays: string[] = []
  while (cursor <= todayLocalMidnight) {
    sundays.push(toISODate(cursor))
    cursor.setDate(cursor.getDate() + 7)
  }

  return sundays.reverse()
}
