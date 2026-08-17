import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'

// DELETE /api/resources/[id] -- admin can delete any resource; a
// teacher only their own (created_by). RLS ("resources: teacher delete
// own" / "resources: admin all") is the real enforcement -- the delete
// itself will simply affect 0 rows if this teacher doesn't own it, which
// is surfaced below as a 404 rather than a silent no-op.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const supabase = createClient()

  const { data, error } = await supabase.from('sms_resources').delete().eq('id', params.id).select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Resource not found, or you can only delete resources you uploaded' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
