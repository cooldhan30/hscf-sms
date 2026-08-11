import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireEnum } from '@/lib/validation'

const BACKUP_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const admin = createAdminClient()
  const { data, error } = await admin.from('sms_backup_settings').select('*').eq('id', 1).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ item: data })
}

// Stores the admin's stated backup preference only -- there's no
// cron/worker in this project to actually run scheduled backups on, and
// Supabase already handles point-in-time recovery at the infrastructure
// level. See /api/admin/settings/backup/export for the real, on-demand
// action this settings screen offers.
export async function PATCH(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const errors: string[] = []
  const backupFrequency = requireEnum(body.backup_frequency, BACKUP_FREQUENCIES, 'Backup frequency', errors)
  const retentionDays = Number(body.retention_days)
  if (!Number.isFinite(retentionDays) || retentionDays < 1) errors.push('Retention days must be a positive number')
  if (errors.length > 0) return NextResponse.json({ error: errors.join('; ') }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sms_backup_settings')
    .update({
      auto_backup_enabled: Boolean(body.auto_backup_enabled),
      backup_frequency: backupFrequency,
      retention_days: retentionDays,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ item: data })
}
