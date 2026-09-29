import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'

const MAX_IDS = 200

// POST /api/resources/bulk-delete -- Body: { ids: string[] }
// Same rule as deleting one (app/api/resources/[id]): the caller's own
// RLS-scoped client, so the database only lets an admin delete any
// resource and a teacher delete ones they uploaded. Ids the caller may
// not delete are simply not deleted; the response says how many were.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const ids: unknown = body?.ids
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === 'string' && id.length > 0)) {
    return NextResponse.json({ error: 'ids must be a non-empty list' }, { status: 400 })
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json({ error: `Delete at most ${MAX_IDS} resources at a time` }, { status: 400 })
  }

  const supabase = createClient()
  const { data, error } = await supabase.from('sms_resources').delete().in('id', ids).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ deleted: (data ?? []).map((r) => r.id), requested: ids.length })
}
