import { NextResponse } from 'next/server'
import { requireGameV2Teacher } from '@/lib/gameRoomV2/requireTeacherAccess'
import { requireString } from '@/lib/validation'
import { getGameEngineV2 } from '@/lib/gameRoomV2/registry'
import { checkGameLaunch, isEngineLaunchable } from '@/lib/gameRoomV2/gameAvailability'
import { parseQuestionCount, parseTimeLimit } from '@/lib/gameRoomV2/gameOptions'

// POST /api/gameroom-v2/live/host -- the teacher flow's final step:
// "Select Question Set -> Select compatible Game -> Host Live -> Receive
// join code". Body: { questionSetId, engineId, classId, questionCount?,
// timeLimitSeconds? }. Validates the same engine/question-set compatibility
// sessions/start/route.ts already enforces for solo play, PLUS that the
// caller actually teaches classId (a teacher can't host a live session
// "for" a class they don't own -- the concrete mechanism behind
// sms_gamev2_live_sessions.class_id being the join-authorization
// anchor every student's /join call checks against).
//
// questionCount (optional, migration 081) is the "configurable
// question count" a teacher can set -- e.g. race the first 10
// questions of a 30-question set for a quick sprint. Validated against
// the set's actual question count here so a teacher never asks for
// more than exists; NULL/omitted means use every question, unchanged
// from prior behavior. Applied when the host later clicks Start (see
// start/route.ts), not here, since question_order itself is still only
// generated at start.
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
  if (!isEngineLaunchable(engine)) {
    return NextResponse.json({ error: `${engine.name} is not playable yet (${engine.status})` }, { status: 409 })
  }
  if (!engine.compatibility.liveClassroomSupport) {
    return NextResponse.json({ error: `${engine.name} does not support Live Classroom yet` }, { status: 409 })
  }

  // A teacher can only host for a class they actually teach. Uses the
  // canonical sms_teacher_owns_class() (sms_class_teachers, so
  // co-teachers count) -- the SAME check migration 083's INSERT policy
  // enforces at the database layer; this route-level copy just turns a
  // violation into a clear 403 instead of a generic insert failure.
  if (!isAdmin) {
    const { data: owns } = await supabase.rpc('sms_teacher_owns_class', { p_class_id: classId })
    if (!owns) {
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

  // The same rule every picker displays (lib/gameRoomV2/gameAvailability.ts).
  const launch = checkGameLaunch(engine.id, questionSet.question_types ?? [], 'live')
  if (!launch.ok) {
    return NextResponse.json({ error: launch.error }, { status: launch.status })
  }

  const { data: questions } = await supabase.from('sms_gamev2_questions').select('id').eq('question_set_id', questionSetId)
  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: 'This question set has no questions' }, { status: 409 })
  }

  const count = parseQuestionCount(body.questionCount, questions.length)
  if (!count.ok) return NextResponse.json({ error: count.error }, { status: 400 })
  const questionCount = count.value

  // Time per question (lib/gameRoomV2/gameOptions.ts). Stored on the live
  // session; migration 093 copies it onto every student's own session.
  const timeLimit = parseTimeLimit(body.timeLimitSeconds)
  if (!timeLimit.ok) return NextResponse.json({ error: timeLimit.error }, { status: 400 })

  // Racing needs one shared difficulty for every racer (see migration
  // 081) -- meaningless for every other engine, so only validated/
  // applied when hosting a racing session; any other engine's request
  // simply ignores raceDifficulty and the column keeps its default.
  let raceDifficulty = 'normal'
  if (engineId === 'racing' && typeof body.raceDifficulty === 'string') {
    if (!['easy', 'normal', 'hard'].includes(body.raceDifficulty)) {
      return NextResponse.json({ error: 'Invalid race difficulty' }, { status: 400 })
    }
    raceDifficulty = body.raceDifficulty
  }

  // Boss Battle needs one shared boss + difficulty for the whole class
  // to cooperatively fight (see migration 082) -- meaningless for every
  // other engine.
  // Since the real-time rebuild each student fights their own arena; the
  // shared boss row only drives the teacher's class-progress meter, so it
  // is optional and defaults rather than being another setup screen.
  let bossId: string | null = null
  let bossDifficulty = 'normal'
  if (engineId === 'boss-battle') {
    bossId = 'suran'
    if (body.bossId !== undefined && body.bossId !== null) {
      if (typeof body.bossId !== 'string' || !['suran', 'kotravai-guardian', 'naga-serpent'].includes(body.bossId)) {
        return NextResponse.json({ error: 'A valid boss must be selected' }, { status: 400 })
      }
      bossId = body.bossId
    }
    if (typeof body.bossDifficulty === 'string') {
      if (!['easy', 'normal', 'hard'].includes(body.bossDifficulty)) {
        return NextResponse.json({ error: 'Invalid boss battle difficulty' }, { status: 400 })
      }
      bossDifficulty = body.bossDifficulty
    }
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
        question_count: questionCount,
        question_time_limit_seconds: timeLimit.value,
        race_difficulty: raceDifficulty,
        boss_id: bossId,
        boss_difficulty: bossDifficulty,
        status: 'LOBBY',
      },
    ])
    .select('id, join_code')
    .single()

  if (error || !liveSession) {
    return NextResponse.json({ error: 'Failed to host live session' }, { status: 400 })
  }

  return NextResponse.json({ liveSessionId: liveSession.id, joinCode: liveSession.join_code }, { status: 201 })
}
