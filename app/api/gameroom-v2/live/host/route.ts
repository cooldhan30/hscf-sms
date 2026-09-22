import { NextResponse } from 'next/server'
import { requireGameV2Teacher } from '@/lib/gameRoomV2/requireTeacherAccess'
import { requireString } from '@/lib/validation'
import { getGameEngineV2 } from '@/lib/gameRoomV2/registry'
import { checkEngineCompatibility } from '@/lib/gameRoomV2/domain'

// POST /api/gameroom-v2/live/host -- the teacher flow's final step:
// "Select Question Set -> Select compatible Game -> Host Live -> Receive
// join code". Body: { questionSetId, engineId, classId }. Validates the
// same engine/question-set compatibility sessions/start/route.ts
// already enforces for solo play, PLUS that the caller actually teaches
// classId (a teacher can't host a live session "for" a class they
// don't own -- the concrete mechanism behind
// sms_gamev2_live_sessions.class_id being the join-authorization
// anchor every student's /join call checks against).
export async function POST(request: Request) {
  const guard = await requireGameV2Teacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, teacher, isAdmin } = guard

  if (!teacher && !isAdmin) {
    return NextResponse.json({ error: 'No teacher record found for this account' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []
  const questionSetId = requireString(body.questionSetId, 'Question set', errors)
  const engineId = requireString(body.engineId, 'Game', errors)
  const classId = requireString(body.classId, 'Class', errors)
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const engine = getGameEngineV2(engineId)
  if (!engine) {
    return NextResponse.json({ error: 'Unknown game engine' }, { status: 400 })
  }
  if (engine.status !== 'ACTIVE' && engine.status !== 'BETA') {
    return NextResponse.json({ error: `${engine.name} is not playable yet (${engine.status})` }, { status: 409 })
  }
  if (!engine.compatibility.liveClassroomSupport) {
    return NextResponse.json({ error: `${engine.name} does not support Live Classroom yet` }, { status: 409 })
  }

  // A teacher can only host for a class they actually teach -- checked
  // directly (not relying solely on RLS) so a clear 403 comes back
  // instead of a generic insert failure.
  if (!isAdmin) {
    const { data: ownedClass } = await supabase.from('sms_classes').select('id').eq('id', classId).eq('teacher_id', teacher!.id).maybeSingle()
    if (!ownedClass) {
      return NextResponse.json({ error: 'You do not teach this class' }, { status: 403 })
    }
  }

  const { data: questionSet } = await supabase
    .from('sms_gamev2_question_sets')
    .select('id, question_types')
    .eq('id', questionSetId)
    .maybeSingle()

  if (!questionSet) {
    return NextResponse.json({ error: 'Question set not found' }, { status: 404 })
  }

  const compatible = checkEngineCompatibility([engine], questionSet.question_types)[0]
  if (!compatible.compatible) {
    return NextResponse.json(
      { error: `${engine.name} does not support: ${compatible.unsupportedTypes.join(', ')}` },
      { status: 409 }
    )
  }

  const { data: questions } = await supabase.from('sms_gamev2_questions').select('id').eq('question_set_id', questionSetId)
  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: 'This question set has no questions' }, { status: 409 })
  }

  const hostTeacherId = isAdmin ? teacher?.id : teacher!.id
  if (!hostTeacherId) {
    return NextResponse.json({ error: 'An admin hosting live sessions needs a teacher record -- ask an admin to link one' }, { status: 400 })
  }

  const { data: liveSession, error } = await supabase
    .from('sms_gamev2_live_sessions')
    .insert([
      {
        host_teacher_id: hostTeacherId,
        class_id: classId,
        question_set_id: questionSetId,
        engine_id: engineId,
        status: 'LOBBY',
      },
    ])
    .select('id, join_code')
    .single()

  if (error || !liveSession) {
    return NextResponse.json({ error: error?.message || 'Failed to host live session' }, { status: 400 })
  }

  return NextResponse.json({ liveSessionId: liveSession.id, joinCode: liveSession.join_code }, { status: 201 })
}
