import { NextResponse } from 'next/server'
import { requireStudent } from '@/lib/require-student'
import { requireEnum } from '@/lib/validation'

// PATCH /api/student/link-requests/[id] -- approve or deny a parent link
// request targeting this student. RLS ("parent_link_requests: student
// resolve own") is the real enforcement, including that only a pending
// request can be resolved -- this route just translates the action into
// the status value and gives a clean error otherwise. Approval creates
// the actual sms_student_parents row via a DB trigger (016), not here.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireStudent()
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

  const { data: linkRequest, error } = await supabase
    .from('sms_parent_link_requests')
    .update({ status: action === 'approve' ? 'approved' : 'denied' })
    .eq('id', params.id)
    .select()
    .single()

  if (error || !linkRequest) {
    return NextResponse.json({ error: error?.message || 'Request not found or already resolved' }, { status: 400 })
  }

  return NextResponse.json({ linkRequest })
}
