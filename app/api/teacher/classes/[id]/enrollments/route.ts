import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'

// DELETE /api/teacher/classes/[id]/enrollments?studentId=... -- remove
// ("kick out") a student from the teacher's own class. Mirrors
// /api/admin/classes/[id]/enrollments's DELETE shape, just scoped to the
// teacher's own RLS client instead of the admin service-role client --
// RLS ("enrollments: teacher manage own class", added in 022) is the
// real enforcement.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireTeacher()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase } = guard

  const { searchParams } = new URL(request.url)
  const studentId = searchParams.get('studentId')
  if (!studentId) {
    return NextResponse.json({ error: 'studentId query param is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('sms_class_enrollments')
    .delete()
    .eq('class_id', params.id)
    .eq('student_id', studentId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
