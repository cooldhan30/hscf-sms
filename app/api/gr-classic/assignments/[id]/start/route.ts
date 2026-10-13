import { NextResponse } from 'next/server'
import { errorResponse, grcStudentApi, startAttempt } from '@/lib/grClassic/server/studentAssignments'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// POST /api/gr-classic/assignments/:id/start -- a student starts the
// assignment, or picks up where they left off. Returns answer-free
// questions only.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await grcStudentApi()
  if (!guard.ok) return guard.response
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Assignment not found.' }, { status: 404 })
  try {
    return NextResponse.json(await startAttempt(guard.admin, guard.studentId, params.id))
  } catch (e) {
    return errorResponse(e, 'start assignment')
  }
}
