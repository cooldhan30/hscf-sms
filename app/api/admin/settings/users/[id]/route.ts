import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

// Activation/suspension only -- role reassignment is deliberately not
// exposed here. Each role has its own child table (sms_teachers/
// sms_students/sms_parents) created at invite time; changing role on
// sms_profiles alone would desync those records rather than migrate
// them, so that's out of scope for this generic endpoint.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = await request.json().catch(() => null)
  if (!body || !('is_active' in body)) {
    return NextResponse.json({ error: 'is_active is required' }, { status: 400 })
  }

  if (params.id === guard.profile.id && (body.is_active === false || body.is_active === 'false')) {
    return NextResponse.json({ error: 'You cannot suspend your own account' }, { status: 400 })
  }

  const admin = createAdminClient()
  const isActive = body.is_active === true || body.is_active === 'true'
  const { data, error } = await admin
    .from('sms_profiles')
    .update({ is_active: isActive })
    .eq('id', params.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ item: data })
}
