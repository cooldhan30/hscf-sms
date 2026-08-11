import 'server-only'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import type { SmsProfile, SmsParent } from '@/types/database'

export async function requireParent(): Promise<
  | { ok: true; supabase: ReturnType<typeof createClient>; profile: SmsProfile; parent: SmsParent }
  | { ok: false; status: number; error: string }
> {
  const { userId } = await auth()

  if (!userId) {
    return { ok: false, status: 401, error: 'Not authenticated' }
  }

  const supabase = createClient()

  const { data: profile } = await supabase.from('sms_profiles').select('*').eq('id', userId).single()

  if (!profile || profile.role !== 'parent' || !profile.is_active) {
    return { ok: false, status: 403, error: 'Parent access required' }
  }

  const { data: parent } = await supabase.from('sms_parents').select('*').eq('profile_id', userId).single()

  if (!parent) {
    return { ok: false, status: 403, error: 'No parent record found for this account' }
  }

  return { ok: true, supabase, profile: profile as SmsProfile, parent: parent as SmsParent }
}
