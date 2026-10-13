const DAY = 24 * 60 * 60 * 1000

export function formatDue(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// "Due today", "Due in 3 days", "2 days late"
export function dueLabel(iso: string, now = Date.now()): string {
  const due = new Date(iso)
  const startOf = (t: number) => new Date(new Date(t).toDateString()).getTime()
  const days = Math.round((startOf(due.getTime()) - startOf(now)) / DAY)
  if (due.getTime() < now) return days === 0 ? 'Was due today' : `${-days} day${days === -1 ? '' : 's'} late`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `Due in ${days} days`
}

export function isPast(iso: string, now = Date.now()): boolean {
  return new Date(iso).getTime() < now
}

// CSV with a UTF-8 BOM so Excel opens Tamil text correctly.
export function toCsv(rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    const s = v === null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n')
}

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function inDays(days: number, hour = 20): string {
  const d = new Date(Date.now() + days * DAY)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}
