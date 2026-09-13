import { NextResponse } from 'next/server'
import { requireMayangoliHost } from '@/lib/gameRoom/modules/mayangoli/requireSession'
import { displayForm } from '@/lib/gameRoom/modules/mayangoli/groups'

// POST /api/mayangoli/report -- teacher-only. Body: { sessionId }.
// Post-game report: final leaderboard + per-target-letter accuracy
// ("ழ் 62% -- Needs Practice"), used by the teacher's results screen.
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

  const [{ data: leaderboard }, { data: letterAccuracy }] = await Promise.all([
    supabase.rpc('sms_mayangoli_leaderboard', { p_session_id: session.id }),
    supabase.rpc('sms_mayangoli_letter_accuracy', { p_session_id: session.id }),
  ])

  return NextResponse.json({
    status: session.status,
    leaderboard: leaderboard ?? [],
    letterAccuracy: (letterAccuracy ?? []).map((row: { target_letter: string; total: number; correct: number; accuracy_pct: number | null }) => ({
      ...row,
      displayLetter: displayForm(row.target_letter),
    })),
  })
}
