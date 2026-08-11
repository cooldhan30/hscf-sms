import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { inviteAccount } from '@/lib/admin-actions'
import { requireString, requireEmail, optionalString } from '@/lib/validation'

// POST /api/admin/teachers -- create a teacher account.
// Creates the Clerk account + sms_profiles row (role=teacher), then creates
// the sms_teachers record and fills in the profile fields inviteAccount
// doesn't set. Returns a one-time tempPassword to relay to the teacher.
export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []
  const firstName = requireString(body.firstName, 'First name', errors)
  const lastName = requireString(body.lastName, 'Last name', errors)
  const email = requireEmail(body.email, 'Email', errors)
  const phone = optionalString(body.phone)
  const avatarUrl = optionalString(body.avatarUrl)
  const employeeId = optionalString(body.employeeId)
  const subjectSpecialty = optionalString(body.subjectSpecialty)
  const bio = optionalString(body.bio)

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const invited = await inviteAccount({ email, role: 'teacher', firstName, lastName })
  if ('error' in invited) {
    return NextResponse.json({ error: invited.error }, { status: 400 })
  }

  const admin = createAdminClient()

  if (phone || avatarUrl) {
    await admin
      .from('sms_profiles')
      .update({ phone, avatar_url: avatarUrl })
      .eq('id', invited.userId)
  }

  const { data: teacher, error: teacherError } = await admin
    .from('sms_teachers')
    .insert([
      {
        profile_id: invited.userId,
        employee_id: employeeId,
        subject_specialty: subjectSpecialty,
        bio,
      },
    ])
    .select()
    .single()

  if (teacherError) {
    return NextResponse.json({ error: teacherError.message }, { status: 400 })
  }

  return NextResponse.json({ teacher, tempPassword: invited.tempPassword }, { status: 201 })
}
