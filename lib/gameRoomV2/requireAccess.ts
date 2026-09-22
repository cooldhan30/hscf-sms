import 'server-only'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import type { SmsProfile } from '@/types/database'

// GameRoom V2's access gate. There is no feature-flag system anywhere
// in this codebase (confirmed by repo-wide search during the V2
// discovery pass) -- rather than introduce one for a single
// soft-launch feature, this follows the same "data-gated access, not a
// flag service" precedent Tamil Theni already uses in production
// (sms_theni_enrollments): a signed-in user only gets past this guard
// if a row for them exists in sms_gamev2_testers (migration 073), or
// they're an admin. Admins always pass without needing a testers row,
// so a developer/admin never has to remember to add themselves before
// testing V2.
//
// This guard is intentionally its own file, not an extension of
// requireStudent()/requireTeacher() -- V2 must stay isolated from
// legacy GameRoom's requirePlayer.ts, and gating "can this person even
// see V2" is a distinct concern from "is this person a student", kept
// separate so either can evolve without touching the other.
export async function requireGameV2Access(): Promise<
  | { ok: true; supabase: ReturnType<typeof createClient>; profile: SmsProfile; isAdmin: boolean }
  | { ok: false; status: number; error: string }
> {
  const { userId } = await auth()

  if (!userId) {
    return { ok: false, status: 401, error: 'Not authenticated' }
  }

  const supabase = createClient()

  const { data: profile } = await supabase.from('sms_profiles').select('*').eq('id', userId).single()

  if (!profile || !profile.is_active) {
    return { ok: false, status: 403, error: 'Account not active' }
  }

  if (profile.role === 'admin') {
    return { ok: true, supabase, profile: profile as SmsProfile, isAdmin: true }
  }

  // RLS ("gamev2_testers: self read") already scopes this to the
  // caller's own row -- a maybeSingle() miss here (not a hard error)
  // means simply "not on the allowlist," the expected case for every
  // normal student/teacher during the soft-launch period.
  const { data: testerRow } = await supabase
    .from('sms_gamev2_testers')
    .select('profile_id')
    .eq('profile_id', userId)
    .maybeSingle()

  if (!testerRow) {
    return { ok: false, status: 403, error: 'GameRoom V2 is not yet available for your account' }
  }

  return { ok: true, supabase, profile: profile as SmsProfile, isAdmin: false }
}
