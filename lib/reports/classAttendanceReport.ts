import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'holiday' | 'online'

export interface StudentAttendanceRow {
  studentId: string
  studentName: string
  // Per-status counts across every class-held day this student has a
  // recorded row for. A day marked 'holiday' counts toward both
  // classesHeld and attendancePct the same as 'present' (see below).
  counts: Record<AttendanceStatus, number>
  classesHeld: number
  attendancePct: number | null
  // date -> status, for this one student -- the source data for the
  // detailed wide-format export's per-student row.
  byDate: Record<string, AttendanceStatus>
}

export interface ClassAttendanceReport {
  classesHeld: number
  // Every distinct date attendance was recorded for this class, sorted
  // ascending -- the detailed export's column list.
  dates: string[]
  students: StudentAttendanceRow[]
}

const EMPTY_COUNTS = (): Record<AttendanceStatus, number> => ({
  present: 0,
  absent: 0,
  late: 0,
  excused: 0,
  holiday: 0,
  online: 0,
})

// Builds a whole-CLASS attendance report -- one row per enrolled
// student, aggregated across every date attendance was taken for that
// class within the academic year, plus the full date x student matrix
// needed for the detailed "one column per date" export. This is
// distinct from lib/reports/studentReport.ts's buildStudentReport,
// which is per-student only and has no notion of "how many classes
// were held" (a whole-class question, not a per-student one) or a
// dense date x student grid.
export async function buildClassAttendanceReport(
  client: SupabaseClient,
  classId: string,
  academicYear: string
): Promise<ClassAttendanceReport> {
  const { data: cls } = await client.from('sms_classes').select('id').eq('id', classId).eq('academic_year', academicYear).maybeSingle()
  if (!cls) {
    return { classesHeld: 0, dates: [], students: [] }
  }

  const [{ data: enrollments }, { data: attendanceRows }] = await Promise.all([
    client
      .from('sms_class_enrollments')
      .select('student:sms_students(id, first_name, last_name)')
      .eq('class_id', classId)
      .eq('status', 'active')
      .returns<{ student: { id: string; first_name: string; last_name: string } }[]>(),
    client.from('sms_attendance').select('student_id, date, status').eq('class_id', classId),
  ])

  const students = (enrollments ?? []).map((e) => e.student).filter((s): s is { id: string; first_name: string; last_name: string } => Boolean(s))
  const rows = attendanceRows ?? []

  const allDates = Array.from(new Set(rows.map((r) => r.date))).sort()
  const classesHeld = allDates.length

  const byStudentAndDate = new Map<string, Map<string, AttendanceStatus>>()
  for (const r of rows) {
    if (!byStudentAndDate.has(r.student_id)) byStudentAndDate.set(r.student_id, new Map())
    byStudentAndDate.get(r.student_id)!.set(r.date, r.status as AttendanceStatus)
  }

  const studentRows: StudentAttendanceRow[] = students
    .map((s) => {
      const byDate = Object.fromEntries(byStudentAndDate.get(s.id) ?? []) as Record<string, AttendanceStatus>
      const counts = EMPTY_COUNTS()
      for (const status of Object.values(byDate)) {
        counts[status] = (counts[status] ?? 0) + 1
      }

      // "Classes held" for the attendance-rate denominator is THIS
      // student's own recorded rows -- not the class-wide classesHeld,
      // which would silently overcount a student missing a row for some
      // date entirely (e.g. enrolled partway through the term). A day
      // marked 'holiday' still counts as a held class day and counts
      // toward the student the same as 'present' -- marking a day
      // holiday never hurts anyone's attendance rate.
      const recordedDays = Object.keys(byDate).length
      const attended = counts.present + counts.late + counts.online + counts.holiday
      const attendancePct = recordedDays > 0 ? Math.round((attended / recordedDays) * 1000) / 10 : null

      return {
        studentId: s.id,
        studentName: `${s.first_name} ${s.last_name}`.trim(),
        counts,
        classesHeld: recordedDays,
        attendancePct,
        byDate,
      }
    })
    .sort((a, b) => a.studentName.localeCompare(b.studentName))

  return { classesHeld, dates: allDates, students: studentRows }
}
