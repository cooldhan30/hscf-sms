import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { optionalString } from '@/lib/validation'

// PATCH /api/admin/teachers/[id] -- edit teacher fields and/or toggle
// is_active (disable). [id] is the sms_teachers.id.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: teacher, error: findError } = await admin
    .from('sms_teachers')
    .select('*')
    .eq('id', params.id)
    .single()

  if (findError || !teacher) {
    return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })
  }

  const teacherUpdates: Record<string, unknown> = {}
  if ('employeeId' in body) teacherUpdates.employee_id = optionalString(body.employeeId)
  if ('subjectSpecialty' in body) teacherUpdates.subject_specialty = optionalString(body.subjectSpecialty)
  if ('bio' in body) teacherUpdates.bio = optionalString(body.bio)

  if (Object.keys(teacherUpdates).length > 0) {
    const { error } = await admin.from('sms_teachers').update(teacherUpdates).eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const profileUpdates: Record<string, unknown> = {}
  if ('firstName' in body) profileUpdates.first_name = optionalString(body.firstName)
  if ('lastName' in body) profileUpdates.last_name = optionalString(body.lastName)
  if ('phone' in body) profileUpdates.phone = optionalString(body.phone)
  if ('avatarUrl' in body) profileUpdates.avatar_url = optionalString(body.avatarUrl)
  if ('isActive' in body) {
    profileUpdates.is_active = Boolean(body.isActive)
    // Re-enabling always un-deletes too -- a restored teacher shouldn't
    // still show as deleted just because that's how they were disabled.
    if (profileUpdates.is_active) profileUpdates.deleted_at = null
  }

  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await admin
      .from('sms_profiles')
      .update(profileUpdates)
      .eq('id', teacher.profile_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/admin/teachers/[id] -- soft-delete a teacher account.
//
// This never removes the sms_profiles row: sms_attendance.marked_by,
// sms_assignments.created_by, sms_grades.graded_by, and
// sms_announcements.created_by all reference it with no ON DELETE
// action, and the school wants that history kept regardless. Instead
// this sets deleted_at (and is_active = false, so login is blocked the
// same way a disabled account is) -- the profile moves to the admin's
// "Deleted" view and can be restored later via PATCH isActive:true.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const admin = createAdminClient()

  const { data: teacher, error: findError } = await admin
    .from('sms_teachers')
    .select('profile_id')
    .eq('id', params.id)
    .single()

  if (findError || !teacher) {
    return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })
  }

  const { error: deleteError } = await admin
    .from('sms_profiles')
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq('id', teacher.profile_id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
