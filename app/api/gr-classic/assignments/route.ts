import { NextResponse } from 'next/server'
import { validateAssignment } from '@/lib/grClassic/assignments'
import { dbErrorResponse, grcTeacherApi, readJson } from '@/lib/grClassic/server/auth'
import { categoryNames, getGame, listCategories } from '@/lib/grClassic/server/db'
import { publishAssignment } from '@/lib/grClassic/server/teacherAssignments'

// POST /api/gr-classic/assignments { gameId, classIds, dueAt, settings }
// Publishes one of the teacher's games to classes they teach. The game's
// questions are copied at this moment (sms_grc_publish_assignment), so
// later edits to the game don't change the assignment.
export async function POST(request: Request) {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  const body = await readJson(request)
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const v = validateAssignment(body)
  if (!v.ok) return NextResponse.json({ error: v.errors.join(' '), errors: v.errors }, { status: 400 })
  const game = await getGame(guard.supabase, v.value.gameId, categoryNames(await listCategories(guard.supabase, guard.userId)))
  if (!game) return NextResponse.json({ error: 'Game not found.' }, { status: 404 })
  if (!game.questions.length) return NextResponse.json({ error: 'This game has no questions.' }, { status: 400 })
  const { data, error } = await publishAssignment(guard.supabase, game, v.value)
  if (error) return dbErrorResponse(error, 'publish assignment')
  return NextResponse.json({ id: data as string }, { status: 201 })
}
