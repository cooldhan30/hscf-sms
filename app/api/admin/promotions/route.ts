import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireString } from '@/lib/validation'

// GET /api/admin/promotions?sourceClassId=&targetClassId=
// Read-only preview of a year rollover: exactly which students would move
// and which are already in the target. Nothing is written.
export async function GET(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const { searchParams } = new URL(request.url)
  const sourceClassId = searchParams.get('sourceClassId')
  const targetClassId = searchParams.get('targetClassId')

  if (!sourceClassId || !targetClassId) {
    return NextResponse.json({ error: 'sourceClassId and targetClassId are required' }, { status: 400 })
  }
  if (sourceClassId === targetClassId) {
    return NextResponse.json({ error: 'Source and target class must be different' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin.rpc('sms_preview_class_promotion', {
    p_source_class_id: sourceClassId,
    p_target_class_id: targetClassId,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ students: data ?? [] })
}

// POST /api/admin/promotions -- commit the rollover.
// Body: { sourceClassId, targetClassId }
//
// The whole cohort moves in one transaction inside sms_promote_class();
// see 030_class_promotion.sql for why this isn't done as separate writes
// from here.
export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []
  const sourceClassId = requireString(body.sourceClassId, 'Source class', errors)
  const targetClassId = requireString(body.targetClassId, 'Target class', errors)

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }
  if (sourceClassId === targetClassId) {
    return NextResponse.json({ error: 'Source and target class must be different' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin.rpc('sms_promote_class', {
    p_source_class_id: sourceClassId,
    p_target_class_id: targetClassId,
    p_actor_id: guard.profile.id,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ promotionId: data }, { status: 201 })
}
