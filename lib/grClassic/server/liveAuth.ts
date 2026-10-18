import 'server-only'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@clerk/nextjs/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLAYER_HEADER, WRONG_ACCOUNT } from '../live'
import { isGrClassicEnabled } from '../release'

// The once-a-second calls a student's phone makes during a live game
// (state and answers). Joining already ran the full student check
// (requireStudent + class enrollment); after that, the signed-in Clerk
// user must own a player row in the game -- checked on every call in
// lib/grClassic/server/live.ts -- which keeps each poll cheap.
//
// A browser holds one sign-in for all its tabs. If another student signs
// in on the same browser mid-game, the game tab would silently carry on
// as them (their name, their score, answers saved as them). So the tab
// sends the account it joined with (PLAYER_HEADER), and a mismatch is
// refused with WRONG_ACCOUNT instead of being served or scored.
export async function grcLivePlayer(): Promise<{ ok: true; admin: SupabaseClient; profileId: string } | { ok: false; response: NextResponse }> {
  if (!isGrClassicEnabled()) return { ok: false, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const { userId } = await auth()
  if (!userId) return { ok: false, response: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  const joinedAs = headers().get(PLAYER_HEADER)
  if (joinedAs && joinedAs !== userId) {
    return { ok: false, response: NextResponse.json({ error: 'This browser is now signed in as a different student.', code: WRONG_ACCOUNT }, { status: 409, headers: { 'Cache-Control': 'no-store' } }) }
  }
  return { ok: true, admin: createAdminClient(), profileId: userId }
}
