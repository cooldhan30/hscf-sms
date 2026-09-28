import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { requireString, optionalString } from '@/lib/validation'
import { getB2ReadUrl } from '@/lib/storage/b2'

const READ_URL_TTL_SECONDS = 60 * 60

// GET /api/teacher/stories -- the caller's own saved stories (RLS
// "teacher_stories: teacher manage own" is the real enforcement), newest
// first, for the "My Stories" library. image_key (durable) is turned
// into a fresh signed imageUrl on every read, since a stored signed URL
// would go stale within the hour.
export async function GET() {
  const guard = await requireTeacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase } = guard

  const { data: rows, error } = await supabase
    .from('sms_teacher_stories')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Which classes each story is already assigned to (story_id, migration
  // 089), so My Stories can warn before a duplicate assignment.
  const storyIds = (rows ?? []).map((r) => r.id)
  const { data: assignedRows } =
    storyIds.length > 0
      ? await supabase.from('sms_assignments').select('story_id, class_id').in('story_id', storyIds)
      : { data: [] as { story_id: string; class_id: string }[] }
  const assignedClassIds = new Map<string, string[]>()
  for (const a of assignedRows ?? []) {
    assignedClassIds.set(a.story_id, [...(assignedClassIds.get(a.story_id) ?? []), a.class_id])
  }

  const stories = await Promise.all(
    (rows ?? []).map(async (row) => ({
      ...row,
      imageUrl: row.image_key ? await getB2ReadUrl(row.image_key, READ_URL_TTL_SECONDS) : null,
      assignedClassIds: assignedClassIds.get(row.id) ?? [],
    }))
  )

  return NextResponse.json({ stories })
}

// POST /api/teacher/stories -- explicit save, triggered by the teacher
// clicking "Save Story" in the generator -- never called automatically
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
  const story = requireString(body.story, 'Story', errors)
  const imageKey = optionalString(body.imageKey)
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const { data: savedStory, error } = await supabase
    .from('sms_teacher_stories')
    .insert([{ theme, story, image_key: imageKey, created_by: profile.id }])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ story: savedStory }, { status: 201 })
}
