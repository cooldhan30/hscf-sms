import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireString } from '@/lib/validation'
import { shuffle } from '@/lib/gameRoom/shuffle'

// POST /api/game-room/join -- anonymous, no Clerk account. Body:
// { joinCode, nickname }. Resolves the code via the SECURITY DEFINER RPC
// (works without any RLS grant), generates THIS player's personal
// shuffled question order (randomization #2 -- a fresh shuffle of the
// session's already-fixed question_ids), and returns a bearer
// playerToken -- the ONLY secret ever handed back, stored client-side in
// localStorage and required on every subsequent /api/game-room/{state,
// answer} call.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []
  const joinCode = requireString(body.joinCode, 'Game code', errors).toUpperCase()
  const nickname = requireString(body.nickname, 'Name', errors)
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: resolved, error: resolveError } = await supabase
    .rpc('sms_resolve_game_session_by_join_code', { p_code: joinCode })
    .maybeSingle<{ session_id: string; status: string; game_type: string }>()

  if (resolveError || !resolved) {
    return NextResponse.json({ error: 'Game code not found' }, { status: 404 })
  }
  if (resolved.status !== 'waiting') {
    return NextResponse.json(
      { error: 'This game has already started or ended -- ask your teacher for a new code' },
      { status: 409 }
    )
  }

  const { data: session } = await supabase
    .from('sms_game_sessions')
    .select('question_ids')
    .eq('id', resolved.session_id)
    .single()

  if (!session) {
    return NextResponse.json({ error: 'Game session not found' }, { status: 404 })
  }

  const questionOrder = shuffle(session.question_ids)

  const { data: player, error: insertError } = await supabase
    .from('sms_game_players')
    .insert([
      {
        session_id: resolved.session_id,
        nickname,
        question_order: questionOrder,
      },
    ])
    .select()
    .single()

  if (insertError || !player) {
    return NextResponse.json({ error: insertError?.message || 'Failed to join game' }, { status: 400 })
  }

  return NextResponse.json(
    { playerToken: player.player_token, playerId: player.id, sessionId: resolved.session_id },
    { status: 201 }
  )
}
