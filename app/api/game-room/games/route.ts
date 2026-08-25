import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { GAME_MODULES } from '@/lib/gameRoom/registry'

// GET /api/game-room/games -- teacher-only. Lists every registered game
// module's public metadata (never the question bank itself) -- powers
// the host's game-type dropdown in GameRoomHostClient.tsx. Adding a new
// module to lib/gameRoom/registry.ts makes it appear here automatically.
export async function GET() {
  const guard = await requireTeacher()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
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
