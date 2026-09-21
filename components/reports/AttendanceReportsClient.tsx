'use client'

import { useEffect, useMemo, useState } from 'react'
import { FiDownload } from 'react-icons/fi'
import { ReportTable, type ReportTableColumn } from '@/components/reports/ReportTable'
import { ExportButtons } from '@/components/reports/ExportButtons'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { downloadCsv, type ExportColumn } from '@/lib/reports/csv'
import { formatDateOnly, getSundaysInAcademicYear } from '@/lib/dates'
import type { AttendanceStatus, ClassAttendanceReport } from '@/lib/reports/classAttendanceReport'

interface ClassOption {
  id: string
  name: string
}

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'Present',
  online: 'Online',
  late: 'Tardy',
  absent: 'Absent',
  excused: 'Excused',
  holiday: 'Holiday',
}

// Displayed in this fixed order everywhere in this component (summary
// columns, detailed-export cell values).
const STATUS_ORDER: AttendanceStatus[] = ['present', 'online', 'late', 'absent', 'excused', 'holiday']

const SUMMARY_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Student', key: 'name' },
  { header: 'Classes Held', key: 'classesHeld' },
  { header: 'Present', key: 'present' },
  { header: 'Online', key: 'online' },
  { header: 'Tardy', key: 'late' },
  { header: 'Absent', key: 'absent' },
  { header: 'Excused', key: 'excused' },
  { header: 'Holiday', key: 'holiday' },
  { header: 'Not Marked', key: 'notMarked' },
  { header: 'Attendance %', key: 'attendancePct' },
]

// Whole-class attendance view: total classes held + a per-student
// status breakdown (Present/Online/Tardy/Absent/Excused counts and an
// attendance %, replacing the single "just a percentage" column the
// score reports use, per explicit request), plus a "Download Detailed
// Report" button producing a wide CSV -- one row per student, one
// column per date, cell = that day's status. Sibling to
// ClassReportsClient (Assignments/Exams), selected via the report-type
// filter on the Reports page.
export function AttendanceReportsClient({
  classes,
  academicYear,
}: {
  classes: ClassOption[]
  academicYear: string
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [report, setReport] = useState<ClassAttendanceReport | null>(null)
  const [loading, setLoading] = useState(false)
  // '' = the default summary view; a picked Sunday switches to a
  // single-day view (Student | that date's status) using the same
  // report data's byDate lookup -- no separate fetch needed.
  const [selectedDate, setSelectedDate] = useState('')
  const sundays = useMemo(() => getSundaysInAcademicYear(academicYear), [academicYear])

  useEffect(() => {
    if (!classId) {
      setReport(null)
      return
    }
    setLoading(true)
    setReport(null)
    fetch(`/api/teacher/reports/attendance?classId=${classId}&academicYear=${encodeURIComponent(academicYear)}`)
      .then((res) => res.json())
      .then((data) => setReport(data))
      .catch(() => setReport({ classesHeld: 0, dates: [], students: [] }))
      .finally(() => setLoading(false))
  }, [classId, academicYear])

  const students = useMemo(() => report?.students ?? [], [report])

  const summaryExportRows = useMemo(
    () =>
      students.map((s) => ({
        name: s.studentName,
        classesHeld: s.classesHeld,
        present: s.counts.present,
        online: s.counts.online,
        late: s.counts.late,
        absent: s.counts.absent,
        excused: s.counts.excused,
        holiday: s.counts.holiday,
        notMarked: s.notMarked,
        attendancePct: s.attendancePct ?? '',
      })),
    [students]
  )

  const columns: ReportTableColumn<(typeof students)[number]>[] = [
    { header: 'Student', accessor: (r) => <span className="font-semibold text-stone-800 dark:text-stone-100">{r.studentName}</span> },
    { header: 'Classes Held', accessor: (r) => r.classesHeld, align: 'right' },
    ...STATUS_ORDER.map(
      (status): ReportTableColumn<(typeof students)[number]> => ({
        header: STATUS_LABEL[status],
        accessor: (r) => r.counts[status],
        align: 'right',
      })
    ),
    {
      header: 'Not Marked',
      accessor: (r) =>
        r.notMarked > 0 ? (
          <span className="text-terracotta-600 dark:text-terracotta-400 font-semibold">{r.notMarked}</span>
        ) : (
          0
        ),
      align: 'right',
    },
    { header: 'Attendance %', accessor: (r) => (r.attendancePct !== null ? `${r.attendancePct}%` : '—'), align: 'right' },
  ]

  const singleDateColumns: ReportTableColumn<(typeof students)[number]>[] = [
    { header: 'Student', accessor: (r) => <span className="font-semibold text-stone-800 dark:text-stone-100">{r.studentName}</span> },
    {
      header: selectedDate ? formatDateOnly(selectedDate) : '',
      accessor: (r) => {
        const status = r.byDate[selectedDate]
        return status ? STATUS_LABEL[status] : <span className="text-stone-400 dark:text-stone-500">Not Marked</span>
      },
    },
  ]

  // Wide format: Student name, then one column per date this class had
  // attendance recorded, cell = that student's status that day, or
  // "Not Marked" if the teacher's submission for that date skipped this
  // student entirely (distinct from an explicit 'absent' row).
  function downloadDetailedReport() {
    if (!report || report.dates.length === 0) return
    const detailColumns: ExportColumn[] = [
      { header: 'Student', key: 'name' },
      ...report.dates.map((date) => ({ header: formatDateOnly(date), key: date })),
    ]
    const detailRows = report.students.map((s) => ({
      name: s.studentName,
      ...Object.fromEntries(report.dates.map((date) => [date, s.byDate[date] ? STATUS_LABEL[s.byDate[date]] : 'Not Marked'])),
    }))
    downloadCsv('attendance-detailed', detailColumns, detailRows)
  }

  if (classes.length === 0) {
    return <EmptyState title="No classes yet" />
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
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          >
            <option value="">All dates (summary)</option>
            {sundays.map((d) => (
              <option key={d} value={d}>
                {formatDateOnly(d)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButtons filename="attendance-summary" title="Attendance Summary" columns={SUMMARY_EXPORT_COLUMNS} rows={summaryExportRows} />
          <button
            onClick={downloadDetailedReport}
            disabled={!report || report.dates.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FiDownload className="w-3.5 h-3.5" /> Detailed Report (CSV)
          </button>
        </div>
      </div>

      {loading || report === null ? (
        <p className="text-sm text-stone-400 dark:text-stone-500">Loading report...</p>
      ) : selectedDate ? (
        <>
          <p className="text-sm text-stone-500 dark:text-stone-400">Attendance for {formatDateOnly(selectedDate)}.</p>
          <ReportTable
            columns={singleDateColumns}
            rows={students}
            keyFor={(r) => r.studentId}
            emptyTitle="No students enrolled in this class"
          />
        </>
      ) : (
        <>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {report.classesHeld} class{report.classesHeld === 1 ? '' : 'es'} held so far this year.
          </p>
          <ReportTable columns={columns} rows={students} keyFor={(r) => r.studentId} emptyTitle="No attendance recorded for this class yet" />
        </>
      )}
    </div>
  )
}
