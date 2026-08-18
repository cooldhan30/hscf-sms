'use client'

import { useMemo, useState } from 'react'
import { FiSearch, FiUsers, FiCheckCircle } from 'react-icons/fi'
import { ReportTable, type ReportTableColumn } from '@/components/reports/ReportTable'
import { ExportButtons } from '@/components/reports/ExportButtons'
import { StatCard } from '@/components/reports/StatCard'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'

export interface StudentReportRow {
  id: string
  name: string
  gradeLevel: string
  email: string | null
  phone: string | null
  enrollmentStatus: string
  academicYear: string
  parentNames: string[]
  parentEmails: string[]
  parentPhones: string[]
  paymentStatus: string
}

const EXPORT_COLUMNS = [
  { header: 'Name', key: 'name' },
  { header: 'Nilai', key: 'gradeLevel' },
  { header: 'Email', key: 'email' },
  { header: 'Phone', key: 'phone' },
  { header: 'Enrollment Status', key: 'enrollmentStatus' },
  { header: 'Parent/Guardian', key: 'parentNames' },
  { header: 'Parent Email', key: 'parentEmails' },
  { header: 'Parent Phone', key: 'parentPhones' },
  { header: 'Payment Status', key: 'paymentStatus' },
]

export function StudentReportClient({ rows }: { rows: StudentReportRow[] }) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 200)

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      [r.name, r.gradeLevel, r.email, ...r.parentNames].some((v) => v?.toLowerCase().includes(q))
    )
  }, [rows, debouncedSearch])

  const exportRows = useMemo(
    () =>
      filtered.map((r) => ({
        name: r.name,
        gradeLevel: r.gradeLevel,
        email: r.email ?? '',
        phone: r.phone ?? '',
        enrollmentStatus: r.enrollmentStatus,
        parentNames: r.parentNames.join('; '),
        parentEmails: r.parentEmails.join('; '),
        parentPhones: r.parentPhones.join('; '),
        paymentStatus: r.paymentStatus === 'paid' ? 'Paid' : 'Unpaid',
      })),
    [filtered]
  )

  const columns: ReportTableColumn<StudentReportRow>[] = [
    { header: 'Name', accessor: (r) => r.name },
    { header: 'Nilai', accessor: (r) => r.gradeLevel },
    { header: 'Email', accessor: (r) => r.email ?? '—' },
    { header: 'Phone', accessor: (r) => r.phone ?? '—' },
    {
      header: 'Parent/Guardian',
      accessor: (r) =>
        r.parentNames.length ? (
          <div className="space-y-0.5">
            {r.parentNames.map((name, i) => (
              <div key={i}>
                {name}
                {r.parentPhones[i] ? ` · ${r.parentPhones[i]}` : ''}
              </div>
            ))}
          </div>
        ) : (
          '—'
        ),
    },
    {
      header: 'Payment',
      accessor: (r) => (
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
            r.paymentStatus === 'paid'
              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
              : 'bg-terracotta-100 text-terracotta-700 dark:bg-terracotta-900/40 dark:text-terracotta-300'
          }`}
        >
          {r.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
        </span>
      ),
    },
  ]

  const paidCount = rows.filter((r) => r.paymentStatus === 'paid').length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
        <StatCard label="Total Students" value={rows.length} icon={FiUsers} tone="primary" />
        <StatCard label="Paid This Year" value={`${paidCount} / ${rows.length}`} icon={FiCheckCircle} tone="gold" />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          />
        </div>
        <ExportButtons filename="student-details" title="Student Details" columns={EXPORT_COLUMNS} rows={exportRows} />
      </div>

      <ReportTable
        columns={columns}
        rows={filtered}
        keyFor={(r) => r.id}
        emptyTitle="No students found"
      />
    </div>
  )
}
