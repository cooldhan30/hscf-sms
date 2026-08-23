import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { requireString, optionalString } from '@/lib/validation'
import { isWorksheetContent } from '@/lib/worksheetTypes'

// PATCH /api/teacher/worksheets/[id] -- update an already-saved worksheet.
// Mirrors app/api/teacher/stories/[id]/route.ts -- RLS ("teacher_worksheets:
// teacher manage own") scopes this to the caller's own rows; updating
// someone else's worksheet affects 0 rows, surfaced as 404 below.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireTeacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase } = guard

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []
  const updates: Record<string, unknown> = {}
  if ('theme' in body) updates.theme = requireString(body.theme, 'Theme', errors)
  if ('content' in body) {
    if (!isWorksheetContent(body.content)) {
      errors.push('Content must be a valid worksheet object')
    } else {
      updates.content = body.content
    }
  }
  if ('imageKey' in body) updates.image_key = optionalString(body.imageKey)
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sms_teacher_worksheets')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Worksheet not found' }, { status: 404 })
  }
  return NextResponse.json({ worksheet: data })
}

// DELETE /api/teacher/worksheets/[id] -- remove a saved worksheet from
// the library. Same RLS scoping as PATCH above.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireTeacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase } = guard

  const { data, error } = await supabase.from('sms_teacher_worksheets').delete().eq('id', params.id).select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Worksheet not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
