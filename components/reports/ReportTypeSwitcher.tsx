'use client'

import { useState } from 'react'
import { ClassReportsClient } from '@/components/reports/ClassReportsClient'
import { AttendanceReportsClient } from '@/components/reports/AttendanceReportsClient'

interface ClassOption {
  id: string
  name: string
}

type ReportType = 'attendance' | 'assignments' | 'exams'

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: 'attendance', label: 'Attendance' },
  { value: 'assignments', label: 'Assignments' },
  { value: 'exams', label: 'Exams' },
]

// Top-level report-type filter (pill buttons, same active/inactive
// pattern as the Attendance status buttons) -- Attendance gets its own
// whole-class aggregation view (AttendanceReportsClient); Assignments/
// Exams both reuse the existing per-student ClassReportsClient
// (assignment/exam score averages), which already covers both via its
// own Assignment Avg/Exam Avg columns -- so those two tabs render the
// same underlying component, just framed as separate report types per
// the requested filter.
export function ReportTypeSwitcher({
  classes,
  academicYear,
  apiEndpoint,
}: {
  classes: ClassOption[]
  academicYear: string
  apiEndpoint: string
}) {
  const [reportType, setReportType] = useState<ReportType>('attendance')

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {REPORT_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setReportType(t.value)}
            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
              reportType === t.value
                ? 'border border-primary-700 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-950 dark:text-primary-300'
                : 'border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {reportType === 'attendance' ? (
        <AttendanceReportsClient classes={classes} academicYear={academicYear} />
      ) : (
        <ClassReportsClient classes={classes} academicYear={academicYear} apiEndpoint={apiEndpoint} mode={reportType} />
      )}
    </div>
  )
}
