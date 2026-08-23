import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { requireString, optionalString } from '@/lib/validation'
import { getB2ReadUrl } from '@/lib/storage/b2'
import { isWorksheetContent } from '@/lib/worksheetTypes'

const READ_URL_TTL_SECONDS = 60 * 60

// GET /api/teacher/worksheets -- the caller's own saved worksheets (RLS
// "teacher_worksheets: teacher manage own" is the real enforcement),
// newest first, for the "My Worksheets" library. image_key (durable) is
// turned into a fresh signed imageUrl on every read, since a stored
// signed URL would go stale within the hour.
export async function GET() {
  const guard = await requireTeacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase } = guard

  const { data: rows, error } = await supabase
    .from('sms_teacher_worksheets')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const worksheets = await Promise.all(
    (rows ?? []).map(async (row) => ({
      ...row,
      imageUrl: row.image_key ? await getB2ReadUrl(row.image_key, READ_URL_TTL_SECONDS) : null,
    }))
  )

  return NextResponse.json({ worksheets })
}

// POST /api/teacher/worksheets -- explicit save, triggered by the teacher
// clicking "Save Worksheet" in the generator -- never called automatically
// on generation, so rejected/half-finished drafts never land here.
export async function POST(request: Request) {
  const guard = await requireTeacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, profile } = guard

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []
  const theme = requireString(body.theme, 'Theme', errors)
  const imageKey = optionalString(body.imageKey)
  if (!isWorksheetContent(body.content)) {
    errors.push('Content must be a valid worksheet object')
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const { data: savedWorksheet, error } = await supabase
    .from('sms_teacher_worksheets')
    .insert([{ theme, content: body.content, image_key: imageKey, created_by: profile.id }])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ worksheet: savedWorksheet }, { status: 201 })
}
