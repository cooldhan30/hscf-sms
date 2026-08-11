import 'server-only'
import { clerkClient } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SmsRole } from '@/types/database'

// Clerk SDK errors carry the real reason in `.errors[]` (e.g. "That email
// address is taken. Please try another.") -- `err.message` alone is often
// just the generic HTTP status text ("Unprocessable Entity"), which isn't
// enough for an admin to act on. Confirmed via a real failed parent invite
// that only ever surfaced "Unprocessable Entity": 2026-08-08.
function clerkErrorMessage(err: unknown): string {
  const clerkErrors = (err as { errors?: { message?: string; longMessage?: string }[] })?.errors
  if (clerkErrors && clerkErrors.length > 0) {
    return clerkErrors.map((e) => e.longMessage || e.message).filter(Boolean).join('; ')
  }
  return err instanceof Error ? err.message : 'Unknown error'
}

// Creates a Clerk user directly (not an invitation) with a random temporary
// password, then synchronously inserts the matching sms_profiles row --
// Clerk invitations don't create a real user (and thus a real id) until the
// recipient accepts, which would leave nothing for the caller's immediate
// follow-up inserts (sms_teachers/sms_students/sms_parents) to reference.
// No email provider is configured (see Phase 6/8 notes), so the temp
// password is returned once for the admin to relay out-of-band, same as
// resetUserPassword() below. Used by every admin-triggered account
// creation flow -- teachers, students-with-login, and parents -- so the
// account/profile wiring only lives in one place.
export async function inviteAccount({
  email,
  role,
  firstName,
  lastName,
}: {
  email: string
  role: SmsRole
  firstName: string
  lastName: string
}): Promise<{ userId: string; tempPassword: string } | { error: string }> {
  const client = await clerkClient()
  const tempPassword = generateTempPassword()

  let userId: string
  try {
    const user = await client.users.createUser({
      emailAddress: [email],
      password: tempPassword,
      firstName,
      lastName,
      publicMetadata: { role },
    })
    userId = user.id
  } catch (err) {
    return { error: clerkErrorMessage(err) }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('sms_profiles').insert([
    {
      id: userId,
      role,
      first_name: firstName,
      last_name: lastName,
      email,
      is_active: true,
    },
  ])

  if (error) {
    return { error: `Account created, but profile setup failed: ${error.message}` }
  }

  return { userId, tempPassword }
}

// Admin-triggered password reset. No email provider is configured (see
// Phase 6/8 notes), so instead of emailing a reset link this generates a
// random temporary password, sets it directly via the Clerk backend API,
// and returns it once so the admin can relay it to the user out-of-band.
export async function resetUserPassword(userId: string): Promise<{ tempPassword: string } | { error: string }> {
  const client = await clerkClient()

  const tempPassword = generateTempPassword()

  try {
    await client.users.updateUser(userId, { password: tempPassword })
    return { tempPassword }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reset password'
    return { error: message }
  }
}

function generateTempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = new Uint32Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

// Looks up an existing profile by email + role (e.g. "does a parent with
// this email already exist?") so we link instead of creating a duplicate
// account. Uses the admin client because this is a cross-cutting lookup
// an admin performs on someone else's behalf, not a self-read.
export async function findProfileByEmailAndRole(email: string, role: SmsRole) {
  const admin = createAdminClient()

  const { data } = await admin
    .from('sms_profiles')
    .select('*')
    .eq('email', email)
    .eq('role', role)
    .maybeSingle()

  return data
}

// Finds-or-invites the parent account for an already-created student and
// links them via sms_student_parents. Split out of the registration
// approve route so it can also be called standalone as a retry -- the
// Clerk invite (a real network call to a third party) is the one step in
// approval that can fail for reasons outside our control (duplicate
// email, Clerk-side validation, transient errors), and a student's
// approval shouldn't be held hostage by it. Idempotent: if the student
// already has a linked parent, this is a no-op success.
export async function linkOrInviteParent({
  studentId,
  parentEmail,
  parentFirstName,
  parentLastName,
  parentPhone,
}: {
  studentId: string
  parentEmail: string
  parentFirstName: string
  parentLastName: string
  parentPhone: string | null
}): Promise<{ parentTempPassword: string | null } | { error: string }> {
  const admin = createAdminClient()

  const { data: existingLink } = await admin
    .from('sms_student_parents')
    .select('student_id')
    .eq('student_id', studentId)
    .limit(1)
    .maybeSingle()

  if (existingLink) {
    return { parentTempPassword: null }
  }

  let parentId: string
  let parentTempPassword: string | null = null
  const existingProfile = await findProfileByEmailAndRole(parentEmail, 'parent')

  if (existingProfile) {
    const { data: existingParent } = await admin
      .from('sms_parents')
      .select('id')
      .eq('profile_id', existingProfile.id)
      .maybeSingle()

    if (existingParent) {
      parentId = existingParent.id
    } else {
      // A sms_profiles row exists (role='parent') but its sms_parents
      // record never got created -- happens when someone signs up and
      // picks "parent" but never finishes the rest of onboarding.
      // Self-heal by creating it now instead of erroring, using the
      // registration's own name/phone (more likely current than
      // whatever the stalled signup captured, if anything).
      const { data: healedParent, error: healError } = await admin
        .from('sms_parents')
        .insert([
          {
            profile_id: existingProfile.id,
            first_name: parentFirstName,
            last_name: parentLastName,
            email: parentEmail,
            phone: parentPhone,
          },
        ])
        .select()
        .single()

      if (healError) {
        return { error: `Parent profile exists but creating its parent record failed: ${healError.message}` }
      }
      parentId = healedParent.id
    }
  } else {
    const invited = await inviteAccount({
      email: parentEmail,
      role: 'parent',
      firstName: parentFirstName,
      lastName: parentLastName,
    })

    if ('error' in invited) {
      return { error: invited.error }
    }
    parentTempPassword = invited.tempPassword

    const { data: newParent, error: parentError } = await admin
      .from('sms_parents')
      .insert([
        {
          profile_id: invited.userId,
          first_name: parentFirstName,
          last_name: parentLastName,
          email: parentEmail,
          phone: parentPhone,
        },
      ])
      .select()
      .single()

    if (parentError) {
      return { error: `Parent account created, but parent record failed: ${parentError.message}` }
    }
    parentId = newParent.id
  }

  const { error: linkError } = await admin
    .from('sms_student_parents')
    .insert([{ student_id: studentId, parent_id: parentId }])

  if (linkError) {
    return { error: `Parent linked failed: ${linkError.message}` }
  }

  return { parentTempPassword }
}
