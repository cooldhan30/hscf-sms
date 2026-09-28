import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { requireString, optionalString } from '@/lib/validation'
import { getB2ReadUrl } from '@/lib/storage/b2'
import { isWorksheetContent, renderWorksheetAsPlainText } from '@/lib/worksheetTypes'

// POST /api/teacher/assignments -- create an assignment for one of the
// teacher's own classes. RLS ("assignments: teacher manage own class")
// is the real enforcement; the explicit class-ownership check here just
// gives a clean 403 instead of a raw Postgres RLS error.
export async function POST(request: Request) {
  const guard = await requireTeacher()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, profile } = guard

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []
  const classId = requireString(body.classId, 'Class', errors)
  const title = requireString(body.title, 'Title', errors)
  // A worksheet assignment sends structured content instead of a plain
  // description -- rendered to plain text below, since students see
  // assignment descriptions as plain text (no rich-content renderer).
  let description = optionalString(body.description)
  if (body.worksheetContent !== undefined) {
    if (!isWorksheetContent(body.worksheetContent)) {
      errors.push('Worksheet content is invalid')
    } else {
      description = renderWorksheetAsPlainText(body.worksheetContent)
    }
  }
  const dueDate = optionalString(body.dueDate)
  const maxScore = Number(body.maxScore)
  if (!body.maxScore || Number.isNaN(maxScore) || maxScore <= 0) {
    errors.push('Max score must be a positive number')
  }
  const pointsDeductionPerDay = body.pointsDeductionPerDay === undefined || body.pointsDeductionPerDay === ''
    ? 0
    : Number(body.pointsDeductionPerDay)
  if (Number.isNaN(pointsDeductionPerDay) || pointsDeductionPerDay < 0) {
    errors.push('Late penalty must be zero or a positive number')
  }
  const published = Boolean(body.published)
  let imageUrl = optionalString(body.imageUrl)
  const imageSize = typeof body.imageSize === 'number' && body.imageSize > 0 ? body.imageSize : null
  const resourceId = optionalString(body.resourceId)
  const storyImageKey = optionalString(body.storyImageKey)
  const storyId = optionalString(body.storyId)
  const assignmentType = body.assignmentType === 'exam' ? 'exam' : 'assignment'
  const shareAsResource = Boolean(body.shareAsResource)

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  // A Story Generator illustration lives in B2 behind a signed URL that
  // expires in an hour (see app/api/story-image/status/route.ts) -- an
  // assignment's image_url is rendered as a plain, unrefreshed <img src>
  // to every enrolled student indefinitely, so the expiring URL can't be
  // stored directly. Re-fetch the bytes and re-upload into the public
  // assignment-images bucket (same bucket/path convention as any other
  // teacher-attached assignment image) to get a durable URL instead.
  if (storyImageKey) {
    try {
      const b2Url = await getB2ReadUrl(storyImageKey, 60)
      const imageRes = await fetch(b2Url)
      if (!imageRes.ok) throw new Error('Could not fetch the story illustration')
      const bytes = await imageRes.arrayBuffer()

      const path = `${profile.id}/${Date.now()}-story.png`
      const { error: uploadError } = await supabase.storage
        .from('assignment-images')
        .upload(path, bytes, { contentType: 'image/png' })
      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage.from('assignment-images').getPublicUrl(path)
      imageUrl = publicUrlData.publicUrl
    } catch {
      // Best-effort -- assigning the story's text is more important than
      // its illustration; a failed image copy shouldn't block the whole
      // assignment from being created.
      imageUrl = null
    }
  }

  // A class can be co-taught (migration 036) -- teacher_id on sms_classes
  // is only the lead/primary teacher, so checking it directly here would
  // wrongly reject a co-teacher RLS itself already allows. This RPC is
  // the same helper "assignments: teacher manage own class" routes
  // through, so this check can never drift from what RLS actually permits.
  const { data: owns } = await supabase.rpc('sms_teacher_owns_class', { p_class_id: classId })
  if (!owns) {
    return NextResponse.json({ error: 'Class not found or not assigned to you' }, { status: 403 })
  }

  // A resource has no built-in "already assigned" indicator on the
  // Resources page, so clicking Assign twice for the same class silently
  // created a second, identical-looking assignment -- confirmed as a
  // real bug: an admin who deleted one kept seeing it "reappear" because
  // it was actually a new row each time, not a delete/cache failure.
  if (resourceId) {
    const { data: existing } = await supabase
      .from('sms_assignments')
      .select('id, title')
      .eq('resource_id', resourceId)
      .eq('class_id', classId)
      // limit(1): with 2+ older duplicates, maybeSingle() alone errors and returns null
      .limit(1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: `This resource is already assigned to this class as "${existing.title}". Delete or edit that one instead of assigning it again.` },
        { status: 409 }
      )
    }
  }

  // Same guard for a saved story (My Stories / Story Generator), linked
  // via story_id (migration 089). RLS on sms_teacher_stories only returns
  // the caller's own stories, so this also rejects someone else's id.
  if (storyId) {
    const { data: story } = await supabase.from('sms_teacher_stories').select('id').eq('id', storyId).maybeSingle()
    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('sms_assignments')
      .select('id, title')
      .eq('story_id', storyId)
      .eq('class_id', classId)
      .limit(1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: `This story is already assigned to this class as "${existing.title}". Delete or edit that one instead of assigning it again.` },
        { status: 409 }
      )
    }
  }

  const { data: assignment, error } = await supabase
    .from('sms_assignments')
    .insert([
      {
        class_id: classId,
        title,
        description,
        due_date: dueDate,
        max_score: maxScore,
        points_deduction_per_day: pointsDeductionPerDay,
        published,
        image_url: imageUrl,
        image_size: imageSize,
        resource_id: resourceId,
        ...(storyId ? { story_id: storyId } : {}),
        assignment_type: assignmentType,
        // A reading exercise's submission is primarily the student
        // recording themselves reading it, but a text box is also useful
        // for written notes/answers about the resource -- SubmissionForm
        // already renders exactly the right inputs based on this list.
        ...(resourceId ? { allow_submission_types: ['audio', 'text'] } : {}),
        created_by: profile.id,
      },
    ])
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Also share this generated story in the shared Resources library, so
  // any other teacher can discover and reuse it for their own class
  // instead of spending tokens regenerating something similar. Separate
  // from the assignment itself (class_id: null -- visible to everyone,
  // not just this one class) and best-effort: a failed share shouldn't
  // undo or block the assignment that was just successfully created.
  //
  // When an illustration exists, the resource's file_url IS the image
  // (imageUrl already holds the durable assignment-images copy made
  // above, re-uploading it a second time here would be redundant) with
  // the full story text in `description` -- ResourcesClient already
  // renders an image file_type as the card thumbnail AND shows
  // `description` as plain text right below the preview, so this
  // reproduces the same "illustration above, story below" layout My
  // Stories uses, with zero UI changes needed. Only when there's no
  // illustration does this fall back to uploading the story as a .txt
  // file, so a share still happens either way.
  if (shareAsResource && description) {
    try {
      let resourceFileUrl: string
      let resourceFileType: string
      let resourceFileSize: number | null
      let resourceDescription: string

      if (imageUrl) {
        resourceFileUrl = imageUrl
        resourceFileType = 'png'
        resourceFileSize = imageSize
        resourceDescription = description
      } else {
        const path = `${profile.id}/${Date.now()}-${assignment.id}.txt`
        const { error: uploadError } = await supabase.storage
          .from('resources')
          .upload(path, description, { contentType: 'text/plain; charset=utf-8' })
        if (uploadError) throw uploadError

        const { data: publicUrlData } = supabase.storage.from('resources').getPublicUrl(path)
        resourceFileUrl = publicUrlData.publicUrl
        resourceFileType = 'txt'
        resourceFileSize = new TextEncoder().encode(description).length
        resourceDescription = 'Story generated with the Story Generator.'
      }

      await supabase.from('sms_resources').insert([
        {
          class_id: null,
          title,
          description: resourceDescription,
          file_url: resourceFileUrl,
          file_type: resourceFileType,
          file_size: resourceFileSize,
          created_by: profile.id,
          category: 'learning-resources',
          subcategory: 'reading-exercises',
          skills: ['reading'],
          tags: ['Reading'],
        },
      ])
    } catch {
      // Best-effort, see comment above -- the assignment already
      // succeeded and is returned below regardless.
    }
  }

  return NextResponse.json({ assignment }, { status: 201 })
}
