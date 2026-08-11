import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createClient } from '@/lib/supabase/server'
import { optionalString } from '@/lib/validation'

// PATCH /api/admin/profile -- self-service edit. Uses the caller's own
// RLS-scoped client (not the service-role admin client) so this can only
// ever touch the signed-in admin's own row, same shape as the other three
// roles' self-profile routes. Intentionally cannot touch role/is_active/
// email: those columns are protected at the Postgres grant level (see
// migration 004), not just by this handler only reading the allowed
// fields.
export async function PATCH(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const supabase = createClient()

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if ('firstName' in body) updates.first_name = optionalString(body.firstName)
  if ('lastName' in body) updates.last_name = optionalString(body.lastName)
  if ('phone' in body) updates.phone = optionalString(body.phone)
  if ('avatarUrl' in body) updates.avatar_url = optionalString(body.avatarUrl)

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('sms_profiles').update(updates).eq('id', guard.profile.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
