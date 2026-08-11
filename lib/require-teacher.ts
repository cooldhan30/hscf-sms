import 'server-only'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import type { SmsProfile, SmsTeacher } from '@/types/database'

// Teacher Route Handlers use the caller's own RLS-scoped session client
// (returned here), NOT the service-role admin client -- teacher mutations
// don't need privilege escalation, and the sms_* RLS policies are the
// real enforcement boundary. This check just gives clean error responses;
// even if it were somehow bypassed, RLS still blocks cross-teacher access.
export async function requireTeacher(): Promise<
  | { ok: true; supabase: ReturnType<typeof createClient>; profile: SmsProfile; teacher: SmsTeacher }
  | { ok: false; status: number; error: string }
> {
  const { userId } = await auth()

  if (!userId) {
    return { ok: false, status: 401, error: 'Not authenticated' }
  }

  const supabase = createClient()

  const { data: profile } = await supabase.from('sms_profiles').select('*').eq('id', userId).single()

  if (!profile || profile.role !== 'teacher' || !profile.is_active) {
    return { ok: false, status: 403, error: 'Teacher access required' }
  }

  const { data: teacher } = await supabase
    .from('sms_teachers')
    .select('*')
    .eq('profile_id', userId)
    .single()

  if (!teacher) {
    return { ok: false, status: 403, error: 'No teacher record found for this account' }
  }

  return { ok: true, supabase, profile: profile as SmsProfile, teacher: teacher as SmsTeacher }
}
