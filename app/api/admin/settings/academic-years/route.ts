import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireString, optionalString } from '@/lib/validation'

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const admin = createAdminClient()
  const { data, error } = await admin.from('sms_academic_years').select('*').order('label', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ items: data })
}

// POST /api/admin/settings/academic-years -- create a new academic year.
// is_current defaults to false here; use PATCH .../is-current to switch
// the active year (kept as a separate action so creating a year never
// silently demotes the current one).
export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const errors: string[] = []
  const label = requireString(body.label, 'Label', errors)
  const startDate = optionalString(body.start_date)
  const endDate = optionalString(body.end_date)
  if (errors.length > 0) return NextResponse.json({ error: errors.join('; ') }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sms_academic_years')
    .insert([{ label, start_date: startDate, end_date: endDate }])
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ item: data }, { status: 201 })
}
