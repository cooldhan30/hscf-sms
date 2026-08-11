import { NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { provisionRoleRecord } from '@/lib/role-provisioning'
import type { SmsRole } from '@/types/database'

const ASSIGNABLE_ROLES: SmsRole[] = ['admin', 'teacher', 'student', 'parent']

// POST /api/admin/settings/users/[id]/approve -- assigns a real role to a
// self-registered (role='pending') account: sets sms_profiles.role/
// is_active, mirrors the role into Clerk publicMetadata (so middleware/JWT
// claims stay consistent), and creates the matching child record
// (sms_teachers/sms_students/sms_parents), since a pending signup has none.
// Unlike self-serve sign-up, an admin here CAN assign 'admin' -- this
// endpoint is already gated by requireAdmin().
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = await request.json().catch(() => null)
  const role = body?.role as SmsRole | undefined

  if (!role || !ASSIGNABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'A valid role is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: profile, error: findError } = await admin
    .from('sms_profiles')
    .select('*')
    .eq('id', params.id)
    .single()

  if (findError || !profile) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  if (profile.role !== 'pending') {
    return NextResponse.json({ error: 'This account has already been assigned a role' }, { status: 400 })
  }

  const { error: updateError } = await admin
    .from('sms_profiles')
    .update({ role, is_active: true })
    .eq('id', params.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  const { error: provisionError } = await provisionRoleRecord(admin, {
    profileId: params.id,
    role,
    firstName: profile.first_name,
    lastName: profile.last_name,
    email: profile.email,
    phone: profile.phone,
  })

  if (provisionError) {
    return NextResponse.json({ error: `Role set, but ${provisionError}` }, { status: 400 })
  }

  try {
    const client = await clerkClient()
    await client.users.updateUserMetadata(params.id, { publicMetadata: { role } })
  } catch {
    // Non-fatal: sms_profiles is the source of truth every guard/middleware
    // check actually reads; Clerk publicMetadata is kept in sync only so
    // it doesn't go stale for anything that inspects it directly (e.g. the
    // Clerk dashboard, or a future JWT-claims-based check).
  }

  return NextResponse.json({ success: true })
}
