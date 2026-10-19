import { NextResponse } from 'next/server'
import { dbErrorResponse, grcTeacherApi, readJson } from '@/lib/grClassic/server/auth'
import { createLiveSession } from '@/lib/grClassic/server/live'
import { teacherClasses } from '@/lib/grClassic/server/teacherAssignments'
import { createAdminClient } from '@/lib/supabase/admin'
import { pickTopicQuestions } from '@/lib/grClassic/server/topics'
import { GrcError } from '@/lib/grClassic/server/studentAssignments'
import { parseTopicPlay } from '@/lib/grClassic/topicPlay'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// POST /api/gr-classic/live/topic { topic, type, count, seconds, classId }
// Starts a live game straight from a topic of the shared question library
// (no saved game needed): the server draws `count` random questions and
// opens the lobby for the class. Returns { sessionId }.
export async function POST(request: Request) {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  const body = await readJson(request)
  const parsed = parseTopicPlay(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const classId = body?.classId
  if (!isUuid(classId)) return NextResponse.json({ error: 'Choose a class.' }, { status: 400 })
  if (!(await teacherClasses(guard.supabase)).some((c) => c.id === classId)) return NextResponse.json({ error: 'You can only host live games for your own classes.' }, { status: 403 })
  try {
    // Picked by the server (reading the library needs no per-question
    // permission check); the live game below is created as the teacher.
    const { title, questions } = await pickTopicQuestions(createAdminClient(), parsed.value)
    const sessionId = await createLiveSession(guard.supabase, { gameId: null, title, type: parsed.value.type, liveSeconds: parsed.value.seconds, questions }, classId as string)
    return NextResponse.json({ sessionId }, { status: 201 })
  } catch (e) {
    if (e instanceof GrcError) return NextResponse.json({ error: e.message }, { status: e.status })
    return dbErrorResponse(e as { code?: string; message?: string }, 'start topic game')
  }
}
