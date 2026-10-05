import 'server-only'
import { hostableClasses, teacherIdForProfile } from '@/lib/gameRoomV2/liveClassroom/hostableClasses'
import { launchableEngines, playableEnginesForSet, type GameMode } from '@/lib/gameRoomV2/gameAvailability'
import { allTopicSummaries, CATEGORY_LABELS } from '@/lib/gameRoomV2/builtin/summaries'
import { isBuiltinSetId } from '@/lib/gameRoomV2/builtin/catalog'
import type { GameRoomQuestionType } from '@/lib/gameRoomV2/domain'
import type { createClient } from '@/lib/supabase/server'
import type { LauncherClass, LauncherGame, LauncherProps, LauncherTopic, MyQuestionSet } from '@/components/gameRoomV2/launcher/types'

// Everything the one-screen GameRoom home needs: every topic (teacher-made
// sets first, then the built-in Tamil topics) with the games that can play
// it, and for teachers their own sets and the classes they can host for.
// Students get games they can play alone; teachers get games that run as
// a live class game. Metadata only.

type Supabase = ReturnType<typeof createClient>

interface SetRow {
  id: string
  title: string
  tamil_title: string | null
  question_count: number
  question_types: GameRoomQuestionType[] | null
  created_by: string
  class_id: string | null
}

function customTopic(s: SetRow, group: string, mode: GameMode): LauncherTopic {
  return {
    key: `set:${s.id}`,
    title: s.title,
    tamilTitle: s.tamil_title && s.tamil_title !== s.title ? s.tamil_title : null,
    group,
    custom: true,
    games: playableEnginesForSet(s.question_types ?? [], mode).map((e) => ({ engineId: e.id, setId: s.id, questionCount: s.question_count })),
  }
}

function builtinTopics(mode: GameMode): LauncherTopic[] {
  return allTopicSummaries().map((t) => ({
    key: t.key,
    title: t.englishTitle,
    tamilTitle: t.tamilTitle,
    group: CATEGORY_LABELS[t.category],
    custom: false,
    games: t.engines.filter((e) => mode === 'solo' || e.live).map((e) => ({ engineId: e.engineId, setId: e.setId, questionCount: e.questionCount })),
  }))
}

function launcherGames(mode: GameMode): LauncherGame[] {
  return launchableEngines(mode).map((e) => ({
    id: e.id,
    name: e.name,
    tamilName: e.tamilName ?? null,
    description: e.description,
    kids: e.recommendedLevel === 'mazhalai',
  }))
}

const SET_COLUMNS = 'id, title, tamil_title, question_count, question_types, created_by, class_id'

export async function buildStudentLauncher(supabase: Supabase, studentId: string | null, firstName: string): Promise<LauncherProps> {
  // Sets teachers published for independent play: published, non-empty,
  // and either for no class or for one of the student's active classes.
  let teacherTopics: LauncherTopic[] = []
  if (studentId) {
    const [{ data: sets }, { data: enrollments }] = await Promise.all([
      supabase.from('sms_gamev2_question_sets').select(SET_COLUMNS).eq('published', true).gt('question_count', 0).order('updated_at', { ascending: false }).limit(150),
      supabase.from('sms_class_enrollments').select('class_id').eq('student_id', studentId).eq('status', 'active'),
    ])
    const myClassIds = new Set((enrollments ?? []).map((e) => e.class_id))
    teacherTopics = ((sets ?? []) as SetRow[])
      .filter((s) => !isBuiltinSetId(s.id) && (s.class_id === null || myClassIds.has(s.class_id)))
      .map((s) => customTopic(s, 'From your teacher', 'solo'))
  }
  return {
    role: 'student',
    firstName,
    topics: [...teacherTopics, ...builtinTopics('solo')].filter((t) => t.games.length > 0),
    games: launcherGames('solo'),
    classes: [],
    mySets: [],
  }
}

export async function buildTeacherLauncher(supabase: Supabase, userId: string, isAdmin: boolean, firstName: string): Promise<LauncherProps> {
  // RLS scopes this to the teacher's own sets plus sets shared with them.
  const { data: rows } = await supabase.from('sms_gamev2_question_sets').select(SET_COLUMNS).order('updated_at', { ascending: false }).limit(500)
  const sets = ((rows ?? []) as SetRow[]).filter((s) => !isBuiltinSetId(s.id))
  const mine = sets.filter((s) => s.created_by === userId)
  const shared = sets.filter((s) => s.created_by !== userId && s.question_count > 0)

  // Classes they can host for (primary or co-teacher; every class for an admin).
  const teacherId = isAdmin ? null : await teacherIdForProfile(userId)
  const classes: LauncherClass[] = (await hostableClasses(teacherId, isAdmin)).map((c) => ({ id: c.id, name: c.name, gradeLevel: c.grade_level }))

  const mySets: MyQuestionSet[] = mine.map((s) => ({ id: s.id, title: s.title, tamilTitle: s.tamil_title, questionCount: s.question_count }))
  const topics = [
    ...mine.filter((s) => s.question_count > 0).map((s) => customTopic(s, 'My questions', 'live')),
    ...shared.map((s) => customTopic(s, 'Shared by teachers', 'live')),
    ...builtinTopics('live'),
  ].filter((t) => t.games.length > 0)

  return { role: 'teacher', firstName, topics, games: launcherGames('live'), classes, mySets }
}
