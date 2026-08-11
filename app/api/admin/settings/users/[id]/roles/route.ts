import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { provisionRoleRecord } from '@/lib/role-provisioning'
import { requireEnum } from '@/lib/validation'
import type { SmsRole } from '@/types/database'

// Roles an admin may grant as an ADDITIONAL role on an existing account.
// 'student' is absent on purpose: a student must never gain a second
// role, and a non-student must never become a student -- 031's trigger
// enforces this in the database too, but rejecting it here gives a
// readable error instead of a raw constraint violation.
const GRANTABLE_ROLES: readonly SmsRole[] = ['admin', 'teacher', 'parent']

// POST /api/admin/settings/users/[id]/roles -- grant an additional role.
// Body: { role }
//
// Granting the role alone isn't enough: the portal for that role reads
// from its own table (sms_teachers/sms_parents), so the matching record
// is created here too. Without it the user could switch into a portal
// that has no record behind it.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = await request.json().catch(() => null)
  const errors: string[] = []
  const role = requireEnum(body?.role, GRANTABLE_ROLES, 'Role', errors)

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: profile } = await admin.from('sms_profiles').select('*').eq('id', params.id).single()
  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { error: grantError } = await admin
    .from('sms_profile_roles')
    .insert([{ profile_id: params.id, role, granted_by: guard.profile.id }])

  // 23505 = already granted, which is a no-op rather than a failure.
  if (grantError && grantError.code !== '23505') {
    return NextResponse.json({ error: grantError.message }, { status: 400 })
  }

  const { error: provisionError } = await provisionRoleRecord(admin, {
    profileId: params.id,
    role: role!,
    firstName: profile.first_name,
    lastName: profile.last_name,
    email: profile.email,
    phone: profile.phone,
  })

  // A record that already exists is fine -- this account may have held
  // the role before, or been provisioned by another path.
  if (provisionError && !provisionError.includes('duplicate key')) {
    return NextResponse.json({ error: provisionError }, { status: 400 })
  }

  return NextResponse.json({ success: true, role }, { status: 201 })
}

// DELETE /api/admin/settings/users/[id]/roles?role=parent -- revoke.
//
// The role-specific record (sms_teachers/sms_parents) is deliberately
// left in place: deleting it would cascade away real history such as
// class assignments or parent-child links. Revoking only removes the
// ability to act as that role.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { searchParams } = new URL(request.url)
  const role = searchParams.get('role')

  if (!role) {
    return NextResponse.json({ error: 'Role is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: profile } = await admin.from('sms_profiles').select('role').eq('id', params.id).single()
  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // They're sitting in this role right now -- removing it would leave the
  // account acting as something it no longer holds, which the composite
  // FK would reject anyway. Ask for a switch first rather than failing
  // on a constraint.
  if (profile.role === role) {
    return NextResponse.json(
      { error: `This user is currently acting as ${role}. They must switch profiles before it can be removed.` },
      { status: 409 }
    )
  }

  const { count } = await admin
    .from('sms_profile_roles')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', params.id)

  if ((count ?? 0) <= 1) {
    return NextResponse.json({ error: 'An account must keep at least one role' }, { status: 400 })
  }

  const { error } = await admin
    .from('sms_profile_roles')
    .delete()
    .eq('profile_id', params.id)
    .eq('role', role)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
