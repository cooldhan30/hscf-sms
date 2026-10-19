import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NO_TOPIC, tallyByTopic, type PlayedQuestion, type TopicScore } from '../topicPlay'

// Play Offline scores per topic (migration 101, sms_grc_topic_progress).
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

// The student's dashboard: every topic they have played, most recent first.
// Empty (not an error) if the table isn't there yet (migration 101).
export async function topicScores(admin: SupabaseClient, studentId: string): Promise<TopicScore[]> {
  const { data, error } = await admin.from('sms_grc_topic_progress').select('topic_key, plays, answered, correct, best_percent, last_percent, last_played_at').eq('student_id', studentId).order('last_played_at', { ascending: false })
  if (error || !data?.length) return []
  const rows = data as Row[]
  const ids = rows.map((r) => r.topic_key).filter((k) => k !== NO_TOPIC)
  const { data: cats } = ids.length ? await admin.from('sms_grc_categories').select('id, name').in('id', ids) : { data: [] }
  const names = new Map(((cats ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]))
  return rows.map((r) => ({
    topic: r.topic_key,
    name: r.topic_key === NO_TOPIC ? 'Other questions' : (names.get(r.topic_key) ?? 'A removed topic'),
    plays: r.plays,
    answered: r.answered,
    correct: r.correct,
    bestPercent: r.best_percent,
    lastPercent: r.last_percent,
    lastPlayedAt: r.last_played_at,
  }))
}
