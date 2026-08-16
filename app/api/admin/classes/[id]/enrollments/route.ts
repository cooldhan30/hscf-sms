import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/admin/classes/[id]/enrollments -- enroll a student. Body: { studentId }
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const body = await request.json().catch(() => null)
  const studentId = body?.studentId
  if (!studentId || typeof studentId !== 'string') {
    return NextResponse.json({ error: 'studentId is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('sms_class_enrollments')
    .upsert([{ class_id: params.id, student_id: studentId, status: 'active' }], {
      onConflict: 'class_id,student_id',
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // The normal path (a teacher approving sms_class_join_requests) closes
  // the student's own request out via a DB trigger. Enrolling directly
  // here skips that entirely -- most often because the class has no
  // teacher yet to approve anything -- so if the student already had a
  // pending request for this class, it's resolved here too. Otherwise
  // it's left dangling at "pending" forever, showing as still-waiting
  // on their own Classes page even though they're already enrolled.
  await admin
    .from('sms_class_join_requests')
    .update({ status: 'approved', resolved_at: new Date().toISOString() })
    .eq('class_id', params.id)
    .eq('student_id', studentId)
    .eq('status', 'pending')

  return NextResponse.json({ success: true }, { status: 201 })
}

// DELETE /api/admin/classes/[id]/enrollments?studentId=... -- unenroll a student.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const { searchParams } = new URL(request.url)
  const studentId = searchParams.get('studentId')
  if (!studentId) {
    return NextResponse.json({ error: 'studentId query param is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('sms_class_enrollments')
    .delete()
    .eq('class_id', params.id)
    .eq('student_id', studentId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
