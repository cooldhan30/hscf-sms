import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { optionalString } from '@/lib/validation'
import { deletePublicStorageObject } from '@/lib/storage/deletePublicObject'
import { parseSubmissionTypes } from '@/lib/submissionTypes'
import { isResourcesBucketUrl } from '@/lib/storage/resourcesUrl'

// PATCH /api/teacher/assignments/[id] -- edit / publish / unpublish.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireTeacher()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase } = guard

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if ('title' in body) updates.title = optionalString(body.title)
  if ('description' in body) updates.description = optionalString(body.description)
  if ('dueDate' in body) updates.due_date = optionalString(body.dueDate)
  if ('maxScore' in body) updates.max_score = Number(body.maxScore)
  if ('pointsDeductionPerDay' in body) updates.points_deduction_per_day = Number(body.pointsDeductionPerDay) || 0
  if ('published' in body) updates.published = Boolean(body.published)
  if ('imageUrl' in body) updates.image_url = optionalString(body.imageUrl)
  if ('imageSize' in body) updates.image_size = typeof body.imageSize === 'number' && body.imageSize > 0 ? body.imageSize : null
  if ('assignmentType' in body) updates.assignment_type = body.assignmentType === 'exam' ? 'exam' : 'assignment'
  if ('audioUrl' in body) {
    const audioUrl = optionalString(body.audioUrl)
    if (audioUrl && !isResourcesBucketUrl(audioUrl)) {
      return NextResponse.json({ error: 'Audio must be uploaded here' }, { status: 400 })
    }
    updates.audio_url = audioUrl
    updates.audio_size = audioUrl && typeof body.audioSize === 'number' && body.audioSize > 0 ? body.audioSize : null
  }
  if ('submissionTypes' in body) {
    const types = parseSubmissionTypes(body.submissionTypes)
    if (!types) return NextResponse.json({ error: 'Choose how students submit' }, { status: 400 })
    updates.allow_submission_types = types
  }

  // The audio clip being replaced or removed, so its file can be freed
  // once the update succeeds (same idea as DELETE below).
  const { data: before } = 'audioUrl' in body
    ? await supabase.from('sms_assignments').select('audio_url').eq('id', params.id).maybeSingle()
    : { data: null }

  // RLS ("assignments: teacher manage own class") enforces that this
  // update can only succeed for the teacher's own class's assignments.
  const { data, error } = await supabase
    .from('sms_assignments')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Assignment not found or not yours' }, { status: 400 })
  }

  if (before?.audio_url && before.audio_url !== data.audio_url) {
    await deletePublicStorageObject('resources', before.audio_url)
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/teacher/assignments/[id]
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireTeacher()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase } = guard

  // RLS scopes this select to the teacher's own class's assignments --
  // if it comes back empty, either it doesn't exist or isn't theirs, and
  // the delete below will no-op the same way either case should.
  const { data: assignment } = await supabase.from('sms_assignments').select('image_url, audio_url').eq('id', params.id).single()

  const { error } = await supabase.from('sms_assignments').delete().eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (assignment?.image_url) {
    await deletePublicStorageObject('assignment-images', assignment.image_url)
  }
  if (assignment?.audio_url) {
    await deletePublicStorageObject('resources', assignment.audio_url)
  }

  return NextResponse.json({ success: true })
}
