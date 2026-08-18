import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { deletePublicStorageObject } from '@/lib/storage/deletePublicObject'
import { deleteSubmissionFiles } from '@/lib/storage/deleteSubmissionFiles'

// DELETE /api/admin/assignments/[id] -- admin can remove any assignment
// (any class, any teacher), unlike the teacher route which RLS scopes
// to the caller's own classes. Cascades to sms_grades/sms_submissions
// (both ON DELETE CASCADE, migrations 004/015) at the DB level -- but
// CASCADE only ever removes rows, never the actual files those rows
// pointed at, so the assignment's own image AND every student's
// submitted file/audio (on whichever provider each landed on) are
// fetched and cleaned up here first. Skipping this would mean the
// files just leak forever once the rows referencing them are gone,
// defeating the entire point of an admin doing this for storage space.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const admin = createAdminClient()

  const { data: assignment, error: findError } = await admin
    .from('sms_assignments')
    .select('image_url')
    .eq('id', params.id)
    .single()

  if (findError || !assignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  }

  const { data: submissions } = await admin
    .from('sms_submissions')
    .select('file_url, audio_url, storage_provider')
    .eq('assignment_id', params.id)

  const { error } = await admin.from('sms_assignments').delete().eq('id', params.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (assignment.image_url) {
    await deletePublicStorageObject('assignment-images', assignment.image_url)
  }
  await Promise.all((submissions ?? []).map((s) => deleteSubmissionFiles(s)))

  return NextResponse.json({ success: true })
}
