import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

// DELETE /api/admin/students/[id]/purge -- PERMANENTLY remove a student
// and their data (see sms_purge_student, migration 038). Irreversible.
// Only meant to be reachable from the admin's "Deleted" tab, on someone
// already soft-deleted via DELETE /api/admin/students/[id].
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const admin = createAdminClient()

  const { error } = await admin.rpc('sms_purge_student', { p_student_id: params.id })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
