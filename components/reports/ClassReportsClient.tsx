'use client'

import { useEffect, useMemo, useState } from 'react'
import { FiArrowLeft, FiSearch } from 'react-icons/fi'
import { ReportTable, type ReportTableColumn } from '@/components/reports/ReportTable'
import { ExportButtons } from '@/components/reports/ExportButtons'
import { StudentReportView } from '@/components/reports/StudentReportView'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import type { StudentReport } from '@/lib/reports/studentReport'

interface ClassOption {
  id: string
  name: string
}

type ClassReportMode = 'all' | 'assignments' | 'exams'

function exportColumnsFor(mode: ClassReportMode) {
  const base = [{ header: 'Student', key: 'name' }]
  if (mode === 'all') {
    return [
      ...base,
      { header: 'Attendance %', key: 'attendancePct' },
      { header: 'Assignment Avg %', key: 'assignmentAvg' },
      { header: 'Exam Avg %', key: 'examAvg' },
    ]
  }
  if (mode === 'assignments') {
    return [...base, { header: 'Assignment Avg %', key: 'assignmentAvg' }]
  }
  return [...base, { header: 'Exam Avg %', key: 'examAvg' }]
}

// Class-picker + per-student summary table, with drill-down into one
// student's full StudentReportView. Shared by the teacher and admin
// Reports pages -- apiEndpoint is the only thing that differs between
// them (teacher's is RLS-scoped to their own classes; admin's covers
// every class via the service-role client).
//
// `mode` narrows the summary table/export/drill-down to just one score
// type -- used by the teacher Reports page's Assignments/Exams filter
// tabs (Attendance now has its own dedicated ClassAttendanceReport view
// instead). Defaults to 'all' for the admin Reports page, which has no
// such filter and still wants the combined view.
export function ClassReportsClient({
  classes,
  academicYear,
  apiEndpoint,
  mode = 'all',
}: {
  classes: ClassOption[]
  academicYear: string
  apiEndpoint: string
  mode?: ClassReportMode
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 200)
  const [rows, setRows] = useState<StudentReport[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<StudentReport | null>(null)

  useEffect(() => {
    if (!classId) {
      setRows([])
      return
    }
    setLoading(true)
    setRows(null)
    fetch(`${apiEndpoint}?classId=${classId}&academicYear=${encodeURIComponent(academicYear)}`)
      .then((res) => res.json())
      .then((data) => setRows(data.rows ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [classId, academicYear, apiEndpoint])

  const filtered = useMemo(() => {
    if (!rows) return []
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.studentName.toLowerCase().includes(q))
  }, [rows, debouncedSearch])

  const exportRows = useMemo(
    () =>
      filtered.map((r) => ({
        name: r.studentName,
        attendancePct: r.attendance.attendancePct ?? '',
        assignmentAvg: r.assignmentScores.averagePct ?? '',
        examAvg: r.examScores.averagePct ?? '',
      })),
    [filtered]
  )

  const columns: ReportTableColumn<StudentReport>[] = [
    {
      header: 'Student',
      accessor: (r) => (
        <button onClick={() => setSelected(r)} className="font-semibold text-primary-700 dark:text-primary-400 hover:underline">
          {r.studentName}
        </button>
      ),
    },
    ...(mode === 'all'
      ? [
          {
            header: 'Attendance',
            accessor: (r: StudentReport) => (r.attendance.attendancePct !== null ? `${r.attendance.attendancePct}%` : '—'),
            align: 'right' as const,
          },
        ]
      : []),
    ...(mode !== 'exams'
      ? [
          {
            header: 'Assignment Avg.',
            accessor: (r: StudentReport) => (r.assignmentScores.averagePct !== null ? `${r.assignmentScores.averagePct}%` : '—'),
            align: 'right' as const,
          },
        ]
      : []),
    ...(mode !== 'assignments'
      ? [
          {
            header: 'Exam Avg.',
            accessor: (r: StudentReport) => (r.examScores.averagePct !== null ? `${r.examScores.averagePct}%` : '—'),
            align: 'right' as const,
          },
        ]
      : []),
  ]

  if (classes.length === 0) {
    return <EmptyState title="No classes yet" />
  }

  if (selected) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelected(null)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 dark:text-primary-400 hover:underline"
        >
          <FiArrowLeft className="w-4 h-4" /> Back to class report
        </button>
        <StudentReportView report={selected} academicYear={academicYear} mode={mode} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student..."
              className="pl-9 pr-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent w-48"
            />
          </div>
        </div>
        <ExportButtons filename="class-report" title="Class Report" columns={exportColumnsFor(mode)} rows={exportRows} />
      </div>

      {loading || rows === null ? (
        <p className="text-sm text-stone-400 dark:text-stone-500">Loading report...</p>
      ) : (
        <ReportTable columns={columns} rows={filtered} keyFor={(r) => r.studentId} emptyTitle="No students found" />
      )}
    </div>
  )
}
