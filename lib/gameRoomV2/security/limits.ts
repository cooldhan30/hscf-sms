// Pure input-validation and abuse-limit rules for GameRoom V2's API
// routes. Deliberately DOM-free, DB-free and not 'server-only', so
// scripts/verify-gameroom-v2-security.ts can exercise every rule
// directly -- the routes themselves just call these and translate a
// failure into a 4xx.
//
// Threat model (see migration 083's header): a student can hand-craft
// any request body. Nothing here decides correctness or rewards --
// gradeAnswer.ts and the reward service do that from server-held data
// -- these rules only stop oversized/malformed input from being stored
// or amplified.

// A real submission is at most a short string, a small array (ORDER_*,
// FILL_BLANK) or a small map (MATCH, CATEGORIZE). 8 KB is generous for
// Tamil text (3 bytes per code point in UTF-8) while stopping a client
// from persisting megabytes into sms_gamev2_answers.submitted_answer.
export const MAX_SUBMITTED_ANSWER_BYTES = 8 * 1024

export function jsonByteLength(value: unknown): number {
  const json = JSON.stringify(value === undefined ? null : value)
  return new TextEncoder().encode(json ?? 'null').length
}

export function checkSubmittedAnswer(answer: unknown): { ok: true } | { ok: false; error: string } {
  let size: number
  try {
    size = jsonByteLength(answer)
  } catch {
    return { ok: false, error: 'Answer is not valid JSON' }
  }
  if (size > MAX_SUBMITTED_ANSWER_BYTES) {
    return { ok: false, error: 'Answer is too large' }
  }
  return { ok: true }
}

// Question Set authoring limits. Generous for real classroom content
// (the largest seeded sets are well under these), strict enough that a
// single save can't store an unbounded payload.
export const QUESTION_SET_LIMITS = {
  maxQuestions: 200,
  maxTitleLength: 200,
  maxDescriptionLength: 2000,
  maxPromptLength: 2000,
  maxExplanationLength: 2000,
  maxPayloadBytes: 16 * 1024,
  maxTags: 30,
  maxTagLength: 60,
  maxPoints: 1000,
} as const

// Media is only ever rendered as <img src>/<audio src>, never as a
// link, so this is defense in depth rather than an XSS fix: it keeps
// javascript:/data:/file: and other odd schemes out of stored content
// entirely. Root-relative paths (a file served by this app) and
// http(s) URLs are allowed.
export function isSafeMediaUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false
  const trimmed = url.trim()
  if (trimmed === '') return true
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

interface QuestionSetLimitsInput {
  title: string
  description: string | null
  tags: string[]
  questions: {
    questionType?: string
    prompt?: string
    payload?: unknown
    explanation?: string | null
    mediaUrl?: string | null
    points?: unknown
  }[]
}

// Returns every limit violation (empty = OK). Separate from
// validateQuestionSet() (domain/validateQuestion.ts), which checks that
// each payload is a well-formed question -- this only checks size and
// shape bounds, so it runs first and rejects abuse before any deeper
// validation work.
export function validateQuestionSetLimits(input: QuestionSetLimitsInput): string[] {
  const L = QUESTION_SET_LIMITS
  const problems: string[] = []

  if (input.title.length > L.maxTitleLength) problems.push(`Title must be at most ${L.maxTitleLength} characters`)
  if (input.description && input.description.length > L.maxDescriptionLength) {
    problems.push(`Description must be at most ${L.maxDescriptionLength} characters`)
  }
  if (input.tags.length > L.maxTags) problems.push(`At most ${L.maxTags} tags are allowed`)
  if (input.tags.some((t) => t.length > L.maxTagLength)) problems.push(`Each tag must be at most ${L.maxTagLength} characters`)
  if (input.questions.length > L.maxQuestions) {
    problems.push(`A question set can have at most ${L.maxQuestions} questions`)
    return problems
  }

  input.questions.forEach((q, i) => {
    const n = i + 1
    if ((q.prompt ?? '').length > L.maxPromptLength) problems.push(`Question ${n}: prompt must be at most ${L.maxPromptLength} characters`)
    if ((q.explanation ?? '').length > L.maxExplanationLength) {
      problems.push(`Question ${n}: explanation must be at most ${L.maxExplanationLength} characters`)
    }
    let payloadBytes = 0
    try {
      payloadBytes = jsonByteLength(q.payload ?? {})
    } catch {
      problems.push(`Question ${n}: payload is not valid JSON`)
    }
    if (payloadBytes > L.maxPayloadBytes) problems.push(`Question ${n}: question content is too large`)
    if (q.points !== undefined && q.points !== null) {
      if (typeof q.points !== 'number' || !Number.isInteger(q.points) || q.points <= 0 || q.points > L.maxPoints) {
        problems.push(`Question ${n}: points must be a whole number between 1 and ${L.maxPoints}`)
      }
    }
    if (q.mediaUrl != null && !isSafeMediaUrl(q.mediaUrl)) problems.push(`Question ${n}: media URL must be an http(s) link`)
    const payload = (q.payload ?? {}) as Record<string, unknown>
    if (q.questionType === 'IMAGE_CHOICE' && Array.isArray(payload.options)) {
      const bad = (payload.options as { imageUrl?: unknown }[]).some((o) => !isSafeMediaUrl(o?.imageUrl ?? ''))
      if (bad) problems.push(`Question ${n}: image URLs must be http(s) links`)
    }
    if (q.questionType === 'AUDIO_CHOICE' && payload.audioUrl !== undefined && !isSafeMediaUrl(payload.audioUrl)) {
      problems.push(`Question ${n}: audio URL must be an http(s) link`)
    }
  })

  return problems
}

// Question Set edits used to delete every question row and reinsert
// the list. Because sms_gamev2_answers.question_id is ON DELETE CASCADE
// (and learning events cascade from answers), every save silently
// wiped all students' answer history and teacher analytics for the set,
// and broke any in-progress session whose question_order pointed at
// the old ids. This plans an in-place update instead: an incoming
// question that carries the id of a question ALREADY IN THIS SET is
// updated in place; anything else (no id, or an id from some other
// set -- never trusted) is inserted fresh; only questions the teacher
// actually removed are deleted.
export function planQuestionReplacement(
  existingIds: string[],
  incomingIds: (string | null | undefined)[]
): { updateIndexes: number[]; insertIndexes: number[]; deleteIds: string[] } {
  const existing = new Set(existingIds)
  const claimed = new Set<string>()
  const updateIndexes: number[] = []
  const insertIndexes: number[] = []

  incomingIds.forEach((id, i) => {
    // A duplicated id in one payload can only update its row once --
    // the second occurrence becomes a new question.
    if (typeof id === 'string' && existing.has(id) && !claimed.has(id)) {
      claimed.add(id)
      updateIndexes.push(i)
    } else {
      insertIndexes.push(i)
    }
  })

  const deleteIds = existingIds.filter((id) => !claimed.has(id))
  return { updateIndexes, insertIndexes, deleteIds }
}

// Coarse per-student cap on solo session creation. There is no rate-
// limiting infrastructure in this app (no Redis/edge middleware), so
// this is a DB-count check in sessions/start/route.ts: a real student
// starts a handful of games per class period, never dozens a minute.
export const SESSION_START_LIMIT = { windowMinutes: 10, maxStarts: 30 } as const

export function exceedsSessionStartLimit(startsInWindow: number): boolean {
  return startsInWindow >= SESSION_START_LIMIT.maxStarts
}

// A session bridged into a Live Classroom is paced by the HOST: the
// teacher's Pause freezes every participant together via
// sms_gamev2_pause_live_session. Letting a participant call the solo
// /pause or /resume routes on that session would let them buy unlimited
// thinking time mid-race, or -- worse -- resume themselves while the
// rest of the class is frozen and keep answering. Solo sessions keep
// full self-control.
export function studentMayControlPause(isLiveBridged: boolean): boolean {
  return !isLiveBridged
}
