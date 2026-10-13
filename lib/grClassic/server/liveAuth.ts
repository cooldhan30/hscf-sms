import 'server-only'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { isGrClassicEnabled } from '../release'

// The once-a-second calls a student's phone makes during a live game
// (state and answers). Joining already ran the full student check
// (requireStudent + class enrollment); after that, the signed-in Clerk
// user must own a player row in the game -- checked on every call in
// lib/grClassic/server/live.ts -- which keeps each poll cheap.
export async function grcLivePlayer(): Promise<{ ok: true; admin: SupabaseClient; profileId: string } | { ok: false; response: NextResponse }> {
  if (!isGrClassicEnabled()) return { ok: false, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const { userId } = await auth()
  if (!userId) return { ok: false, response: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  return { ok: true, admin: createAdminClient(), profileId: userId }
}
