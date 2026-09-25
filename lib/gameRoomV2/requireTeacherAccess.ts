import 'server-only'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import type { SmsProfile, SmsTeacher } from '@/types/database'
import { isGameRoomV2Released } from '@/lib/gameRoomV2/release'

// Combines the V2 access gate (admin, or an sms_gamev2_testers row --
// see requireAccess.ts) with an actual teacher-role check, for routes
// specifically about AUTHORING content (the Question Set Builder) --
// distinct from requireGameV2Access() itself, which also admits
// students (for eventually playing) and stays role-agnostic on
// purpose. An admin without a sms_teachers row is still admitted here
// (teacher=null) since admins can manage any teacher's sets per the
// RLS "gamev2_question_sets: admin all" policy -- callers that need a
// real teacher_id (e.g. for a class-scoped save) should check
// `teacher` themselves.
export async function requireGameV2Teacher(): Promise<
  | { ok: true; supabase: ReturnType<typeof createClient>; profile: SmsProfile; teacher: SmsTeacher | null; isAdmin: boolean }
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
    return { ok: true, supabase, profile: profile as SmsProfile, teacher: null, isAdmin: true }
  }

  if (profile.role !== 'teacher') {
    return { ok: false, status: 403, error: 'Teacher access required' }
  }

  // Tester allowlist only while V2 is rolled back (see release.ts); the
  // teacher-role check above and the teacher-record check below always apply.
  if (!isGameRoomV2Released()) {
    // RLS ("gamev2_testers: self read") already scopes this to the
    // caller's own row.
    const { data: testerRow } = await supabase
      .from('sms_gamev2_testers')
      .select('profile_id')
      .eq('profile_id', userId)
      .maybeSingle()

    if (!testerRow) {
      return { ok: false, status: 403, error: 'GameRoom V2 is not yet available for your account' }
    }
  }

  const { data: teacher } = await supabase.from('sms_teachers').select('*').eq('profile_id', userId).single()
  if (!teacher) {
    return { ok: false, status: 403, error: 'No teacher record found for this account' }
  }

  return { ok: true, supabase, profile: profile as SmsProfile, teacher: teacher as SmsTeacher, isAdmin: false }
}
