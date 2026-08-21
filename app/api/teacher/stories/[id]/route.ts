import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { optionalString } from '@/lib/validation'

// PATCH /api/teacher/stories/[id] -- attach/replace the illustration on
// an already-saved story (generating or regenerating an image happens
// after the initial save, as its own step). RLS ("teacher_stories:
// teacher manage own") scopes this to the caller's own rows -- updating
// someone else's story affects 0 rows, surfaced as 404 below.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireTeacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase } = guard

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if ('imageKey' in body) updates.image_key = optionalString(body.imageKey)

  const { data, error } = await supabase
    .from('sms_teacher_stories')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Story not found' }, { status: 404 })
  }
  return NextResponse.json({ story: data })
}

// DELETE /api/teacher/stories/[id] -- remove a saved story from the
// library. Same RLS scoping as PATCH above.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireTeacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase } = guard

  const { data, error } = await supabase.from('sms_teacher_stories').delete().eq('id', params.id).select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Story not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
