import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteSubmissionFiles } from '@/lib/storage/deleteSubmissionFiles'

// DELETE /api/admin/submissions/[id] -- remove one student's submission
// (and its underlying file/audio, wherever they live) along with any
// grade/feedback for that assignment. Confirmed as a real bug: leaving
// the grade in place after deleting the submission it was for showed the
// student "Submit work" (implying they hadn't) right next to their old
// score and feedback -- a deleted submission needs to look un-submitted
// end to end, not partially.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const admin = createAdminClient()

  const { data: submission, error: findError } = await admin
    .from('sms_submissions')
    .select('assignment_id, student_id, file_url, audio_url, storage_provider')
    .eq('id', params.id)
    .single()

  if (findError || !submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
  }

  const { error } = await admin.from('sms_submissions').delete().eq('id', params.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await admin
    .from('sms_grades')
    .delete()
    .eq('assignment_id', submission.assignment_id)
    .eq('student_id', submission.student_id)

  // Row deletion already succeeded -- a Storage/B2 hiccup during
  // best-effort file cleanup shouldn't make the client think the delete
  // itself failed (see the same fix on the assignments route).
  try {
    await deleteSubmissionFiles(submission)
  } catch {
    // ignore
  }

  return NextResponse.json({ success: true })
}
