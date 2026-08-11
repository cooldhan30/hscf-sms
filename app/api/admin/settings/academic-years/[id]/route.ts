import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const admin = createAdminClient()
  const update: Record<string, unknown> = {}
  if ('label' in body) update.label = String(body.label)
  if ('start_date' in body) update.start_date = body.start_date || null
  if ('end_date' in body) update.end_date = body.end_date || null

  // Making a year "current" is exclusive -- unset every other row first so
  // the migration's one-current partial unique index never conflicts.
  const makingCurrent = 'is_current' in body && (body.is_current === true || body.is_current === 'true')
  if (makingCurrent) {
    await admin.from('sms_academic_years').update({ is_current: false }).neq('id', params.id)
    update.is_current = true

    const { data: year } = await admin.from('sms_academic_years').select('label').eq('id', params.id).single()
    if (year) {
      await admin.from('sms_school_settings').update({ current_academic_year: year.label }).eq('id', 1)
    }
  } else if ('is_current' in body) {
    update.is_current = false
  }

  const { data, error } = await admin.from('sms_academic_years').update(update).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ item: data })
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const admin = createAdminClient()
  const { data: year } = await admin.from('sms_academic_years').select('is_current').eq('id', params.id).single()
  if (year?.is_current) {
    return NextResponse.json({ error: 'Cannot delete the current academic year. Set another year as current first.' }, { status: 400 })
  }

  const { error } = await admin.from('sms_academic_years').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
