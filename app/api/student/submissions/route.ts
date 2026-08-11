import { NextResponse } from 'next/server'
import { requireStudent } from '@/lib/require-student'
import { optionalString } from '@/lib/validation'

// POST /api/student/submissions -- create or update (resubmit) this
// student's submission for an assignment. The actual file/audio bytes
// are uploaded directly to Storage from the browser first (see
// lib/supabase/client.ts) -- this route only persists the resulting
// object paths, so large audio blobs never get proxied through a Next.js
// route handler. RLS ("submissions: student manage own") is the real
// enforcement; the explicit checks here just give clean error responses.
export async function POST(request: Request) {
  const guard = await requireStudent()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, student } = guard

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const assignmentId = optionalString(body.assignmentId)
  if (!assignmentId) {
    return NextResponse.json({ error: 'assignmentId is required' }, { status: 400 })
  }
  const content = optionalString(body.content)
  const filePath = optionalString(body.filePath)
  const audioPath = optionalString(body.audioPath)

  if (!content && !filePath && !audioPath) {
    return NextResponse.json({ error: 'Provide text, a file, or an audio recording' }, { status: 400 })
  }

  const { data: assignment } = await supabase
    .from('sms_assignments')
    .select('id')
    .eq('id', assignmentId)
    .eq('published', true)
    .single()

  if (!assignment) {
    return NextResponse.json({ error: 'Assignment not found or not published' }, { status: 404 })
  }

  // A resubmit only sends filePath/audioPath when the student actually
  // attached a NEW file/recording this time -- falling back to whatever
  // was already on the existing row means adding text to an earlier
  // submission (or any other resubmit that doesn't touch the
  // file/audio) doesn't silently wipe out a file or recording that's
  // already there. Previously this always wrote filePath/audioPath as
  // given (null if omitted), which really did erase a prior audio
  // recording the first time a student resubmitted without re-recording.
  // Confirmed as a real bug: 2026-08-09.
  const { data: existing } = await supabase
    .from('sms_submissions')
    .select('file_url, audio_url')
    .eq('assignment_id', assignmentId)
    .eq('student_id', student.id)
    .maybeSingle()

  const { data: submission, error } = await supabase
    .from('sms_submissions')
    .upsert(
      [
        {
          assignment_id: assignmentId,
          student_id: student.id,
          content,
          file_url: filePath ?? existing?.file_url ?? null,
          audio_url: audioPath ?? existing?.audio_url ?? null,
          submitted_at: new Date().toISOString(),
        },
      ],
      { onConflict: 'assignment_id,student_id' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ submission }, { status: 201 })
}
