import 'server-only'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import type { SmsProfile, SmsStudent } from '@/types/database'

export async function requireStudent(): Promise<
  | { ok: true; supabase: ReturnType<typeof createClient>; profile: SmsProfile; student: SmsStudent }
  | { ok: false; status: number; error: string }
> {
  const { userId } = await auth()

  if (!userId) {
    return { ok: false, status: 401, error: 'Not authenticated' }
  }

  const supabase = createClient()

  const { data: profile } = await supabase.from('sms_profiles').select('*').eq('id', userId).single()

  if (!profile || profile.role !== 'student' || !profile.is_active) {
    return { ok: false, status: 403, error: 'Student access required' }
  }

  const { data: student } = await supabase
    .from('sms_students')
    .select('*')
    .eq('profile_id', userId)
    .single()

  if (!student) {
    return { ok: false, status: 403, error: 'No student record found for this account' }
  }

  return { ok: true, supabase, profile: profile as SmsProfile, student: student as SmsStudent }
}
