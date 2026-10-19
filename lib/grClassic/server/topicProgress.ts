import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NO_TOPIC, mergeTopicScores, tallyByTopic, type GameTally, type OfflineTopicRow, type PlayedQuestion, type TopicScore } from '../topicPlay'

// Scores per topic for the student dashboard: Play Offline (migration 101,
// sms_grc_topic_progress), live games and assignments.
// Service-role client, always scoped to the signed-in student. Practice
// only -- encouragement, never a grade -- so the browser's own count of
// right answers is used (as for practice games).

interface Row {
  topic_key: string
  plays: number
  answered: number
  correct: number
  best_percent: number
  last_percent: number
  last_played_at: string
}

// Adds a finished game to the student's per-topic scores.
export async function recordTopicPlay(admin: SupabaseClient, studentId: string, played: PlayedQuestion[]): Promise<void> {
  const ids = Array.from(new Set(played.map((p) => p.questionId)))
  const { data: qs } = await admin.from('sms_grc_questions').select('id, category_id').in('id', ids)
  const topicOf = new Map(((qs ?? []) as { id: string; category_id: string | null }[]).map((q) => [q.id, q.category_id]))
  const tallies = tallyByTopic(played, topicOf)
  if (!tallies.length) return
  const { data: prev, error: readError } = await admin.from('sms_grc_topic_progress').select('topic_key, plays, answered, correct, best_percent, last_percent, last_played_at').eq('student_id', studentId).in('topic_key', tallies.map((t) => t.topic))
  if (readError) throw readError
  const before = new Map(((prev ?? []) as Row[]).map((r) => [r.topic_key, r]))
  const now = new Date().toISOString()
  const rows = tallies.map((t) => {
    const p = before.get(t.topic)
    return {
      student_id: studentId,
      topic_key: t.topic,
      plays: (p?.plays ?? 0) + 1,
      answered: (p?.answered ?? 0) + t.answered,
      correct: (p?.correct ?? 0) + t.correct,
      best_percent: Math.max(p?.best_percent ?? 0, t.percent),
      last_percent: t.percent,
      last_played_at: now,
    }
  })
  const { error } = await admin.from('sms_grc_topic_progress').upsert(rows)
  if (error) throw error
}

// The student's dashboard: every topic they have played -- in Play Offline,
// live games and (submitted) assignments -- most recent first. Each answer
// counts towards its question's topic in the library. Play Offline rows
// are skipped (not an error) if migration 101 isn't applied yet.
export async function topicScores(admin: SupabaseClient, studentId: string): Promise<TopicScore[]> {
  const [{ data: off }, { data: live }, { data: attempts }] = await Promise.all([
    admin.from('sms_grc_topic_progress').select('topic_key, plays, answered, correct, best_percent, last_percent, last_played_at').eq('student_id', studentId),
    admin.from('sms_grc_live_answers').select('session_id, question_id, correct_units, total_units, answered_at').eq('student_id', studentId).order('answered_at', { ascending: false }).limit(5000),
    admin.from('sms_grc_attempts').select('id, submitted_at').eq('student_id', studentId).eq('status', 'submitted').order('submitted_at', { ascending: false }).limit(500),
  ])
  const offline: OfflineTopicRow[] = ((off ?? []) as Row[]).map((r) => ({ topic: r.topic_key, plays: r.plays, answered: r.answered, correct: r.correct, bestPercent: r.best_percent, lastPercent: r.last_percent, lastPlayedAt: r.last_played_at }))

  type Answer = { question_id: string; correct_units: number; total_units: number }
  const liveRows = (live ?? []) as (Answer & { session_id: string; answered_at: string })[]
  const tries = (attempts ?? []) as { id: string; submitted_at: string }[]
  const responses: (Answer & { attempt_id: string })[] = []
  for (let i = 0; i < tries.length; i += 100) {
    const { data } = await admin.from('sms_grc_responses').select('attempt_id, question_id, correct_units, total_units').in('attempt_id', tries.slice(i, i + 100).map((t) => t.id)).limit(5000)
    responses.push(...((data ?? []) as (Answer & { attempt_id: string })[]))
  }

  // Each question's topic, from the library (archived questions included).
  const qids = Array.from(new Set([...liveRows, ...responses].map((r) => r.question_id)))
  const topicOf = new Map<string, string | null>()
  for (let i = 0; i < qids.length; i += 200) {
    const { data } = await admin.from('sms_grc_questions').select('id, category_id').in('id', qids.slice(i, i + 200))
    for (const q of (data ?? []) as { id: string; category_id: string | null }[]) topicOf.set(q.id, q.category_id)
  }
  const played = (rows: Answer[]): PlayedQuestion[] => rows.filter((r) => r.total_units > 0).map((r) => ({ questionId: r.question_id, correct: r.correct_units, total: r.total_units }))

  const games: GameTally[] = []
  const bySession = new Map<string, typeof liveRows>()
  for (const r of liveRows) bySession.set(r.session_id, [...(bySession.get(r.session_id) ?? []), r])
  for (const rows of Array.from(bySession.values())) games.push({ source: 'live', at: rows.reduce((m, r) => (Date.parse(r.answered_at) > Date.parse(m) ? r.answered_at : m), rows[0].answered_at), tallies: tallyByTopic(played(rows), topicOf) })
  for (const t of tries) games.push({ source: 'assignment', at: t.submitted_at, tallies: tallyByTopic(played(responses.filter((r) => r.attempt_id === t.id)), topicOf) })

  const topicIds = new Set<string>([...offline.map((r) => r.topic), ...games.flatMap((g) => g.tallies.map((t) => t.topic))])
  topicIds.delete(NO_TOPIC)
  const { data: cats } = topicIds.size ? await admin.from('sms_grc_categories').select('id, name').in('id', Array.from(topicIds)) : { data: [] }
  const names = new Map(((cats ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]))
  return mergeTopicScores(offline, games, (topic) => (topic === NO_TOPIC ? 'Other questions' : (names.get(topic) ?? 'A removed topic')))
}
