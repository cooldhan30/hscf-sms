import { headers } from 'next/headers'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import type { SmsProfile, SmsRole } from '@/types/database'

export { roleHomePath } from '@/lib/role-home-path'

// Which portals this person may switch into. Usually one; a teacher or
// admin who is also a parent of a student here has two. Read through the
// caller's own client -- the "profile_roles: read own" policy scopes it,
// so this can never report someone else's roles.
export async function getAvailableRoles(): Promise<SmsRole[]> {
  const { userId } = await auth()
  if (!userId) return []

  const supabase = createClient()
  const { data } = await supabase.from('sms_profile_roles').select('role').eq('profile_id', userId)

  return (data ?? []).map((r) => r.role as SmsRole)
}

// Returns the currently authenticated user's profile (role + name), or null
// if not signed in. Call from Server Components / layouts that need to know
// who's logged in and what role they have.
export async function getCurrentProfile(): Promise<SmsProfile | null> {
  const { userId, sessionId } = await auth()

  if (!userId) return null

  const profile = await resolveProfile(userId)

  if (!profile) return null

  // 'pending' + inactive is the normal, expected state for anyone who
  // hasn't finished onboarding on /pending-approval yet -- NOT a disabled
  // account. Revoking their session here would make it impossible to ever
  // reach the onboarding form (a real bug this caused: any Server
  // Component that calls getCurrentProfile() while a user is still
  // pending -- e.g. the root page -- would kill their session outright).
  if (!profile.is_active && profile.role !== 'pending') {
    // A real account an admin disabled: end the session rather than
    // leaving it in limbo.
    if (sessionId) {
      const client = await clerkClient()
      await client.sessions.revokeSession(sessionId)
    }
    return null
  }

  if (!profile.is_active) return null

  return profile
}

// Middleware (lib/supabase/middleware.ts) already queries sms_profiles for
// this exact user on every authenticated request to decide routing, and
// forwards the row it found via a request header -- middleware and this
// render phase are separate request contexts in Next.js with no shared
// in-memory cache, so without this we'd run the identical query twice on
// every single navigation. Falls back to a real query only if the header
// is missing (shouldn't happen for normal page loads; only a safety net).
async function resolveProfile(userId: string): Promise<SmsProfile | null> {
  const forwarded = headers().get('x-sms-profile')
  if (forwarded) {
    try {
      return JSON.parse(Buffer.from(forwarded, 'base64').toString('utf8')) as SmsProfile
    } catch {
      // Fall through to a real query if the header was somehow malformed.
    }
  }

  const supabase = createClient()
  const { data } = await supabase.from('sms_profiles').select('*').eq('id', userId).single()
  return data as SmsProfile | null
}
