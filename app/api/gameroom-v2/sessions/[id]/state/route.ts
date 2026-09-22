import { NextResponse } from 'next/server'
import { requireGameV2Session } from '@/lib/gameRoomV2/requireSession'
import { shuffledOptionsFor } from '@/lib/gameRoomV2/shuffle'
import { getGameEngineV2 } from '@/lib/gameRoomV2/registry'

// POST /api/gameroom-v2/sessions/[id]/state -- "SHOW QUESTION". Polled
// by the client (same 2-3s interval idiom legacy GameRoom's own
// /api/game-room/state uses, reimplemented here rather than shared
// code). Returns the session's status/progress/HUD stats, and -- only
// while ACTIVE and not completed -- the CURRENT question, stripped of
// its answer key. This is the literal mechanism behind "the game
// should not need to understand question implementation details": an
// engine's client component only ever sees `prompt`/`options`-shaped
// data here, never the payload's correctAnswer/pairs/answerKey/etc.
//
// Transitions READY -> ACTIVE on the first call for a session (this is
// also when the timer anchor and started_at are actually set -- see
// sessions/start/route.ts's comment on why this is deferred to here).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireGameV2Session(params.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, session } = guard

  let currentSession = session

  if (currentSession.status === 'READY') {
    const { data: updated } = await supabase
      .from('sms_gamev2_sessions')
      .update({ status: 'ACTIVE', started_at: new Date().toISOString(), current_question_started_at: new Date().toISOString() })
      .eq('id', currentSession.id)
      .select()
      .single()
    if (updated) currentSession = updated
  }

  const base = {
    status: currentSession.status,
    currentIndex: currentSession.current_index,
    totalQuestions: currentSession.question_order.length,
    score: currentSession.score,
    correctCount: currentSession.correct_count,
    answeredCount: currentSession.answered_count,
    lives: currentSession.lives,
    maxLives: currentSession.max_lives,
    currentStreak: currentSession.current_streak,
    bestStreak: currentSession.best_streak,
    questionTimeLimitSeconds: currentSession.question_time_limit_seconds,
    xpEarned: currentSession.xp_earned,
    coinsEarned: currentSession.coins_earned,
  }

  const isPlayable = currentSession.status === 'ACTIVE'
  if (!isPlayable) {
    return NextResponse.json({ ...base, question: null, remainingSeconds: null })
  }

  const questionId = currentSession.question_order[currentSession.current_index]
  if (!questionId) {
    // current_index has run past the end of question_order -- the
    // client should be treating this as complete already (answer/
    // route.ts sets status COMPLETED the moment the last question is
    // answered), but this guards against a stray poll landing here.
    return NextResponse.json({ ...base, question: null, remainingSeconds: null })
  }

  const { data: question } = await supabase
    .from('sms_gamev2_questions')
    .select('id, question_type, prompt, payload, media_url, points')
    .eq('id', questionId)
    .single()

  if (!question) {
    return NextResponse.json({ error: 'Question not found' }, { status: 500 })
  }

  const elapsedMs = currentSession.current_question_started_at
    ? Date.now() - new Date(currentSession.current_question_started_at).getTime()
    : 0
  const remainingSeconds = Math.max(0, currentSession.question_time_limit_seconds - Math.floor(elapsedMs / 1000))

  const engine = getGameEngineV2(currentSession.engine_id)

  return NextResponse.json({
    ...base,
    remainingSeconds,
    engineName: engine?.name ?? currentSession.engine_id,
    question: stripAnswerKey(question, currentSession.id),
  })
}

// Strips every field that would let a client derive the correct answer
// without actually answering -- kept as one explicit allowlist-style
// function (rather than deleting known-bad keys) so a new question
// type's payload shape can never accidentally leak a new field this
// function doesn't yet know to redact.
function stripAnswerKey(
  question: { id: string; question_type: string; prompt: string; payload: Record<string, unknown>; media_url: string | null; points: number },
  sessionId: string
) {
  const p = question.payload ?? {}
  let safePayload: Record<string, unknown> = {}

  switch (question.question_type) {
    case 'MULTIPLE_CHOICE':
      safePayload = { options: shuffledOptionsFor((p.options as string[]) ?? [], `${sessionId}:${question.id}`) }
      break
    case 'TRUE_FALSE':
      safePayload = {}
      break
    case 'IMAGE_CHOICE':
      safePayload = {
        options: shuffledOptionsFor((p.options as { imageUrl: string; label?: string }[]) ?? [], `${sessionId}:${question.id}`),
      }
      break
    case 'TEXT_INPUT':
      safePayload = {}
      break
    case 'FILL_BLANK':
      safePayload = { blankCount: Array.isArray(p.blanks) ? p.blanks.length : 0 }
      break
    case 'MATCH':
      safePayload = {
        left: shuffledOptionsFor(((p.pairs as { left: string; right: string }[]) ?? []).map((pr) => pr.left), `${sessionId}:${question.id}:left`),
        right: shuffledOptionsFor(((p.pairs as { left: string; right: string }[]) ?? []).map((pr) => pr.right), `${sessionId}:${question.id}:right`),
      }
      break
    case 'ORDER_LETTERS':
      safePayload = { letters: shuffledOptionsFor((p.letters as string[]) ?? [], `${sessionId}:${question.id}`) }
      break
    case 'ORDER_WORDS':
      safePayload = { words: shuffledOptionsFor((p.words as string[]) ?? [], `${sessionId}:${question.id}`) }
      break
    case 'CATEGORIZE':
      safePayload = {
        items: shuffledOptionsFor((p.items as string[]) ?? [], `${sessionId}:${question.id}`),
        categories: (p.categories as string[]) ?? [],
      }
      break
    case 'AUDIO_CHOICE':
      safePayload = {
        audioUrl: p.audioUrl,
        options: shuffledOptionsFor((p.options as string[]) ?? [], `${sessionId}:${question.id}`),
      }
      break
    default:
      safePayload = {}
  }

  return {
    id: question.id,
    questionType: question.question_type,
    prompt: question.prompt,
    payload: safePayload,
    mediaUrl: question.media_url,
    points: question.points,
  }
}
