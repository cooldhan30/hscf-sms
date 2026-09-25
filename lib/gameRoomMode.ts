import 'server-only'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import { isGameRoomV2Released } from '@/lib/gameRoomV2/release'

// Neutral re-export so Classic GameRoom pages can decide whether to show
// the "Try the New GameRoom" link without importing a V2 module directly
// (legacy <-> V2 imports are disallowed; see verify-gameroom-v2-isolation.ts).
export function isNewGameRoomReleased(): boolean {
  return isGameRoomV2Released()
}

// Role-aware destinations for the /gameroom entry point. The legacy
// ("Classic") GameRoom keeps its original role routes untouched as an
// emergency rollback target only (docs/gameroom-v2-rollback.md).
export type GameRoomRole = 'student' | 'teacher' | 'admin' | null

export async function currentGameRoomRole(): Promise<{ userId: string | null; role: GameRoomRole }> {
  const { userId } = await auth()
  if (!userId) return { userId: null, role: null }
  const { data: profile } = await createClient().from('sms_profiles').select('role, is_active').eq('id', userId).maybeSingle()
  if (!profile || !profile.is_active) return { userId, role: null }
  const role = profile.role === 'student' || profile.role === 'teacher' || profile.role === 'admin' ? profile.role : null
  return { userId, role }
}

export function classicGameRoomPath(role: GameRoomRole): string | null {
  if (role === 'student') return '/student/game-room'
  if (role === 'teacher') return '/teacher/game-room'
  return null
}

export function newGameRoomPath(role: GameRoomRole): string | null {
  // One role-aware GameRoom home for students, teachers and admins.
  if (role === 'student' || role === 'teacher' || role === 'admin') return '/gameroom-v2'
  return null
}
