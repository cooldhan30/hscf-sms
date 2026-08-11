import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { requireEnum } from '@/lib/validation'

// PATCH /api/teacher/classes/[id]/join-requests/[requestId] -- approve
// or deny a student's request to join this class. RLS ("class_join_
// requests: teacher resolve own class pending") is the real enforcement
// -- it's the teacher's own class, and the request is still pending.
// Approval creates the sms_class_enrollments row via a DB trigger (022).
export async function PATCH(request: Request, { params }: { params: { id: string; requestId: string } }) {
  const guard = await requireTeacher()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase } = guard

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []
  const action = requireEnum(body.action, ['approve', 'deny'] as const, 'Action', errors)
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const { data: classRequest, error } = await supabase
    .from('sms_class_join_requests')
    .update({ status: action === 'approve' ? 'approved' : 'denied' })
    .eq('id', params.requestId)
    .eq('class_id', params.id)
    .select()
    .single()

  if (error || !classRequest) {
    return NextResponse.json({ error: error?.message || 'Request not found or already resolved' }, { status: 400 })
  }

  return NextResponse.json({ classRequest })
}
