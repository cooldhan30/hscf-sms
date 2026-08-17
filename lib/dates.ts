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
