import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import { GAME_MODULES } from '@/lib/gameRoom/registry'

// GET /api/game-room/games -- teacher OR student. Lists every
// registered game module's public metadata (never the question bank
// itself) -- powers both the teacher host's game-type dropdown
// (GameRoomHostClient.tsx) and the student's solo-practice dropdown
// (GameRoomStudentClient.tsx). Confirmed as a real bug: this was
// teacher-only (requireTeacher()), so a student caller always got a 403
// and the practice dropdown never populated. The list itself has
// nothing sensitive in it (names/descriptions/counts, not question
// content), so any active, authenticated profile is fine here -- just
// not a fully anonymous caller.
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const supabase = createClient()
  const { data: profile } = await supabase.from('sms_profiles').select('role, is_active').eq('id', userId).single()
  if (!profile || !profile.is_active || !['teacher', 'student'].includes(profile.role)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const games = GAME_MODULES.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    categories: m.categories ?? [],
    questionCount: m.getQuestionBank().length,
  }))

  return NextResponse.json({ games })
}
