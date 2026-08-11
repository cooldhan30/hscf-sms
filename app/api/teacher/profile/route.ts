import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { optionalString } from '@/lib/validation'

// PATCH /api/teacher/profile -- self-service edit. Intentionally cannot
// touch role/is_active/email: those columns are protected at the Postgres
// grant level (see migration 004), not just by this handler only reading
// the allowed fields.
export async function PATCH(request: Request) {
  const guard = await requireTeacher()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, profile, teacher } = guard

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const profileUpdates: Record<string, unknown> = {}
  if ('firstName' in body) profileUpdates.first_name = optionalString(body.firstName)
  if ('lastName' in body) profileUpdates.last_name = optionalString(body.lastName)
  if ('phone' in body) profileUpdates.phone = optionalString(body.phone)
  if ('avatarUrl' in body) profileUpdates.avatar_url = optionalString(body.avatarUrl)

  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await supabase.from('sms_profiles').update(profileUpdates).eq('id', profile.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const teacherUpdates: Record<string, unknown> = {}
  if ('subjectSpecialty' in body) teacherUpdates.subject_specialty = optionalString(body.subjectSpecialty)
  if ('bio' in body) teacherUpdates.bio = optionalString(body.bio)

  if (Object.keys(teacherUpdates).length > 0) {
    const { error } = await supabase.from('sms_teachers').update(teacherUpdates).eq('id', teacher.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
