import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/admin/promotions/[id]/undo -- reverse a rollover.
//
// Restores every student's previous grade level and academic year from
// the per-student snapshot taken at promotion time, and touches only the
// rows that promotion created. Promoting the wrong class is a plausible
// mistake across a whole cohort, so it has to be reversible.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const admin = createAdminClient()

  const { data, error } = await admin.rpc('sms_undo_class_promotion', {
    p_promotion_id: params.id,
    p_actor_id: guard.profile.id,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ restoredCount: data })
}
