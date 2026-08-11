import { NextResponse } from 'next/server'
import { requireParent } from '@/lib/require-parent'
import { optionalString } from '@/lib/validation'

// PATCH /api/parent/profile -- self-service edit of phone/address.
// Keeps sms_profiles.phone and sms_parents.phone (a separate denormalized
// field admin/teacher UIs display) in sync. Email/password changes go
// through Supabase Auth directly from the client, same as teacher/student.
export async function PATCH(request: Request) {
  const guard = await requireParent()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, profile, parent } = guard

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const profileUpdates: Record<string, unknown> = {}
  if ('phone' in body) profileUpdates.phone = optionalString(body.phone)
  if ('address' in body) profileUpdates.address = optionalString(body.address)
  if ('avatarUrl' in body) profileUpdates.avatar_url = optionalString(body.avatarUrl)

  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await supabase.from('sms_profiles').update(profileUpdates).eq('id', profile.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if ('phone' in body) {
    const { error } = await supabase
      .from('sms_parents')
      .update({ phone: optionalString(body.phone) })
      .eq('id', parent.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
