import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

// Real, on-demand action behind "Download Backup Now": dumps every sms_*
// table to a single JSON file and records last_backup_at. This is the
// actual backup functionality this app can offer -- there's no
// cron/worker to run BACKUP_TABLES on a schedule automatically.
const BACKUP_TABLES = [
  'sms_profiles',
  'sms_teachers',
  'sms_students',
  'sms_parents',
  'sms_student_parents',
  'sms_classes',
  'sms_class_enrollments',
  'sms_attendance',
  'sms_assignments',
  'sms_grades',
  'sms_announcements',
  'sms_announcement_classes',
  'sms_school_settings',
  'sms_academic_years',
  'sms_grade_levels',
  'sms_sections',
  'sms_calendar_events',
]

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const admin = createAdminClient()

  const results = await Promise.all(BACKUP_TABLES.map((table) => admin.from(table).select('*')))

  const failed = results
    .map((res, i) => (res.error ? BACKUP_TABLES[i] : null))
    .filter((name): name is string => name !== null)
  if (failed.length > 0) {
    return NextResponse.json(
      { error: `Backup failed reading table(s): ${failed.join(', ')}` },
      { status: 500 }
    )
  }

  const dump: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
    tables: {},
  }
  const tables = dump.tables as Record<string, unknown>
  results.forEach((res, i) => {
    tables[BACKUP_TABLES[i]] = res.data ?? []
  })

  const { error: updateError } = await admin
    .from('sms_backup_settings')
    .update({ last_backup_at: new Date().toISOString() })
    .eq('id', 1)
  if (updateError) {
    console.error('Failed to record last_backup_at:', updateError.message)
  }

  return new NextResponse(JSON.stringify(dump, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="hscf-sms-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
