import { NextResponse } from 'next/server'
import { requireGameV2Teacher } from '@/lib/gameRoomV2/requireTeacherAccess'
import { createAdminClient } from '@/lib/supabase/admin'
import { launchableEngines, gameAvailability } from '@/lib/gameRoomV2/gameAvailability'
import { isBuiltinSetId } from '@/lib/gameRoomV2/builtin/catalog'

// GET /api/gameroom-v2/live/host-options -- everything the one-screen
// Host Live page needs in a single call: the question sets this teacher
// may host (their own, shared, built-in -- exactly what RLS lets them
// read), the classes they teach (primary OR co-teacher, matching the
// host route's sms_teacher_owns_class() authorization), and every
// active game with its compatibility per set. Metadata only: no
// question, payload or answer ever leaves here.
export async function GET() {
  const guard = await requireGameV2Teacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, teacher, isAdmin, profile } = guard

  const { data: sets } = await supabase
    .from('sms_gamev2_question_sets')
    .select('id, title, tamil_title, topic, difficulty, question_count, question_types, created_by, updated_at')
    .gt('question_count', 0)
    .order('updated_at', { ascending: false })
    .limit(500)

  let classes: { id: string; name: string; grade_level: string | null }[] = []
  if (isAdmin) {
    const { data } = await supabase.from('sms_classes').select('id, name, grade_level').order('name')
    classes = data ?? []
  } else if (teacher) {
    const admin = createAdminClient()
    const [{ data: primary }, { data: assigned }] = await Promise.all([
      admin.from('sms_classes').select('id').eq('teacher_id', teacher.id),
      admin.from('sms_class_teachers').select('class_id').eq('teacher_id', teacher.id),
    ])
    const ids = Array.from(new Set([...(primary ?? []).map((c) => c.id as string), ...(assigned ?? []).map((c) => c.class_id as string)]))
    if (ids.length) {
      const { data } = await admin.from('sms_classes').select('id, name, grade_level').in('id', ids).order('name')
      classes = data ?? []
    }
  }

  const games = launchableEngines('live')

  return NextResponse.json({
    games: games.map((g) => ({ id: g.id, name: g.name, tamilName: g.tamilName, description: g.description, supportedTypes: g.compatibility.supportedQuestionTypes, requirement: g.requirement?.en ?? null })),
    classes,
    sets: (sets ?? []).map((s) => {
      const compat = games.map((g) => gameAvailability(g, s.question_types ?? [], 'live'))
      return {
        id: s.id,
        title: s.title,
        tamilTitle: s.tamil_title,
        topic: s.topic,
        difficulty: s.difficulty,
        questionCount: s.question_count,
        questionTypes: s.question_types ?? [],
        source: isBuiltinSetId(s.id) ? 'builtin' : s.created_by === profile.id ? 'mine' : 'shared',
        games: compat.map((c) => ({ id: c.engine.id, compatible: c.playable, unsupportedTypes: c.unsupportedTypes, reason: c.reason?.en ?? null })),
      }
    }),
  })
}
