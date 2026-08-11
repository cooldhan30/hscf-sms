import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { provisionRoleRecord, SELF_SERVE_ROLES } from '@/lib/role-provisioning'
import { requireString, requireEnum } from '@/lib/validation'

// POST /api/me/complete-profile -- the self-service counterpart to the
// admin "approve" endpoint. Any signed-in user with role='pending' can
// call this once, for themselves, to pick a role and finish their own
// profile. Works identically regardless of how they authenticated
// (email/password or Google/Apple OAuth), since it only needs the Clerk
// session, not anything set at sign-up time.
//
// role is deliberately restricted to SELF_SERVE_ROLES -- never 'admin' --
// same guardrail as the webhook used to enforce for unsafeMetadata, now
// enforced here since this is the only path a client can influence role.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const errors: string[] = []
  const role = requireEnum(body?.role, SELF_SERVE_ROLES, 'Role', errors)
  const firstName = requireString(body?.firstName, 'First name', errors)
  const lastName = requireString(body?.lastName, 'Last name', errors)

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const admin = createAdminClient()

  let { data: profile } = await admin.from('sms_profiles').select('*').eq('id', userId).single()

  if (!profile) {
    // Normally the Clerk webhook (user.created) creates this row. That
    // delivery can lag by a few seconds, or -- in local dev -- never
    // arrive at all if the webhook tunnel isn't running. Rather than
    // making the user wait/retry on something outside their control,
    // create the row here directly from the Clerk user object, same
    // shape as the webhook. INSERT ... ON CONFLICT DO NOTHING handles
    // the race where the webhook fires between our SELECT and INSERT.
    const client = await clerkClient()
    const clerkUser = await client.users.getUser(userId)
    const primaryEmail =
      clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      null

    const { error: createError } = await admin.from('sms_profiles').insert([
      {
        id: userId,
        role: 'pending',
        first_name: clerkUser.firstName ?? '',
        last_name: clerkUser.lastName ?? '',
        email: primaryEmail,
        is_active: false,
      },
    ])

    if (createError && createError.code !== '23505') {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    const { data: refetched } = await admin.from('sms_profiles').select('*').eq('id', userId).single()
    profile = refetched
  }

  if (!profile) {
    return NextResponse.json({ error: 'Unable to set up your account. Please try again.' }, { status: 500 })
  }

  if (profile.role !== 'pending') {
    return NextResponse.json({ error: 'Your profile has already been set up.' }, { status: 400 })
  }

  const { error: updateError } = await admin
    .from('sms_profiles')
    .update({ role: role!, first_name: firstName, last_name: lastName, is_active: true })
    .eq('id', userId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  const { error: provisionError } = await provisionRoleRecord(admin, {
    profileId: userId,
    role: role!,
    firstName,
    lastName,
    email: profile.email,
    phone: profile.phone,
  })

  if (provisionError) {
    return NextResponse.json({ error: `Profile saved, but ${provisionError}` }, { status: 400 })
  }

  try {
    const client = await clerkClient()
    await client.users.updateUserMetadata(userId, { publicMetadata: { role } })
  } catch {
    // Non-fatal -- see approve/route.ts for why.
  }

  return NextResponse.json({ success: true, role })
}
