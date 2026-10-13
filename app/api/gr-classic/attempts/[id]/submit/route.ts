import { NextResponse } from 'next/server'
import { errorResponse, grcStudentApi, submitAttempt } from '@/lib/grClassic/server/studentAssignments'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// POST /api/gr-classic/attempts/:id/submit -- Finish & Submit. Responds
// only after the grade is stored; repeating it never makes a second grade.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await grcStudentApi()
  if (!guard.ok) return guard.response
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 })
  try {
    return NextResponse.json(await submitAttempt(guard.admin, guard.studentId, params.id))
  } catch (e) {
    return errorResponse(e, 'submit attempt')
  }
}
