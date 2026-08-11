import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

// The year an admin is currently working in. sms_academic_years has a
// partial unique index guaranteeing at most one row is_current, so this
// is unambiguous; the fallback only matters on a database where nobody
// has marked one yet.
export async function currentAcademicYear(client: SupabaseClient): Promise<string> {
  const { data } = await client
    .from('sms_academic_years')
    .select('label')
    .eq('is_current', true)
    .maybeSingle()

  return data?.label ?? '2026-2027'
}
