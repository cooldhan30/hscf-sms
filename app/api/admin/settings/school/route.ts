import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireString, optionalString } from '@/lib/validation'

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const admin = createAdminClient()
  const { data, error } = await admin.from('sms_school_settings').select('*').eq('id', 1).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ item: data })
}

export async function PATCH(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const errors: string[] = []
  const schoolName = requireString(body.school_name, 'School name', errors)
  if (errors.length > 0) return NextResponse.json({ error: errors.join('; ') }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sms_school_settings')
    .update({
      school_name: schoolName,
      logo_url: optionalString(body.logo_url),
      contact_email: optionalString(body.contact_email),
      contact_phone: optionalString(body.contact_phone),
      address: optionalString(body.address),
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ item: data })
}
