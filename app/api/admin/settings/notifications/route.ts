import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireEnum } from '@/lib/validation'

const DIGEST_FREQUENCIES = ['immediate', 'daily', 'weekly'] as const

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const admin = createAdminClient()
  const { data, error } = await admin.from('sms_notification_settings').select('*').eq('id', 1).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ item: data })
}

export async function PATCH(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const errors: string[] = []
  const digestFrequency = requireEnum(body.digest_frequency, DIGEST_FREQUENCIES, 'Digest frequency', errors)
  if (errors.length > 0) return NextResponse.json({ error: errors.join('; ') }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sms_notification_settings')
    .update({
      notify_email_enabled: Boolean(body.notify_email_enabled),
      notify_push_enabled: Boolean(body.notify_push_enabled),
      digest_frequency: digestFrequency,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ item: data })
}
