import { NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
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
  if ('isActive' in body) profileUpdates.is_active = Boolean(body.isActive)

  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await admin
      .from('sms_profiles')
      .update(profileUpdates)
      .eq('id', teacher.profile_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/admin/teachers/[id] -- permanently remove a teacher account
// (Clerk user + sms_profiles row, which cascades to sms_teachers).
//
// Only possible for a teacher with no historical activity: sms_attendance
// .marked_by, sms_assignments.created_by, sms_grades.graded_by, and
// sms_announcements.created_by all reference sms_profiles with no ON
// DELETE action (NO ACTION), by design -- cascading those away would
// silently corrupt attendance/grading history school-wide. A teacher
// with any such history must be disabled (PATCH isActive:false) instead
// of deleted; we surface that as a clean 409, not a raw FK error.
//
// DB row is deleted BEFORE the Clerk account so a blocked delete never
// leaves an orphaned "no login, but data still exists" state.
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

  const { error: deleteError } = await admin.from('sms_profiles').delete().eq('id', teacher.profile_id)

  if (deleteError) {
    if (deleteError.code === '23503') {
      return NextResponse.json(
        { error: 'This teacher has existing attendance, assignment, grade, or announcement records and can\'t be deleted. Disable their account instead.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: deleteError.message }, { status: 400 })
  }

  try {
    const client = await clerkClient()
    await client.users.deleteUser(teacher.profile_id)
  } catch {
    // Non-fatal -- the DB row (and their access) is already gone; a
    // leftover Clerk user with no sms_profiles row just lands on
    // /pending-approval if they ever try to sign in again.
  }

  return NextResponse.json({ success: true })
}
