import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireEnum } from '@/lib/validation'

// PATCH /api/admin/classes/[id]/teacher-requests/[requestId] -- approve
// or deny a teacher's request to be attached to this class. Approval
// sets sms_classes.teacher_id via a DB trigger (022), not here.
export async function PATCH(request: Request, { params }: { params: { id: string; requestId: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []
  const action = requireEnum(body.action, ['approve', 'deny'] as const, 'Action', errors)
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: classRequest, error } = await admin
    .from('sms_class_teacher_requests')
    .update({ status: action === 'approve' ? 'approved' : 'denied' })
    .eq('id', params.requestId)
    .eq('class_id', params.id)
    .select()
    .single()

  if (error || !classRequest) {
    return NextResponse.json({ error: error?.message || 'Request not found' }, { status: 400 })
  }

  return NextResponse.json({ classRequest })
}
