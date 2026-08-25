import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export interface GamePlayerRow {
  id: string
  session_id: string
  player_token: string
  nickname: string
  question_order: string[]
  current_index: number
  current_question_started_at: string
  score: number
  correct_count: number
  answered_count: number
  completed: boolean
  connected: boolean
  joined_at: string
  completed_at: string | null
}

export interface GameSessionRow {
  id: string
  join_code: string
  host_teacher_id: string
  game_type: string
  status: 'waiting' | 'active' | 'paused' | 'ended'
  quiz_mode: string
  category_filter: string | null
  question_count: number
  question_time_limit_seconds: number
  question_ids: string[]
  paused_at: string | null
  pause_duration_seconds: number
  created_at: string
  started_at: string | null
  ended_at: string | null
}

// Anonymous student routes have no Clerk session and no RLS-scoped
// client to lean on -- the admin (service-role) client plus this
// app-code check IS the authorization boundary for every /api/game-room/
// {join,state,answer} route, mirroring requireTeacher()'s return shape
// for consistency even though the underlying trust model is different.
export async function requireGamePlayer(
  playerToken: unknown
): Promise<
  | { ok: true; supabase: ReturnType<typeof createAdminClient>; player: GamePlayerRow; session: GameSessionRow }
  | { ok: false; status: number; error: string }
> {
  if (typeof playerToken !== 'string' || !playerToken) {
    return { ok: false, status: 400, error: 'playerToken is required' }
  }

  const supabase = createAdminClient()

  const { data: player } = await supabase
    .from('sms_game_players')
    .select('*')
    .eq('player_token', playerToken)
    .single()

  if (!player) {
    return { ok: false, status: 404, error: 'Player not found -- the game session may have ended' }
  }

  const { data: session } = await supabase
    .from('sms_game_sessions')
    .select('*')
    .eq('id', player.session_id)
    .single()

  if (!session) {
    return { ok: false, status: 404, error: 'Game session not found' }
  }

  return { ok: true, supabase, player: player as GamePlayerRow, session: session as GameSessionRow }
}
