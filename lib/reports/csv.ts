export interface ExportColumn {
  header: string
  key: string
}

function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value)
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function downloadCsv(filename: string, columns: ExportColumn[], rows: Record<string, unknown>[]) {
  const lines = [
    columns.map((c) => escapeCsvCell(c.header)).join(','),
    ...rows.map((row) => columns.map((c) => escapeCsvCell(row[c.key])).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
