import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { withoutRepeats } from '../sameQuestion'
import { compareTopics } from '../topicOrder'
import { shuffle } from '../shuffle'
import { NO_TOPIC, pickEvenly, topicsTitle, type TopicPlay, type TopicSummary } from '../topicPlay'
import { QUESTION_KIND_FOR_GAME, type GameType, type Question } from '../types'
import { QUESTION_COLUMNS, rowToQuestion, type QuestionRow } from './db'
import { GrcError } from './studentAssignments'

// "Play by topic" on the server. Teachers read the library through their
// own client (RLS: every teacher can read it, migration 099); students
// through the service-role client -- they only ever get the topic list
// and, later, answer-free questions (see lib/grClassic/play.ts).

const GAME_FOR_KIND: Record<QuestionRow['kind'], GameType> = { choice: 'quiz', match: 'match', order: 'word-builder' }

// Supabase returns at most 1000 rows per request, so a whole library (many
// thousands of questions) is read in pages of 1000, all at once. Only the
// small columns asked for are read. Up to 100 000 rows.
const PAGE = 1000
// The few query-builder methods a filter uses (Supabase's own types are too
// deep to pass around generically).
interface Query {
  eq(column: string, value: unknown): Query
  is(column: string, value: null): Query
  in(column: string, values: readonly unknown[]): Query
  or(filters: string): Query
}
type Filter = (q: Query) => Query
type Page = PromiseLike<{ data: unknown[] | null; error: { message: string } | null; count?: number | null }>

async function allRows<T>(client: SupabaseClient, columns: string, filter: Filter): Promise<T[]> {
  const counted = filter(client.from('sms_grc_questions').select('id', { count: 'exact', head: true }).is('archived_at', null) as unknown as Query) as unknown as Page
  const { count, error } = await counted
  if (error) throw error
  const pages = Math.min(Math.ceil((count ?? 0) / PAGE), 100)
  const results = await Promise.all(
    Array.from({ length: pages }, (_, p) => {
      const q = filter(client.from('sms_grc_questions').select(columns).is('archived_at', null) as unknown as Query) as unknown as { order(c: string): { range(a: number, b: number): Page } }
      return q.order('id').range(p * PAGE, p * PAGE + PAGE - 1)
    })
  )
  const rows: T[] = []
  for (const r of results) {
    if (r.error) throw r.error
    rows.push(...((r.data ?? []) as T[]))
  }
  return rows
}

// How many questions per topic and kind: counted in the database by the
// sms_grc_topic_counts view (migration 103, about 40 rows), or -- until
// that is applied -- by reading every question's topic and kind.
async function topicKindCounts(client: SupabaseClient): Promise<{ category_id: string | null; kind: QuestionRow['kind']; questions: number }[]> {
  const { data, error } = await client.from('sms_grc_topic_counts').select('category_id, kind, questions')
  if (!error && data) return data as { category_id: string | null; kind: QuestionRow['kind']; questions: number }[]
  const rows = await allRows<{ kind: QuestionRow['kind']; category_id: string | null }>(client, 'kind, category_id', (q) => q)
  return rows.map((r) => ({ ...r, questions: 1 }))
}

// Every topic that has questions, with how many of each game type. Topic
// names and counts aren't private: callers pass the server's own client so
// the count doesn't run a permission check for every one of the (tens of
// thousands of) questions.
export async function topicCatalog(client: SupabaseClient): Promise<TopicSummary[]> {
  const [rows, { data: cats }] = await Promise.all([topicKindCounts(client), client.from('sms_grc_categories').select('id, name')])
  const names = new Map(((cats ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]))

  const byTopic = new Map<string, TopicSummary>()
  for (const r of rows) {
    const id = r.category_id && names.has(r.category_id) ? r.category_id : NO_TOPIC
    let t = byTopic.get(id)
    if (!t) byTopic.set(id, (t = { id, name: id === NO_TOPIC ? 'Other questions' : names.get(id)!, counts: { quiz: 0, match: 0, 'word-builder': 0 } }))
    t.counts[GAME_FOR_KIND[r.kind]] += r.questions
  }
  // Teaching order (topicOrder.ts); questions without a topic last.
  return Array.from(byTopic.values()).sort((a, b) => Number(a.id === NO_TOPIC) - Number(b.id === NO_TOPIC) || compareTopics(a.name, b.name))
}

// Up to `count` random questions of the chosen game type, taken evenly
// from the chosen topics, never the same question twice (sameQuestion.ts,
// across topics too). The title names the topics ("A + B"). Every matching
// question is a candidate.
export async function pickTopicQuestions(client: SupabaseClient, play: TopicPlay): Promise<{ title: string; questions: Question[] }> {
  const kind = QUESTION_KIND_FOR_GAME[play.type]
  const ids = play.topics.filter((t) => t !== NO_TOPIC)
  const withNone = play.topics.includes(NO_TOPIC)
  // Ids are checked UUIDs (parseTopicPlay), so they are safe in the filter.
  const filter: Filter = (q) => {
    const k = q.eq('kind', kind)
    if (withNone && ids.length) return k.or(`category_id.is.null,category_id.in.(${ids.join(',')})`)
    return withNone ? k.is('category_id', null) : k.in('category_id', ids)
  }
  const [rows, { data: cats }] = await Promise.all([
    allRows<QuestionRow>(client, QUESTION_COLUMNS, filter),
    ids.length ? client.from('sms_grc_categories').select('id, name').in('id', ids) : Promise.resolve({ data: [] }),
  ])
  if (!rows.length) throw new GrcError(play.topics.length > 1 ? 'These topics have no questions for that game type yet.' : 'This topic has no questions for that game type yet.', 404)
  const names = new Map(((cats ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]))
  const title = topicsTitle(play.topics.map((t) => (t === NO_TOPIC ? 'Other questions' : (names.get(t) ?? 'Topic'))))

  // Repeats out first (a random one of each is kept), then an even draw.
  const candidates = withoutRepeats(shuffle(rows.map((r) => rowToQuestion(r, names))))
  const groups = play.topics.map((t) => candidates.filter((q) => (q.categoryId ?? NO_TOPIC) === t))
  return { title, questions: pickEvenly(groups, play.count) }
}

// One library question (not archived), for checking a topic-practice answer.
export async function libraryQuestion(admin: SupabaseClient, id: string): Promise<Question> {
  const { data } = await admin.from('sms_grc_questions').select(QUESTION_COLUMNS).eq('id', id).is('archived_at', null).maybeSingle()
  if (!data) throw new GrcError('Question not found.', 404)
  return rowToQuestion(data as QuestionRow, new Map())
}
