import 'server-only'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import type { SmsProfile } from '@/types/database'

// Every privileged Route Handler must call this FIRST, before touching the
// service-role admin client. It uses the caller's own session (RLS-scoped),
// so it can only ever confirm what the caller is actually allowed to see --
// unlike the admin client, it cannot be tricked into acting on someone
// else's behalf.
export async function requireAdmin(): Promise<
  { ok: true; profile: SmsProfile } | { ok: false; status: number; error: string }
> {
  const { userId } = await auth()

  if (!userId) {
    return { ok: false, status: 401, error: 'Not authenticated' }
  }

  const supabase = createClient()

  const { data: profile } = await supabase
    .from('sms_profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    return { ok: false, status: 403, error: 'Admin access required' }
  }

  return { ok: true, profile: profile as SmsProfile }
}
