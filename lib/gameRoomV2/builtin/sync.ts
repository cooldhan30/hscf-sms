import type { SupabaseClient } from '@supabase/supabase-js'
import { detectLanguage } from '../domain'
import { BUILTIN_TOPICS, BUILTIN_SET_IDS, BUILTIN_CONTENT_VERSION } from './catalog'

// Syncs the code-defined built-in catalog into the ordinary
// sms_gamev2_question_sets / sms_gamev2_questions tables, using the
// service-role client (server-only callers: ensure.ts and
// scripts/sync-gameroom-v2-builtin.ts).
//
// Why this is safe without any new RLS:
//   - Built-in sets are owned by an ADMIN profile, PUBLIC, published and
//     class-less. Existing policies then already give exactly the access
//     the release needs: teachers may READ them ("teacher read shared")
//     but never write them ("teacher manage own" requires created_by =
//     caller); students may read their METADATA only ("student read
//     published", 085) and never their answer keys (083).
//   - The API additionally refuses edit/delete/assign of any built-in id
//     even for admins (question-sets/[id] routes), so canonical content is
//     read-only everywhere; teachers customise via Duplicate.
//
// Idempotent: deterministic ids + upsert. When BUILTIN_CONTENT_VERSION is
// already recorded on every set, the whole call is one small SELECT.

// Reserved tag prefix for system metadata. skillsForQuestionSet() drops
// these so they never surface as "skills", and Duplicate strips them.
export const SYSTEM_TAG_PREFIX = 'sys:'
export const BUILTIN_TAG = `${SYSTEM_TAG_PREFIX}builtin`
const versionTag = `${SYSTEM_TAG_PREFIX}builtin-v:${BUILTIN_CONTENT_VERSION}`

export type BuiltinSyncResult =
  | { status: 'up-to-date' }
  | { status: 'synced'; sets: number; questions: number; removedQuestions: number; retiredSets: number }
  | { status: 'skipped'; reason: string }

export async function isBuiltinContentCurrent(admin: SupabaseClient): Promise<boolean> {
  const { data, error } = await admin.from('sms_gamev2_question_sets').select('id, tags').in('id', BUILTIN_SET_IDS)
  if (error) throw error
  return (data ?? []).length === BUILTIN_SET_IDS.length && (data ?? []).every((row) => (row.tags as string[]).includes(versionTag))
}

export async function syncBuiltinContent(admin: SupabaseClient): Promise<BuiltinSyncResult> {
  if (await isBuiltinContentCurrent(admin)) return { status: 'up-to-date' }

  // Keep the existing owner if any built-in set already exists; otherwise
  // the earliest-created active admin owns the canonical content.
  const { data: existing } = await admin.from('sms_gamev2_question_sets').select('created_by').in('id', BUILTIN_SET_IDS).limit(1)
  let ownerId = existing?.[0]?.created_by as string | undefined
  if (!ownerId) {
    const { data: admins } = await admin
      .from('sms_profiles')
      .select('id')
      .eq('role', 'admin')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
    ownerId = admins?.[0]?.id
  }
  if (!ownerId) return { status: 'skipped', reason: 'No active admin profile to own built-in content' }

  const setRows = BUILTIN_TOPICS.flatMap((topic) =>
    topic.sets.map((set) => ({
      id: set.id,
      title: set.title,
      description: topic.description,
      tamil_title: topic.tamilTitle,
      english_title: topic.englishTitle,
      level: topic.level,
      subject: 'Tamil',
      topic: topic.tamilTitle,
      difficulty: topic.difficulty,
      estimated_duration_minutes: Math.max(2, Math.round(set.questions.length * 0.5)),
      tags: [BUILTIN_TAG, versionTag],
      visibility: 'PUBLIC',
      published: true,
      class_id: null,
      created_by: ownerId,
      language: detectLanguage([topic.tamilTitle, topic.englishTitle, ...set.questions.map((q) => q.prompt)]),
      question_types: set.questionTypes,
      question_count: set.questions.length,
    }))
  )

  const questionRows = BUILTIN_TOPICS.flatMap((topic) =>
    topic.sets.flatMap((set) =>
      set.questions.map((q, i) => ({
        id: set.questionIds[i],
        question_set_id: set.id,
        sort_order: i,
        question_type: q.questionType,
        prompt: q.prompt,
        payload: q.payload,
        explanation: q.explanation ?? null,
        media_url: null,
        points: 100,
        concept_tags: [topic.tamilTitle],
      }))
    )
  )

  // Sets first (questions FK them), then questions in modest batches.
  const { error: setError } = await admin.from('sms_gamev2_question_sets').upsert(setRows, { onConflict: 'id' })
  if (setError) throw setError

  for (let i = 0; i < questionRows.length; i += 200) {
    const { error } = await admin.from('sms_gamev2_questions').upsert(questionRows.slice(i, i + 200), { onConflict: 'id' })
    if (error) throw error
  }

  // Questions that were edited/removed in code get a new id / no id, so
  // their old rows are removed. (Only ever touches built-in sets.)
  const currentQuestionIds = new Set(questionRows.map((q) => q.id))
  const { data: storedQuestions, error: storedError } = await admin
    .from('sms_gamev2_questions')
    .select('id')
    .in('question_set_id', BUILTIN_SET_IDS)
  if (storedError) throw storedError
  const staleIds = (storedQuestions ?? []).map((q) => q.id as string).filter((id) => !currentQuestionIds.has(id))
  for (let i = 0; i < staleIds.length; i += 200) {
    const { error } = await admin.from('sms_gamev2_questions').delete().in('id', staleIds.slice(i, i + 200))
    if (error) throw error
  }

  // A set removed from the catalog entirely is unpublished (not deleted,
  // so any history pointing at it survives).
  const { data: taggedSets } = await admin.from('sms_gamev2_question_sets').select('id').contains('tags', [BUILTIN_TAG])
  const retired = (taggedSets ?? []).map((s) => s.id as string).filter((id) => !BUILTIN_SET_IDS.includes(id))
  if (retired.length > 0) {
    await admin.from('sms_gamev2_question_sets').update({ published: false, visibility: 'PRIVATE' }).in('id', retired)
  }

  return { status: 'synced', sets: setRows.length, questions: questionRows.length, removedQuestions: staleIds.length, retiredSets: retired.length }
}
