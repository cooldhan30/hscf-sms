import { NextResponse } from 'next/server'
import { validateAssignment } from '@/lib/grClassic/assignments'
import { dbErrorResponse, grcTeacherApi, readJson } from '@/lib/grClassic/server/auth'
import { GrcError } from '@/lib/grClassic/server/studentAssignments'
import { createAdminClient } from '@/lib/supabase/admin'
import { publishAssignment } from '@/lib/grClassic/server/teacherAssignments'
import { pickTopicQuestions } from '@/lib/grClassic/server/topics'
import { parseTopicPlay } from '@/lib/grClassic/topicPlay'

// POST /api/gr-classic/assignments/topic
//   { topic, type, count, seconds, classIds, dueAt, settings }
// Assigns a topic of the shared question library straight to classes (no
// saved game needed). `count` questions are drawn at random now and copied
// into the assignment, so every student gets the same questions and later
// library edits don't change it. (`seconds` is only used by live games.)
export async function POST(request: Request) {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  const body = await readJson(request)
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const topic = parseTopicPlay(body)
  if (!topic.ok) return NextResponse.json({ error: topic.error }, { status: 400 })
  const v = validateAssignment(body, Date.now(), true)
  if (!v.ok) return NextResponse.json({ error: v.errors.join(' '), errors: v.errors }, { status: 400 })
  try {
    // Picked by the server (reading the library needs no per-question
    // permission check); publishing below runs as the teacher.
    const { title, questions } = await pickTopicQuestions(createAdminClient(), topic.value)
    const { data, error } = await publishAssignment(guard.supabase, { id: null, title, type: topic.value.type, questions }, v.value)
    if (error) return dbErrorResponse(error, 'publish topic assignment')
    return NextResponse.json({ id: data as string }, { status: 201 })
  } catch (e) {
    if (e instanceof GrcError) return NextResponse.json({ error: e.message }, { status: e.status })
    return dbErrorResponse(e as { code?: string; message?: string }, 'publish topic assignment')
  }
}
