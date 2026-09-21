'use client'

import { useMemo } from 'react'
import { FiCheckSquare, FiAward, FiBookOpen } from 'react-icons/fi'
import { StatCard } from '@/components/reports/StatCard'
import { ReportTable, type ReportTableColumn } from '@/components/reports/ReportTable'
import { ExportButtons } from '@/components/reports/ExportButtons'
import { formatDateOnly } from '@/lib/dates'
import type { StudentReport, AttendanceRecord, ScoreRecord } from '@/lib/reports/studentReport'

const ATTENDANCE_EXPORT_COLUMNS = [
  { header: 'Date', key: 'date' },
  { header: 'Class', key: 'className' },
  { header: 'Status', key: 'status' },
  { header: 'Notes', key: 'notes' },
]

const SCORE_EXPORT_COLUMNS = [
  { header: 'Date', key: 'dueDate' },
  { header: 'Type', key: 'type' },
  { header: 'Title', key: 'title' },
  { header: 'Class', key: 'className' },
  { header: 'Score', key: 'score' },
  { header: 'Max Score', key: 'maxScore' },
  { header: 'Feedback', key: 'feedback' },
]

// Confirmed as a real bug: the previous version was a fallthrough
// ternary ('present' -> primary, 'absent' -> terracotta, else -> gold)
// that silently mis-colored 'excused' the same gold as 'late', and
// would have done the same to any new status added later (e.g.
// 'holiday') instead of falling back to a neutral color. Explicit
// per-status map instead, with a neutral default for anything
// unrecognized.
const STATUS_BADGE_TONE: Record<string, string> = {
  present: 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300',
  absent: 'bg-terracotta-100 text-terracotta-700 dark:bg-terracotta-900/40 dark:text-terracotta-300',
  late: 'bg-gold-100 text-gold-700 dark:bg-gold-900/40 dark:text-gold-300',
  excused: 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
  holiday: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  online: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
}

// 'late' is displayed as "Tardy" everywhere else in the app (Attendance
// pages/calendar) -- this table previously showed the raw DB value
// capitalized via CSS ("Late"), which drifted from that renamed label
// the moment it changed. Explicit label map instead, so a future rename
// only needs one place per component, not a `capitalize` CSS trick that
// silently goes stale.
const STATUS_BADGE_LABEL: Record<string, string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Tardy',
  excused: 'Excused',
  holiday: 'Holiday',
  online: 'Online',
}

function statusBadge(status: string) {
  const tone = STATUS_BADGE_TONE[status] ?? 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
  const label = STATUS_BADGE_LABEL[status] ?? status
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tone}`}>{label}</span>
}

// Summary-then-detail view for one student's full-year report -- used by
// the teacher, admin, and student Reports pages alike so the shape stays
// identical regardless of who's looking at it.
//
// `mode` narrows which sections render, for the teacher Reports page's
// report-type filter -- Attendance now has its own dedicated whole-class
// view (AttendanceReportsClient), so a student's drill-down from the
// Assignments or Exams tab shouldn't repeat attendance data there.
// Defaults to 'all' (every section) for every other caller (student's
// own full-year report, admin reports) where there's no separate
// per-type filter to defer to.
export function StudentReportView({
  report,
  academicYear,
  mode = 'all',
}: {
  report: StudentReport
  academicYear: string
  mode?: 'all' | 'assignments' | 'exams'
}) {
  const attendanceExportRows = useMemo(
    () =>
      report.attendanceRecords.map((r: AttendanceRecord) => ({
        date: formatDateOnly(r.date),
        className: r.className,
        status: r.status,
        notes: r.notes ?? '',
      })),
    [report.attendanceRecords]
  )

  // mode narrows scoreRecords to just one type when the teacher Reports
  // page's Assignments/Exams filter drove this drill-down -- 'all'
  // (every other caller) keeps both types together as before.
  const scopedScoreRecords = useMemo(() => {
    if (mode === 'assignments') return report.scoreRecords.filter((r) => r.type === 'assignment')
    if (mode === 'exams') return report.scoreRecords.filter((r) => r.type === 'exam')
    return report.scoreRecords
  }, [report.scoreRecords, mode])

  const scoreExportRows = useMemo(
    () =>
      scopedScoreRecords.map((r: ScoreRecord) => ({
        dueDate: r.dueDate ? formatDateOnly(r.dueDate) : '',
        type: r.type === 'exam' ? 'Exam' : 'Assignment',
        title: r.title,
        className: r.className,
        score: r.score ?? '',
        maxScore: r.maxScore,
        feedback: r.feedback ?? '',
      })),
    [scopedScoreRecords]
  )

  const attendanceColumns: ReportTableColumn<AttendanceRecord>[] = [
    { header: 'Date', accessor: (r) => formatDateOnly(r.date) },
    { header: 'Class', accessor: (r) => r.className },
    { header: 'Status', accessor: (r) => statusBadge(r.status) },
    { header: 'Notes', accessor: (r) => r.notes ?? '—' },
  ]

  const scoreColumns: ReportTableColumn<ScoreRecord>[] = [
    { header: 'Date', accessor: (r) => (r.dueDate ? formatDateOnly(r.dueDate) : '—') },
    {
      header: 'Type',
      accessor: (r) => (
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
            r.type === 'exam'
              ? 'bg-gold-100 text-gold-800 dark:bg-gold-950 dark:text-gold-300'
              : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300'
          }`}
        >
          {r.type === 'exam' ? 'Exam' : 'Assignment'}
        </span>
      ),
    },
    { header: 'Title', accessor: (r) => r.title },
    { header: 'Class', accessor: (r) => r.className },
    { header: 'Score', accessor: (r) => (r.score !== null ? `${r.score} / ${r.maxScore}` : 'Not graded'), align: 'right' },
    { header: 'Feedback', accessor: (r) => r.feedback ?? '—' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-primary-900 dark:text-white">{report.studentName}</h2>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          {report.gradeLevel} · {academicYear}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {mode === 'all' && (
          <StatCard
            label="Attendance"
            value={report.attendance.attendancePct !== null ? `${report.attendance.attendancePct}%` : '—'}
            icon={FiCheckSquare}
            tone="primary"
          />
        )}
        {mode !== 'exams' && (
          <StatCard
            label="Assignment Avg."
            value={report.assignmentScores.averagePct !== null ? `${report.assignmentScores.averagePct}%` : '—'}
            icon={FiBookOpen}
            tone="terracotta"
          />
        )}
        {mode !== 'assignments' && (
          <StatCard
            label="Exam Avg."
            value={report.examScores.averagePct !== null ? `${report.examScores.averagePct}%` : '—'}
            icon={FiAward}
            tone="gold"
          />
        )}
      </div>

      {mode === 'all' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
            <p className="font-semibold text-stone-700 dark:text-stone-300 mb-2">Attendance Breakdown</p>
            <div className="space-y-1 text-stone-600 dark:text-stone-300">
              <p>Present: {report.attendance.present}</p>
              <p>Online: {report.attendance.online}</p>
              <p>Tardy: {report.attendance.late}</p>
              <p>Absent: {report.attendance.absent}</p>
              <p>Excused: {report.attendance.excused}</p>
              <p className="text-stone-400 dark:text-stone-500">Total days recorded: {report.attendance.total}</p>
            </div>
          </div>
          <div className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
            <p className="font-semibold text-stone-700 dark:text-stone-300 mb-2">Score Totals</p>
            <div className="space-y-1 text-stone-600 dark:text-stone-300">
              <p>
                Assignments: {report.assignmentScores.totalScore} / {report.assignmentScores.totalMaxScore} (
                {report.assignmentScores.count} graded)
              </p>
              <p>
                Exams: {report.examScores.totalScore} / {report.examScores.totalMaxScore} ({report.examScores.count}{' '}
                graded)
              </p>
            </div>
          </div>
        </div>
      )}

      {mode === 'all' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">Attendance Detail</p>
            <ExportButtons
              filename={`${report.studentName}-attendance`}
              title={`${report.studentName} — Attendance`}
              columns={ATTENDANCE_EXPORT_COLUMNS}
              rows={attendanceExportRows}
            />
          </div>
          <ReportTable
            columns={attendanceColumns}
            rows={report.attendanceRecords}
            keyFor={(r) => `${r.date}-${r.className}`}
            emptyTitle="No attendance recorded for this year"
          />
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">
            {mode === 'assignments' ? 'Assignments Detail' : mode === 'exams' ? 'Exams Detail' : 'Assignments & Exams Detail'}
          </p>
          <ExportButtons
            filename={`${report.studentName}-scores`}
            title={`${report.studentName} — Scores`}
            columns={SCORE_EXPORT_COLUMNS}
            rows={scoreExportRows}
          />
        </div>
        <ReportTable
          columns={scoreColumns}
          rows={scopedScoreRecords}
          keyFor={(r) => r.assignmentId}
          emptyTitle={mode === 'assignments' ? 'No assignments found for this year' : mode === 'exams' ? 'No exams found for this year' : 'No assignments or exams found for this year'}
        />
      </div>
    </div>
  )
}
