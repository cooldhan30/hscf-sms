import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { optionalString, requireEnum } from '@/lib/validation'

const ENROLLMENT_STATUSES = ['active', 'inactive', 'graduated', 'withdrawn'] as const

// PATCH /api/admin/students/[id] -- edit student fields. [id] is sms_students.id.
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

  const { data: student, error: findError } = await admin
    .from('sms_students')
    .select('id, profile_id')
    .eq('id', params.id)
    .single()

  if (findError || !student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  const errors: string[] = []
  const updates: Record<string, unknown> = {}
  if ('firstName' in body) updates.first_name = optionalString(body.firstName)
  if ('lastName' in body) updates.last_name = optionalString(body.lastName)
  if ('dateOfBirth' in body) updates.date_of_birth = optionalString(body.dateOfBirth)
  if ('gradeLevel' in body) updates.grade_level = optionalString(body.gradeLevel)
  if ('academicYear' in body) updates.academic_year = optionalString(body.academicYear)
  if ('enrollmentStatus' in body) {
    updates.enrollment_status = requireEnum(
      body.enrollmentStatus,
      ENROLLMENT_STATUSES,
      'Enrollment status',
      errors
    )
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  if ('isActive' in body || 'restore' in body) {
    // isActive toggles login access on the student's profile, if they
    // have one -- a login-less student has nothing to toggle. restore
    // additionally clears sms_students.deleted_at, and always implies
    // re-enabling login when a profile exists.
    if ('restore' in body && body.restore) {
      updates.deleted_at = null
    }

    if (student.profile_id) {
      const profileUpdates: Record<string, unknown> = {}
      if ('isActive' in body) profileUpdates.is_active = Boolean(body.isActive)
      if ('restore' in body && body.restore) profileUpdates.is_active = true

      if (Object.keys(profileUpdates).length > 0) {
        const { error } = await admin.from('sms_profiles').update(profileUpdates).eq('id', student.profile_id)
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await admin.from('sms_students').update(updates).eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/admin/students/[id] -- soft-delete a student.
//
// Sets sms_students.deleted_at (kept independent of sms_profiles --
// a student created without a login has no profile row at all) and, if
// they do have a login, disables it immediately. The student moves to
// the admin's "Deleted" tab; every academic record stays untouched and
// restorable via PATCH { restore: true }.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const admin = createAdminClient()

  const { data: student, error: findError } = await admin
    .from('sms_students')
    .select('profile_id')
    .eq('id', params.id)
    .single()

  if (findError || !student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  const { error } = await admin
    .from('sms_students')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (student.profile_id) {
    await admin.from('sms_profiles').update({ is_active: false }).eq('id', student.profile_id)
  }

  return NextResponse.json({ success: true })
}
