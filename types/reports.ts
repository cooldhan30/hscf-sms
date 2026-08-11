// Response shapes returned by the /api/*/reports/* Route Handlers. Kept
// separate from types/database.ts since these are aggregate/report rows,
// not 1:1 table mirrors.

export interface EnrollmentReportData {
  academicYears: string[]
  totalStudents: number
  totalActive: number
  byStatus: { active: number; inactive: number; graduated: number; withdrawn: number }
  byGrade: { gradeLevel: string; label: string; count: number }[]
}

export interface AttendanceTrendsReportData {
  byDate: { date: string; present: number; absent: number; late: number; excused: number; ratePct: number | null }[]
  summary: {
    present: number
    absent: number
    late: number
    excused: number
    totalRecords: number
    overallRatePct: number | null
  }
}

export interface ClassSizesReportData {
  classes: { id: string; name: string; gradeLevel: string; teacherName: string; enrolledCount: number }[]
}

export interface TeacherWorkloadReportData {
  teachers: { id: string; name: string; classCount: number; studentCount: number; assignmentCount: number }[]
}

export interface StudentPerformanceReportData {
  distribution: { bucket: string; label: string; count: number }[]
  byStudent: { studentId: string; name: string; gradeLevel: string; avgPct: number; gradedCount: number }[]
  overallAvgPct: number | null
}

export interface TeacherAttendanceReportData {
  classes: { id: string; name: string }[]
  byClass: { classId: string; className: string; present: number; absent: number; late: number; excused: number; ratePct: number | null }[]
  byDate: { date: string; present: number; absent: number; late: number; excused: number }[]
}

export interface GradeDistributionReportData {
  distribution: { bucket: string; label: string; count: number }[]
  byClass: { classId: string; className: string; avgPct: number | null; gradedCount: number }[]
}

export interface AssignmentCompletionReportData {
  assignments: {
    id: string
    title: string
    classId: string
    className: string
    dueDate: string | null
    enrolledCount: number
    gradedCount: number
    completionPct: number | null
  }[]
}

export interface ProgressReportData {
  trend: { date: string; title: string; pct: number }[]
  byClass: { classId: string; className: string; avgPct: number; gradedCount: number }[]
  overallAvgPct: number | null
}

export interface AttendanceSummaryReportData {
  byDate: { date: string; status: 'present' | 'absent' | 'late' | 'excused' }[]
  summary: {
    present: number
    absent: number
    late: number
    excused: number
    totalRecords: number
    ratePct: number | null
  }
  byClass: { classId: string; className: string; ratePct: number | null }[]
}
