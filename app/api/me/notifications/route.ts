import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/me/notifications -- this person's recent notifications.
//
// No profile id is accepted or trusted: the "notifications: read own"
// policy scopes the query to the caller, so there is no parameter here
// that could read somebody else's.
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const supabase = createClient()

  const { data, error } = await supabase
    .from('sms_notifications')
    .select('id, type, title, body, link, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const items = data ?? []
  return NextResponse.json({
    items,
    unread: items.filter((n) => !n.read_at).length,
  })
}

// POST /api/me/notifications -- mark as read.
// Body: { id } for one, or {} for all.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const supabase = createClient()

  let query = supabase
    .from('sms_notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)

  if (typeof body?.id === 'string') {
    query = query.eq('id', body.id)
  }

  const { error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
