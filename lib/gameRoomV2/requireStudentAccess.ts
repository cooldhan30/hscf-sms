import 'server-only'
import { requireStudent } from '@/lib/require-student'

// requireStudent() + the same sms_gamev2_testers allowlist check
// requireGameV2Access()/requireGameV2Teacher() already apply. Before
// this existed, every student-facing V2 API route (sessions/start, the
// per-session gameplay routes, live/join, progression,
// student-challenge) called plain requireStudent(), so any active
// student could play V2 by calling the API directly even though every
// V2 page hid it from them -- the soft-launch gate only existed in the
// UI. Now the API enforces the same allowlist the pages do.
export async function requireGameV2Student(): Promise<Awaited<ReturnType<typeof requireStudent>>> {
  const guard = await requireStudent()
  if (!guard.ok) return guard

  // RLS ("gamev2_testers: self read") scopes this to the caller's own row.
  const { data: testerRow } = await guard.supabase
    .from('sms_gamev2_testers')
    .select('profile_id')
    .eq('profile_id', guard.profile.id)
    .maybeSingle()

  if (!testerRow) {
    return { ok: false, status: 403, error: 'GameRoom V2 is not yet available for your account' }
  }

  return guard
}
