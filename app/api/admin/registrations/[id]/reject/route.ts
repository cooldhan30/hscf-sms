import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/admin/registrations/[id]/reject
// Only updates the pre-existing registration_status column -- no accounts
// are created, nothing else on website_registrations is touched.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const admin = createAdminClient()

  const { data: registration, error: findError } = await admin
    .from('website_registrations')
    .select('id, registration_status')
    .eq('id', params.id)
    .single()

  if (findError || !registration) {
    return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
  }

  const { error } = await admin
    .from('website_registrations')
    .update({ registration_status: 'rejected' })
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
