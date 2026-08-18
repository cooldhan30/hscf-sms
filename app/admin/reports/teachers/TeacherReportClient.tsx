'use client'

import { useMemo, useState } from 'react'
import { FiSearch } from 'react-icons/fi'
import { ReportTable, type ReportTableColumn } from '@/components/reports/ReportTable'
import { ExportButtons } from '@/components/reports/ExportButtons'
import { StatCard } from '@/components/reports/StatCard'
import { FiUsers, FiBookOpen } from 'react-icons/fi'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'

export interface TeacherReportRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  employeeId: string | null
  subjectSpecialty: string | null
  classes: string[]
  isActive: boolean
  joinedAt: string
}

const EXPORT_COLUMNS = [
  { header: 'Name', key: 'name' },
  { header: 'Employee ID', key: 'employeeId' },
  { header: 'Classes (Nilai)', key: 'classes' },
  { header: 'Subject', key: 'subjectSpecialty' },
  { header: 'Email', key: 'email' },
  { header: 'Phone', key: 'phone' },
  { header: 'Address', key: 'address' },
  { header: 'Status', key: 'status' },
  { header: 'Joined', key: 'joined' },
]

export function TeacherReportClient({ rows }: { rows: TeacherReportRow[] }) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 200)

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      [r.name, r.email, r.employeeId, r.subjectSpecialty, ...r.classes].some((v) => v?.toLowerCase().includes(q))
    )
  }, [rows, debouncedSearch])

  const exportRows = useMemo(
    () =>
      filtered.map((r) => ({
        name: r.name,
        employeeId: r.employeeId ?? '',
        classes: r.classes.join('; '),
        subjectSpecialty: r.subjectSpecialty ?? '',
        email: r.email ?? '',
        phone: r.phone ?? '',
        address: r.address ?? '',
        status: r.isActive ? 'Active' : 'Inactive',
        joined: new Date(r.joinedAt).toLocaleDateString(),
      })),
    [filtered]
  )

  const columns: ReportTableColumn<TeacherReportRow>[] = [
    { header: 'Name', accessor: (r) => r.name },
    { header: 'Nilai / Classes', accessor: (r) => (r.classes.length ? r.classes.join(', ') : '—') },
    { header: 'Subject', accessor: (r) => r.subjectSpecialty ?? '—' },
    { header: 'Email', accessor: (r) => r.email ?? '—' },
    { header: 'Phone', accessor: (r) => r.phone ?? '—' },
    { header: 'Address', accessor: (r) => r.address ?? '—' },
    {
      header: 'Status',
      accessor: (r) => (
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
            r.isActive
              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
              : 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'
          }`}
        >
          {r.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ]

  const withClasses = rows.filter((r) => r.classes.length > 0).length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
        <StatCard label="Total Teachers" value={rows.length} icon={FiUsers} tone="primary" />
        <StatCard label="Currently Teaching a Class" value={withClasses} icon={FiBookOpen} tone="gold" />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teachers..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          />
        </div>
        <ExportButtons filename="teacher-details" title="Teacher Details" columns={EXPORT_COLUMNS} rows={exportRows} />
      </div>

      <ReportTable
        columns={columns}
        rows={filtered}
        keyFor={(r) => r.id}
        emptyTitle="No teachers found"
      />
    </div>
  )
}
