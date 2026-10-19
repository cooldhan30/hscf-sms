import { NextResponse } from 'next/server'
import { readJson } from '@/lib/grClassic/server/auth'
import { errorResponse, grcStudentApi } from '@/lib/grClassic/server/studentAssignments'
import { recordTopicPlay } from '@/lib/grClassic/server/topicProgress'
import { parsePlayed } from '@/lib/grClassic/topicPlay'

// POST /api/gr-classic/practice/topic/finish { results: [{ questionId, correct, total }] }
// A Play Offline game ended: add it to the student's scores per topic
// (shown on their home page). Practice only, never a grade.
export async function POST(request: Request) {
  const guard = await grcStudentApi()
  if (!guard.ok) return guard.response
  const body = await readJson(request)
  const played = parsePlayed(body?.results)
  if (!played) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  try {
    await recordTopicPlay(guard.admin, guard.studentId, played)
    return NextResponse.json({ saved: true })
  } catch (e) {
    return errorResponse(e, 'save topic scores')
  }
}
