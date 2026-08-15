import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

// DELETE /api/admin/teachers/[id]/purge -- PERMANENTLY remove a teacher
// and their data (see sms_purge_profile, migration 038). Irreversible.
// Only meant to be reachable from the admin's "Deleted" tab, on someone
// already soft-deleted via DELETE /api/admin/teachers/[id].
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const admin = createAdminClient()

  const { data: teacher, error: findError } = await admin
    .from('sms_teachers')
    .select('profile_id')
    .eq('id', params.id)
    .single()

  if (findError || !teacher) {
    return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })
  }

  const { error } = await admin.rpc('sms_purge_profile', { p_profile_id: teacher.profile_id })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
