import { createAdminClient } from '@/lib/supabase/admin'
import { currentAcademicYear } from '@/lib/academic-year'
import { StudentReportClient, type StudentReportRow } from './StudentReportClient'

export const dynamic = 'force-dynamic'

type StudentQueryRow = {
  id: string
  first_name: string
  last_name: string
  grade_level: string
  enrollment_status: string
  academic_year: string
  profile: { email: string | null; phone: string | null } | null
  parents: {
    parent: { first_name: string; last_name: string; email: string | null; phone: string | null } | null
  }[]
}

export default async function StudentReportPage() {
  const admin = createAdminClient()
  const academicYear = await currentAcademicYear(admin)

  const [{ data: students }, { data: payments }] = await Promise.all([
    admin
      .from('sms_students')
      .select(
        'id, first_name, last_name, grade_level, enrollment_status, academic_year, profile:sms_profiles(email, phone), parents:sms_student_parents(parent:sms_parents(first_name, last_name, email, phone))'
      )
      .is('deleted_at', null)
      .order('last_name')
      .returns<StudentQueryRow[]>(),
    admin.from('sms_student_payments').select('student_id, status').eq('academic_year', academicYear),
  ])

  const paymentByStudent = new Map((payments ?? []).map((p) => [p.student_id, p.status]))

  const rows: StudentReportRow[] = (students ?? []).map((s) => {
    const parents = s.parents.map((p) => p.parent).filter(Boolean) as {
      first_name: string
      last_name: string
      email: string | null
      phone: string | null
    }[]

    return {
      id: s.id,
      name: `${s.first_name} ${s.last_name}`.trim(),
      gradeLevel: s.grade_level,
      email: s.profile?.email ?? null,
      phone: s.profile?.phone ?? null,
      enrollmentStatus: s.enrollment_status,
      academicYear: s.academic_year,
      parentNames: parents.map((p) => `${p.first_name} ${p.last_name}`.trim()),
      parentEmails: parents.map((p) => p.email).filter(Boolean) as string[],
      parentPhones: parents.map((p) => p.phone).filter(Boolean) as string[],
      paymentStatus: paymentByStudent.get(s.id) ?? 'unpaid',
    }
  })

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Student Details</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Every student&apos;s Nilai, contact info, parent/guardian details, and payment status for {academicYear}.
        </p>
      </div>

      <StudentReportClient rows={rows} />
    </div>
  )
}
