import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { currentAcademicYear } from '@/lib/academic-year'

type StudentRow = {
  id: string
  first_name: string
  last_name: string
  parents: {
    parent: { first_name: string; last_name: string; email: string | null; phone: string | null } | null
  }[]
}

// GET /api/admin/payments -- one row per student: who they are, their
// linked parents' contact details, and whether this year's registration
// fee is recorded as paid.
export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const admin = createAdminClient()
  const academicYear = await currentAcademicYear(admin)

  const [{ data: students }, { data: payments }] = await Promise.all([
    admin
      .from('sms_students')
      .select(
        'id, first_name, last_name, parents:sms_student_parents(parent:sms_parents(first_name, last_name, email, phone))'
      )
      .eq('enrollment_status', 'active')
      .order('last_name')
      .returns<StudentRow[]>(),
    admin.from('sms_student_payments').select('*').eq('academic_year', academicYear),
  ])

  const byStudent = new Map((payments ?? []).map((p) => [p.student_id, p]))

  const items = (students ?? []).map((s) => {
    const parents = s.parents.map((p) => p.parent).filter(Boolean)
    const payment = byStudent.get(s.id)

    return {
      studentId: s.id,
      studentName: `${s.first_name} ${s.last_name}`.trim(),
      // A student can have more than one linked parent (and siblings
      // share them), so these are lists rather than single values.
      parentNames: parents.map((p) => `${p!.first_name} ${p!.last_name}`.trim()),
      parentEmails: parents.map((p) => p!.email).filter(Boolean) as string[],
      parentPhones: parents.map((p) => p!.phone).filter(Boolean) as string[],
      // No row yet simply means nobody has marked them either way.
      status: payment?.status ?? 'unpaid',
      lastRemindedAt: payment?.last_reminded_at ?? null,
      reminderCount: payment?.reminder_count ?? 0,
    }
  })

  return NextResponse.json({ items, academicYear })
}
