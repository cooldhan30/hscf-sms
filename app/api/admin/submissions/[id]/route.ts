import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteSubmissionFiles } from '@/lib/storage/deleteSubmissionFiles'

// DELETE /api/admin/submissions/[id] -- remove one student's submission
// (and its underlying file/audio, wherever they live) without touching
// the assignment or the rest of the class's submissions. Any existing
// grade for that student/assignment is left alone -- deleting a
// submission is a content/storage cleanup action, not an undo-the-grade
// action.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const admin = createAdminClient()

  const { data: submission, error: findError } = await admin
    .from('sms_submissions')
    .select('file_url, audio_url, storage_provider')
    .eq('id', params.id)
    .single()

  if (findError || !submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
  }

  const { error } = await admin.from('sms_submissions').delete().eq('id', params.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

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
