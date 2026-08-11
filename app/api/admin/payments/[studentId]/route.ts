import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { currentAcademicYear } from '@/lib/academic-year'
import { requireEnum } from '@/lib/validation'

const STATUSES = ['paid', 'unpaid'] as const

// PATCH /api/admin/payments/[studentId] -- toggle paid/unpaid.
// Body: { status }
//
// Upsert rather than update: a student with no row yet is simply one
// nobody has marked, which is the normal starting state for everyone.
export async function PATCH(request: Request, { params }: { params: { studentId: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = await request.json().catch(() => null)
  const errors: string[] = []
  const status = requireEnum(body?.status, STATUSES, 'Status', errors)

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const admin = createAdminClient()
  const academicYear = await currentAcademicYear(admin)

  const { error } = await admin.from('sms_student_payments').upsert(
    [
      {
        student_id: params.studentId,
        academic_year: academicYear,
        status,
        marked_by: guard.profile.id,
        marked_at: new Date().toISOString(),
      },
    ],
    { onConflict: 'student_id,academic_year' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true, status })
}
