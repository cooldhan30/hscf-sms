import { NextResponse } from 'next/server'
import { requireStudent } from '@/lib/require-student'
import { optionalString } from '@/lib/validation'

// PATCH /api/student/profile -- self-service edit of phone/address only.
// Email and password changes go through Supabase Auth directly from the
// client (auth.updateUser), not this route -- they're identity/security
// operations the Auth SDK already handles correctly (email requires a
// confirmation flow; password changes need no server round-trip at all).
// first_name/last_name/grade_level etc. are intentionally not accepted
// here, and role/is_active/email are blocked at the Postgres grant level
// regardless (see migration 008) even if someone bypassed this handler.
export async function PATCH(request: Request) {
  const guard = await requireStudent()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, profile } = guard

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if ('phone' in body) updates.phone = optionalString(body.phone)
  if ('address' in body) updates.address = optionalString(body.address)
  if ('avatarUrl' in body) updates.avatar_url = optionalString(body.avatarUrl)

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { error } = await supabase.from('sms_profiles').update(updates).eq('id', profile.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
