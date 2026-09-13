import { NextResponse } from 'next/server'
import { requireMayangoliHost } from '@/lib/gameRoom/modules/mayangoli/requireSession'

// POST /api/mayangoli/end -- teacher-only. Body: { sessionId }. Manual
// early-end (e.g. running out of class time) -- the normal path is
// advance's 'next' past the last question, this is the escape hatch.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const guard = await requireMayangoliHost(body.sessionId)
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, session } = guard

  if (session.status === 'ended') {
    return NextResponse.json({ error: 'Game has already ended' }, { status: 409 })
  }

  const { data: updated, error } = await supabase
    .from('sms_mayangoli_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', session.id)
    .neq('status', 'ended')
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: error?.message || 'Failed to end game' }, { status: 400 })
  }

  return NextResponse.json({ status: updated.status })
}
