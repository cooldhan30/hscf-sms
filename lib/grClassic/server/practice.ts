import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Game, GameType, PracticeGame } from '../types'
import { getGame } from './db'
import { GrcError } from './studentAssignments'

// Self-practice. Students have no direct access to sms_grc_* tables, so
// these use the service-role client, scoped explicitly: a student may
// practise a game only if it was made by a teacher of a class they are
// actively enrolled in, practice is switched on, and it isn't archived.

// Profile ids of the teachers who teach this student's current classes.
async function myTeachers(admin: SupabaseClient, studentId: string): Promise<Map<string, string>> {
  const { data: enrolments } = await admin.from('sms_class_enrollments').select('class_id').eq('student_id', studentId).eq('status', 'active')
  const classIds = ((enrolments ?? []) as { class_id: string }[]).map((e) => e.class_id)
  if (!classIds.length) return new Map()
  const { data } = await admin.from('sms_class_teachers').select('teacher:sms_teachers(profile_id, profile:sms_profiles(first_name, last_name))').in('class_id', classIds)
  const out = new Map<string, string>()
  for (const row of (data ?? []) as unknown as { teacher: { profile_id: string; profile: { first_name: string; last_name: string } | null } | null }[]) {
    if (row.teacher?.profile_id) out.set(row.teacher.profile_id, row.teacher.profile ? `${row.teacher.profile.first_name} ${row.teacher.profile.last_name}`.trim() : 'Teacher')
  }
  return out
}

export async function practiceGames(admin: SupabaseClient, studentId: string): Promise<PracticeGame[]> {
  const teachers = await myTeachers(admin, studentId)
  if (!teachers.size) return []
  const { data: games } = await admin
    .from('sms_grc_games')
    .select('id, title, game_type, owner_id, updated_at, sms_grc_game_questions(count)')
    .in('owner_id', Array.from(teachers.keys()))
    .eq('practice', true)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(200)
  const rows = (games ?? []) as { id: string; title: string; game_type: GameType; owner_id: string; sms_grc_game_questions: { count: number }[] }[]
  if (!rows.length) return []
  const { data: progress } = await admin.from('sms_grc_practice_progress').select('game_id, best_percent, plays').eq('student_id', studentId).in('game_id', rows.map((g) => g.id))
  const mine = new Map(((progress ?? []) as { game_id: string; best_percent: number; plays: number }[]).map((p) => [p.game_id, p]))
  return rows
    .map((g) => ({
      id: g.id,
      title: g.title,
      type: g.game_type,
      questionCount: g.sms_grc_game_questions?.[0]?.count ?? 0,
      teacher: teachers.get(g.owner_id) ?? 'Teacher',
      bestPercent: mine.get(g.id)?.best_percent ?? null,
      plays: mine.get(g.id)?.plays ?? 0,
    }))
    .filter((g) => g.questionCount > 0)
}

// The full game (with answers) -- for checking on the server only.
export async function practiceGame(admin: SupabaseClient, studentId: string, gameId: string): Promise<Game> {
  const { data } = await admin.from('sms_grc_games').select('owner_id, practice, archived_at').eq('id', gameId).maybeSingle()
  const meta = data as { owner_id: string; practice: boolean; archived_at: string | null } | null
  if (!meta || !meta.practice || meta.archived_at) throw new GrcError('This game isn’t available for practice.', 404)
  const teachers = await myTeachers(admin, studentId)
  if (!teachers.has(meta.owner_id)) throw new GrcError('This game isn’t available for practice.', 404)
  const game = await getGame(admin, gameId, new Map())
  if (!game || !game.questions.length) throw new GrcError('This game isn’t available for practice.', 404)
  return game
}

// Practice progress: plays, best and latest score. Encouragement only --
// never a grade -- so the browser's own count of right answers is used.
export async function recordPractice(admin: SupabaseClient, studentId: string, gameId: string, percent: number): Promise<{ bestPercent: number; plays: number }> {
  const p = Math.max(0, Math.min(100, Math.round(percent)))
  const { data } = await admin.from('sms_grc_practice_progress').select('best_percent, plays').eq('student_id', studentId).eq('game_id', gameId).maybeSingle()
  const prev = data as { best_percent: number; plays: number } | null
  const next = { best_percent: Math.max(prev?.best_percent ?? 0, p), plays: (prev?.plays ?? 0) + 1 }
  const { error } = await admin.from('sms_grc_practice_progress').upsert({ student_id: studentId, game_id: gameId, ...next, last_percent: p, last_played_at: new Date().toISOString() })
  if (error) throw error
  return { bestPercent: next.best_percent, plays: next.plays }
}
