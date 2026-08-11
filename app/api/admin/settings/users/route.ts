import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/settings/users?role=admin|teacher|student|parent --
// unified account list across all four roles for activation/suspension
// and password resets. There was previously no admin listing at all for
// parent accounts; this fills that gap alongside teachers/students.
export async function GET(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { searchParams } = new URL(request.url)
  const role = searchParams.get('role')

  const admin = createAdminClient()
  let query = admin.from('sms_profiles').select('*').order('created_at', { ascending: false })
  if (role) query = query.eq('role', role)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const counts = { admin: 0, teacher: 0, student: 0, parent: 0 }
  const { data: all } = await admin.from('sms_profiles').select('role')
  for (const p of all ?? []) {
    if (p.role in counts) counts[p.role as keyof typeof counts]++
  }

  return NextResponse.json({ items: data, counts })
}
