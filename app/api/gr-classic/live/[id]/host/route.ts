import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { LiveStatus } from '@/lib/grClassic/live'
import { grcTeacherApi, readJson } from '@/lib/grClassic/server/auth'
import { hostAction, hostState, type HostAction } from '@/lib/grClassic/server/live'
import { errorResponse } from '@/lib/grClassic/server/studentAssignments'
import { isUuid } from '@/lib/grClassic/validateQuestion'

export const dynamic = 'force-dynamic'

const ACTIONS: HostAction[] = ['next', 'end', 'again']
const STATUSES: LiveStatus[] = ['lobby', 'question', 'reveal', 'leaderboard', 'race', 'ended']

// GET  /api/gr-classic/live/:id/host -- the projector view (teacher who
//      hosts this game only). Polled about once a second.
// POST /api/gr-classic/live/:id/host { action, expect } -- Next / End /
//      Play again. `expect` = the step the teacher was looking at.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Live game not found.' }, { status: 404 })
  const state = await hostState(guard.supabase, params.id)
  if (!state) return NextResponse.json({ error: 'Live game not found.' }, { status: 404 })
  return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  const body = await readJson(request)
  const action = body?.action as HostAction
  const expect = body?.expect as { status?: LiveStatus; index?: number } | undefined
  if (!isUuid(params.id) || !ACTIONS.includes(action) || !expect || !STATUSES.includes(expect.status as LiveStatus) || !Number.isInteger(expect.index)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  try {
    await hostAction(guard.supabase, createAdminClient(), params.id, action, { status: expect.status as LiveStatus, index: expect.index as number })
    const state = await hostState(guard.supabase, params.id)
    return NextResponse.json(state)
  } catch (e) {
    return errorResponse(e, 'live host action')
  }
}
