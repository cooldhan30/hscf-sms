import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { STARTER_CATEGORIES } from '../categories'
import { shuffle } from '../shuffle'
import { NO_TOPIC, type TopicPlay, type TopicSummary } from '../topicPlay'
import { QUESTION_KIND_FOR_GAME, type GameType, type Question } from '../types'
import { QUESTION_COLUMNS, rowToQuestion, type QuestionRow } from './db'
import { GrcError } from './studentAssignments'

// "Play by topic" on the server. Teachers read the library through their
// own client (RLS: every teacher can read it, migration 099); students
// through the service-role client -- they only ever get the topic list
// and, later, answer-free questions (see lib/grClassic/play.ts).

const GAME_FOR_KIND: Record<QuestionRow['kind'], GameType> = { choice: 'quiz', match: 'match', order: 'word-builder' }

// Every topic that has questions, with how many of each game type.
export async function topicCatalog(client: SupabaseClient): Promise<TopicSummary[]> {
  const rows: { kind: QuestionRow['kind']; category_id: string | null }[] = []
  for (let from = 0; from < 5000; from += 1000) {
    const { data } = await client.from('sms_grc_questions').select('kind, category_id').is('archived_at', null).order('id').range(from, from + 999)
    const page = (data ?? []) as typeof rows
    rows.push(...page)
    if (page.length < 1000) break
  }
  const { data: cats } = await client.from('sms_grc_categories').select('id, name')
  const names = new Map(((cats ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]))

  const byTopic = new Map<string, TopicSummary>()
  for (const r of rows) {
    const id = r.category_id && names.has(r.category_id) ? r.category_id : NO_TOPIC
    let t = byTopic.get(id)
    if (!t) byTopic.set(id, (t = { id, name: id === NO_TOPIC ? 'Other questions' : names.get(id)!, counts: { quiz: 0, match: 0, 'word-builder': 0 } }))
    t.counts[GAME_FOR_KIND[r.kind]]++
  }
  const order = (t: TopicSummary) => (t.id === NO_TOPIC ? 1e6 : STARTER_CATEGORIES.indexOf(t.name) === -1 ? 1e3 : STARTER_CATEGORIES.indexOf(t.name))
  return Array.from(byTopic.values()).sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name))
}

// Up to `count` random questions of the chosen topic and game type.
export async function pickTopicQuestions(client: SupabaseClient, play: TopicPlay): Promise<{ title: string; questions: Question[] }> {
  const kind = QUESTION_KIND_FOR_GAME[play.type]
  let query = client.from('sms_grc_questions').select(QUESTION_COLUMNS).eq('kind', kind).is('archived_at', null).limit(1000)
  query = play.topic === NO_TOPIC ? query.is('category_id', null) : query.eq('category_id', play.topic)
  const { data } = await query
  const rows = (data ?? []) as QuestionRow[]
  if (!rows.length) throw new GrcError('This topic has no questions for that game type yet.', 404)
  let title = 'Other questions'
  if (play.topic !== NO_TOPIC) {
    const { data: cat } = await client.from('sms_grc_categories').select('name').eq('id', play.topic).maybeSingle()
    title = (cat as { name: string } | null)?.name ?? 'Topic game'
  }
  const names = new Map(play.topic === NO_TOPIC ? [] : [[play.topic, title]])
  return { title, questions: shuffle(rows).slice(0, play.count).map((r) => rowToQuestion(r, names)) }
}

// One library question (not archived), for checking a topic-practice answer.
export async function libraryQuestion(admin: SupabaseClient, id: string): Promise<Question> {
  const { data } = await admin.from('sms_grc_questions').select(QUESTION_COLUMNS).eq('id', id).is('archived_at', null).maybeSingle()
  if (!data) throw new GrcError('Question not found.', 404)
  return rowToQuestion(data as QuestionRow, new Map())
}
