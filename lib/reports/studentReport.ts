import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface AttendanceSummary {
  total: number
  present: number
  absent: number
  late: number
  excused: number
  holiday: number
  online: number
  attendancePct: number | null
}

export interface AttendanceRecord {
  date: string
  status: string
  notes: string | null
  className: string
}

export interface ScoreSummary {
  count: number
  totalScore: number
  totalMaxScore: number
  averagePct: number | null
}

export interface ScoreRecord {
  assignmentId: string
  title: string
  type: 'assignment' | 'exam'
  className: string
  dueDate: string | null
  score: number | null
  maxScore: number
  feedback: string | null
  gradedAt: string | null
}

export interface StudentReport {
  studentId: string
  studentName: string
  gradeLevel: string
  attendance: AttendanceSummary
  attendanceRecords: AttendanceRecord[]
  assignmentScores: ScoreSummary
  examScores: ScoreSummary
  scoreRecords: ScoreRecord[]
}

function summarizeAttendance(rows: { status: string }[]): AttendanceSummary {
  const holiday = rows.filter((r) => r.status === 'holiday').length
  // A day marked 'holiday' still counts as a held class day, and counts
  // toward the student the same as 'present' -- marking a day holiday
  // never hurts (or helps beyond full credit) anyone's attendance rate.
  const total = rows.length
  const present = rows.filter((r) => r.status === 'present').length
  const absent = rows.filter((r) => r.status === 'absent').length
  const late = rows.filter((r) => r.status === 'late').length
  const excused = rows.filter((r) => r.status === 'excused').length
  const online = rows.filter((r) => r.status === 'online').length
  return {
    total,
    present,
    absent,
    late,
    excused,
    holiday,
    online,
    // Attending remotely counts as full attendance credit, same as
    // being physically present -- and so does a day marked 'holiday'
    // (see above).
    attendancePct: total > 0 ? Math.round(((present + late + online + holiday) / total) * 1000) / 10 : null,
  }
}

function summarizeScores(rows: { score: number | null; maxScore: number }[]): ScoreSummary {
  const graded = rows.filter((r) => r.score !== null)
  const totalScore = graded.reduce((sum, r) => sum + (r.score ?? 0), 0)
  const totalMaxScore = graded.reduce((sum, r) => sum + r.maxScore, 0)
  return {
    count: graded.length,
    totalScore,
    totalMaxScore,
    averagePct: totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 1000) / 10 : null,
  }
}

// Builds one student's full-year attendance + score report. Scoped by
// classIds -- callers pass either every class a teacher teaches, a
// single class, or the classes a specific student is enrolled in.
// academicYear filters via each class's own academic_year column, since
// neither sms_attendance nor sms_assignments/sms_grades carry that
// column directly (see lib/academic-year.ts).
export async function buildStudentReport(
  client: SupabaseClient,
  studentId: string,
  classIds: string[],
  academicYear: string
): Promise<StudentReport | null> {
  const { data: student } = await client
    .from('sms_students')
    .select('id, first_name, last_name, grade_level')
    .eq('id', studentId)
    .single()

  if (!student) return null

  if (classIds.length === 0) {
    return {
      studentId: student.id,
      studentName: `${student.first_name} ${student.last_name}`.trim(),
      gradeLevel: student.grade_level,
      attendance: summarizeAttendance([]),
      attendanceRecords: [],
      assignmentScores: summarizeScores([]),
      examScores: summarizeScores([]),
      scoreRecords: [],
    }
  }

  const [{ data: attendanceRows }, { data: assignmentRows }] = await Promise.all([
    client
      .from('sms_attendance')
      .select('date, status, notes, class:sms_classes!inner(id, name, academic_year)')
      .eq('student_id', studentId)
      .in('class_id', classIds)
      .eq('class.academic_year', academicYear)
      .order('date', { ascending: false }),
    client
      .from('sms_assignments')
      .select('id, title, assignment_type, due_date, max_score, class:sms_classes!inner(id, name, academic_year)')
      .in('class_id', classIds)
      .eq('class.academic_year', academicYear)
      .eq('published', true),
  ])

  const attendanceRecords: AttendanceRecord[] = (attendanceRows ?? []).map((r) => ({
    date: r.date,
    status: r.status,
    notes: r.notes,
    className: (r.class as unknown as { name: string })?.name ?? 'Unknown',
  }))

  const assignments = assignmentRows ?? []
  const assignmentIds = assignments.map((a) => a.id)

  const { data: grades } = assignmentIds.length
    ? await client.from('sms_grades').select('assignment_id, score, feedback, graded_at').eq('student_id', studentId).in('assignment_id', assignmentIds)
    : { data: [] }

  const gradeByAssignment = new Map((grades ?? []).map((g) => [g.assignment_id, g]))

  const scoreRecords: ScoreRecord[] = assignments.map((a) => {
    const grade = gradeByAssignment.get(a.id)
    return {
      assignmentId: a.id,
      title: a.title,
      type: (a.assignment_type as 'assignment' | 'exam') ?? 'assignment',
      className: (a.class as unknown as { name: string })?.name ?? 'Unknown',
      dueDate: a.due_date,
      score: grade?.score ?? null,
      maxScore: a.max_score,
      feedback: grade?.feedback ?? null,
      gradedAt: grade?.graded_at ?? null,
    }
  })

  const assignmentScoreRows = scoreRecords.filter((r) => r.type === 'assignment')
  const examScoreRows = scoreRecords.filter((r) => r.type === 'exam')

  return {
    studentId: student.id,
    studentName: `${student.first_name} ${student.last_name}`.trim(),
    gradeLevel: student.grade_level,
    attendance: summarizeAttendance(attendanceRecords),
    attendanceRecords,
    assignmentScores: summarizeScores(assignmentScoreRows),
    examScores: summarizeScores(examScoreRows),
    scoreRecords: scoreRecords.sort((a, b) => (b.dueDate ?? '').localeCompare(a.dueDate ?? '')),
  }
}
