import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SmsRole } from '@/types/database'

// Clerk webhook -- the counterpart to the old sms_handle_new_user trigger
// on auth.users, now that Clerk (not Supabase Auth) owns the identity.
//
// Two distinct paths land here for user.created:
//
// 1. Admin-created accounts (lib/admin-actions.ts inviteAccount) already
//    insert their own sms_profiles row synchronously, before this webhook
//    can possibly fire, using publicMetadata.role (client-writable only by
//    our backend, so any role including 'admin' is trusted). Those calling
//    routes (teachers/students/registrations-approve) also create their own
//    role-specific child record. INSERT ... ON CONFLICT DO NOTHING makes
//    the profile insert itself a no-op for this path, since the row
//    already exists by the time this fires.
//
// 2. Everyone else -- self-serve sign-up, whether email/password or an
//    OAuth provider (Google/Apple) -- lands as role='pending',
//    is_active=false, no exceptions. Role/name selection happens
//    afterward on /pending-approval (app/api/me/complete-profile), a
//    self-service step that works identically no matter how they
//    authenticated. This webhook never trusts a client-supplied role for
//    this path -- there's no client input to trust in the first place.
export async function POST(request: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  const body = await request.text()

  let event: { type: string; data: Record<string, unknown> }
  try {
    const wh = new Webhook(secret)
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as { type: string; data: Record<string, unknown> }
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (event.type === 'user.created') {
    const data = event.data as {
      id: string
      first_name: string | null
      last_name: string | null
      email_addresses: { id: string; email_address: string }[]
      primary_email_address_id: string | null
      public_metadata?: { role?: SmsRole; first_name?: string; last_name?: string }
    }

    const primaryEmail =
      data.email_addresses.find((e) => e.id === data.primary_email_address_id)?.email_address ??
      data.email_addresses[0]?.email_address ??
      null
    const firstName = data.public_metadata?.first_name ?? data.first_name ?? ''
    const lastName = data.public_metadata?.last_name ?? data.last_name ?? ''
    const role: SmsRole = data.public_metadata?.role ?? 'pending'

    const { error } = await admin.from('sms_profiles').insert([
      {
        id: data.id,
        role,
        first_name: firstName,
        last_name: lastName,
        email: primaryEmail,
        is_active: role !== 'pending',
      },
    ])

    // 23505 = unique_violation -- admin-created accounts already have a
    // row by the time this fires; that's expected, not an error.
    if (error && error.code !== '23505') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  if (event.type === 'user.updated') {
    const data = event.data as {
      id: string
      email_addresses: { id: string; email_address: string }[]
      primary_email_address_id: string | null
    }

    const primaryEmail =
      data.email_addresses.find((e) => e.id === data.primary_email_address_id)?.email_address ??
      data.email_addresses[0]?.email_address ??
      null

    // Email only -- NOT first_name/last_name. sms_profiles' name fields are
    // owned by our own forms (the /pending-approval onboarding form, admin
    // create/edit), not by Clerk's user object. Every metadata write we
    // make ourselves (e.g. /api/me/complete-profile's updateUserMetadata
    // call right after someone sets their name) also fires this same
    // user.updated event, so syncing names here would immediately
    // overwrite what the user just entered with Clerk's own first_name/
    // last_name -- which is blank for anyone who signed up with plain
    // email/password, since our sign-up form never collects a name.
    await admin.from('sms_profiles').update({ email: primaryEmail }).eq('id', data.id)
  }

  if (event.type === 'user.deleted') {
    const data = event.data as { id: string }
    await admin.from('sms_profiles').update({ is_active: false }).eq('id', data.id)
  }

  return NextResponse.json({ received: true })
}
