import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SmsRole } from '@/types/database'

// Self-serve sign-up can only ever become one of these -- never 'admin'.
// Letting anyone who signs up self-assign admin access would be a
// critical hole, not a UX choice, so this list is enforced server-side
// in the webhook regardless of what a client sends.
export const SELF_SERVE_ROLES: readonly SmsRole[] = ['teacher', 'student', 'parent']

// Creates the role-specific child record (sms_teachers/sms_students/
// sms_parents) for a profile that just got a real role -- shared by the
// Clerk webhook (self-serve sign-up, immediate activation) and the admin
// approve endpoint (manually assigning a pending account's role), so the
// per-role insert shape only lives in one place.
export async function provisionRoleRecord(
  admin: SupabaseClient,
  params: { profileId: string; role: SmsRole; firstName: string; lastName: string; email: string | null; phone: string | null }
): Promise<{ error: string } | { error: null }> {
  const { profileId, role, firstName, lastName, email, phone } = params

  if (role === 'teacher') {
    const { error } = await admin.from('sms_teachers').insert([{ profile_id: profileId }])
    return { error: error ? `Teacher record failed: ${error.message}` : null }
  }

  if (role === 'student') {
    const { error } = await admin
      .from('sms_students')
      .insert([{ profile_id: profileId, first_name: firstName, last_name: lastName }])
    return { error: error ? `Student record failed: ${error.message}` : null }
  }

  if (role === 'parent') {
    const { error } = await admin
      .from('sms_parents')
      .insert([{ profile_id: profileId, first_name: firstName, last_name: lastName, email, phone }])
    return { error: error ? `Parent record failed: ${error.message}` : null }
  }

  return { error: null }
}
