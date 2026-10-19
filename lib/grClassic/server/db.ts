import 'server-only'
import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Category, Difficulty, Game, GameSummary, GameType, Question } from '../types'
import { repeatsIn, withoutRepeats } from '../sameQuestion'
import { compareTopics } from '../topicOrder'
import type { ValidQuestion } from '../validateQuestion'

// Reads and writes for the GameRoom Classic question library. Every call
// takes the caller's RLS-scoped client, so a teacher only ever reaches
// their own rows (plus the shared starter topics).

export const QUESTION_COLUMNS = 'id, owner_id, kind, category_id, prompt, prompt_en, payload, explanation, difficulty'

export interface QuestionRow {
  id: string
  owner_id: string
  kind: 'choice' | 'match' | 'order'
  category_id: string | null
  prompt: string
  prompt_en: string | null
  payload: Record<string, unknown>
  explanation: string | null
  difficulty: Difficulty
}

export function contentHash(contentKey: string): string {
  return createHash('sha256').update(contentKey, 'utf8').digest('hex')
}

export function questionRow(ownerId: string, q: ValidQuestion) {
  return {
    owner_id: ownerId,
    kind: q.kind,
    category_id: q.categoryId,
    prompt: q.prompt,
    prompt_en: q.promptEn,
    payload: q.payload,
    explanation: q.explanation,
    difficulty: q.difficulty,
    content_key: contentHash(q.contentKey),
  }
}

export async function listCategories(supabase: SupabaseClient, userId: string): Promise<Category[]> {
  const { data } = await supabase.from('sms_grc_categories').select('id, name, owner_id')
  const rows = (data ?? []) as { id: string; name: string; owner_id: string | null }[]
  // Teaching order (topicOrder.ts), the same everywhere topics are listed.
  return rows.map((r) => ({ id: r.id, name: r.name, own: r.owner_id === userId })).sort((a, b) => compareTopics(a.name, b.name))
}

export function categoryNames(categories: Category[]): Map<string, string> {
  return new Map(categories.map((c) => [c.id, c.name]))
}

// `who` (optional): the signed-in teacher and author names, for the shared library.
export function rowToQuestion(row: QuestionRow, names: Map<string, string>, who?: { userId: string; authors?: Map<string, string> }): Question {
  const base = {
    id: row.id,
    ...(who ? { mine: row.owner_id === who.userId, author: row.owner_id === who.userId ? 'You' : (who.authors?.get(row.owner_id) ?? 'Another teacher') } : {}),
    categoryId: row.category_id,
    category: row.category_id ? (names.get(row.category_id) ?? '') : '',
    prompt: row.prompt,
    promptEn: row.prompt_en ?? undefined,
    difficulty: row.difficulty,
  }
  const p = row.payload
  if (row.kind === 'choice') return { ...base, kind: 'choice', options: (p.options as string[]) ?? [], answerIndex: Number(p.answerIndex ?? 0), explanation: row.explanation ?? undefined }
  if (row.kind === 'match') return { ...base, kind: 'match', pairs: (p.pairs as { left: string; right: string }[]) ?? [] }
  return { ...base, kind: 'order', unit: p.unit === 'words' ? 'words' : 'letters', answer: String(p.answer ?? ''), hint: typeof p.hint === 'string' ? p.hint : undefined }
}

// The shared library: every teacher's questions (migration 099), newest first.
export async function listQuestions(supabase: SupabaseClient, names: Map<string, string>, userId: string): Promise<Question[]> {
  // Pages of 1000 (the most one Supabase request returns), up to 5000.
  const rows: QuestionRow[] = []
  for (let from = 0; from < 5000; from += 1000) {
    const { data } = await supabase.from('sms_grc_questions').select(QUESTION_COLUMNS).is('archived_at', null).order('updated_at', { ascending: false }).order('id').range(from, from + 999)
    const page = (data ?? []) as QuestionRow[]
    rows.push(...page)
    if (page.length < 1000) break
  }
  const authors = await teacherNames(supabase, Array.from(new Set(rows.map((r) => r.owner_id).filter((id) => id !== userId))))
  return rows.map((r) => rowToQuestion(r, names, { userId, authors }))
}

// ---- The Question Library page: one page at a time ----
// The library is far too big (tens of thousands of questions) to send to
// the browser at once. These read with the server's client: the library
// is readable by every teacher anyway, and it spares a permission check on
// every row. Callers must have checked that a teacher is asking.

export const LIBRARY_PAGE_SIZE = 50

export interface LibraryQuery {
  kind: Question['kind']
  topic: string // '' = all topics, 'none' = questions without a topic, or a topic id
  mine: boolean
  search: string
  offset: number
}

// Text a teacher typed, made safe for a PostgREST filter (no wildcards,
// quotes or separators).
export function cleanSearch(text: string): string {
  return text.normalize('NFC').replace(/[%_*,()"'\\:.]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}

export async function searchLibrary(admin: SupabaseClient, names: Map<string, string>, userId: string, q: LibraryQuery): Promise<{ questions: Question[]; total: number }> {
  let query = admin.from('sms_grc_questions').select(QUESTION_COLUMNS, { count: 'exact' }).eq('kind', q.kind).is('archived_at', null)
  if (q.topic === 'none') query = query.is('category_id', null)
  else if (q.topic) query = query.eq('category_id', q.topic)
  if (q.mine) query = query.eq('owner_id', userId)
  const s = cleanSearch(q.search)
  if (s) query = query.or(`prompt.ilike."%${s}%",prompt_en.ilike."%${s}%"`)
  const { data, count, error } = await query
    .order('updated_at', { ascending: false })
    .order('id')
    .range(q.offset, q.offset + LIBRARY_PAGE_SIZE - 1)
  if (error) throw error
  const rows = (data ?? []) as QuestionRow[]
  const authors = await teacherNames(admin, Array.from(new Set(rows.map((r) => r.owner_id).filter((id) => id !== userId))))
  return { questions: rows.map((r) => rowToQuestion(r, names, { userId, authors })), total: count ?? rows.length }
}

// How many questions of each kind (the library tabs).
export async function libraryKindCounts(admin: SupabaseClient): Promise<Record<Question['kind'], number>> {
  const kinds: Question['kind'][] = ['choice', 'match', 'order']
  const counts = await Promise.all(kinds.map((k) => admin.from('sms_grc_questions').select('id', { count: 'exact', head: true }).eq('kind', k).is('archived_at', null)))
  return { choice: counts[0].count ?? 0, match: counts[1].count ?? 0, order: counts[2].count ?? 0 }
}

// Teacher names (readable by any signed-in user: the portal teacher directory).
export async function teacherNames(supabase: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map()
  const { data } = await supabase.from('sms_profiles').select('id, first_name, last_name').in('id', ids)
  return new Map(((data ?? []) as { id: string; first_name: string; last_name: string }[]).map((p) => [p.id, `${p.first_name} ${p.last_name}`.trim()]))
}

interface GameRow {
  id: string
  title: string
  game_type: GameType
  category_id: string | null
  difficulty: Difficulty
  live_seconds: number
  updated_at: string
}

export async function listGames(supabase: SupabaseClient, names: Map<string, string>): Promise<GameSummary[]> {
  const { data } = await supabase
    .from('sms_grc_games')
    .select('id, title, game_type, category_id, updated_at, practice, sms_grc_game_questions(count)')
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
  return ((data ?? []) as (GameRow & { practice: boolean; sms_grc_game_questions: { count: number }[] })[]).map((g) => ({
    id: g.id,
    title: g.title,
    type: g.game_type,
    category: g.category_id ? (names.get(g.category_id) ?? '') : '',
    questionCount: g.sms_grc_game_questions?.[0]?.count ?? 0,
    updatedAt: g.updated_at,
    practice: g.practice !== false,
  }))
}

export async function getGame(supabase: SupabaseClient, id: string, names: Map<string, string>): Promise<Game | null> {
  const { data } = await supabase
    .from('sms_grc_games')
    .select(`id, title, game_type, category_id, difficulty, live_seconds, updated_at, sms_grc_game_questions(position, question:sms_grc_questions(${QUESTION_COLUMNS}))`)
    .eq('id', id)
    .is('archived_at', null)
    .maybeSingle()
  if (!data) return null
  const g = data as unknown as GameRow & { sms_grc_game_questions: { position: number; question: QuestionRow | null }[] }
  // A game never asks the same question twice (sameQuestion.ts): hosting,
  // assigning, practice and preview all load games through here.
  const questions = withoutRepeats(
    (g.sms_grc_game_questions ?? [])
      .filter((l) => l.question)
      .sort((a, b) => a.position - b.position)
      .map((l) => rowToQuestion(l.question!, names))
  )
  return {
    id: g.id,
    title: g.title,
    type: g.game_type,
    categoryId: g.category_id,
    category: g.category_id ? (names.get(g.category_id) ?? '') : '',
    difficulty: g.difficulty,
    liveSeconds: g.live_seconds,
    questions,
    updatedAt: g.updated_at,
  }
}

// Saving a game: a message if two of its questions are the same question
// (sameQuestion.ts), else null.
export async function repeatedQuestionMessage(supabase: SupabaseClient, ids: string[]): Promise<string | null> {
  const { data } = await supabase.from('sms_grc_questions').select(QUESTION_COLUMNS).in('id', ids)
  const byId = new Map(((data ?? []) as QuestionRow[]).map((r) => [r.id, rowToQuestion(r, new Map())]))
  const repeat = repeatsIn(ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])))[0]
  return repeat ? `“${repeat.prompt}” is in this game twice. Remove one of them and save again.` : null
}

// One question, only if it belongs to the given game (and RLS lets the
// caller see that game).
export async function getGameQuestion(supabase: SupabaseClient, gameId: string, questionId: string): Promise<Question | null> {
  const { data } = await supabase
    .from('sms_grc_game_questions')
    .select(`question:sms_grc_questions(${QUESTION_COLUMNS})`)
    .eq('game_id', gameId)
    .eq('question_id', questionId)
    .maybeSingle()
  const row = (data as unknown as { question: QuestionRow | null } | null)?.question
  return row ? rowToQuestion(row, new Map()) : null
}
