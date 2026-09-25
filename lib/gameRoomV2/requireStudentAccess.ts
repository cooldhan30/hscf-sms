import 'server-only'
import { requireStudent } from '@/lib/require-student'
import { isGameRoomV2Released } from '@/lib/gameRoomV2/release'

// requireStudent() + the V2 release gate. While V2 is released (see
// release.ts) every active student passes; if it's rolled back
// (GAMEROOM_V2_ENABLED=false), only students on the sms_gamev2_testers
// allowlist do -- the same rule requireGameV2Access()/
// requireGameV2Teacher() apply, so the API and the pages always agree.
// This gate is ONLY about release visibility: every route using it still
// enforces session ownership, class enrollment and RLS on top.
export async function requireGameV2Student(): Promise<Awaited<ReturnType<typeof requireStudent>>> {
  const guard = await requireStudent()
  if (!guard.ok) return guard
  if (isGameRoomV2Released()) return guard

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
