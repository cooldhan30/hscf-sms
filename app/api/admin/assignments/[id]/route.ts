import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { deletePublicStorageObject } from '@/lib/storage/deletePublicObject'

// DELETE /api/admin/assignments/[id] -- admin can remove any assignment
// (any class, any teacher), unlike the teacher route which RLS scopes
// to the caller's own classes. Cascades to sms_grades/sms_submissions
// (both ON DELETE CASCADE, migrations 004/015). If the assignment has an
// attached image, that Storage object is removed too -- otherwise
// deleting the row wouldn't actually free any space, which defeats the
// entire point of an admin doing this for storage cleanup.
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

  const { error } = await admin.from('sms_assignments').delete().eq('id', params.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (assignment.image_url) {
    await deletePublicStorageObject('assignment-images', assignment.image_url)
  }

  return NextResponse.json({ success: true })
}
