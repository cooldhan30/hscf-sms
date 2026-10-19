import { NextResponse } from 'next/server'
import { dbErrorResponse, grcTeacherApi } from '@/lib/grClassic/server/auth'
import { GrcError } from '@/lib/grClassic/server/studentAssignments'
import { pickTopicQuestions, topicCatalog } from '@/lib/grClassic/server/topics'
import { NO_TOPIC } from '@/lib/grClassic/topicPlay'
import type { GameType } from '@/lib/grClassic/types'
import { MAX_GAME_QUESTIONS } from '@/lib/grClassic/validateGame'
import { isUuid } from '@/lib/grClassic/validateQuestion'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/gr-classic/questions/pick?type=&topic=&count=
// Create Game's quick setup: `count` random questions of the game type
// from one topic (a topic id or "none"), or from every topic (empty) --
// evenly across topics and never the same question twice. Read by the
// server: every teacher may read the whole library.
const TYPES: GameType[] = ['quiz', 'match', 'word-builder']
export async function GET(request: Request) {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  const p = new URL(request.url).searchParams
  const type = TYPES.find((t) => t === p.get('type'))
  const topic = p.get('topic') ?? ''
  const count = Number.parseInt(p.get('count') ?? '', 10)
  if (!type || (topic && topic !== NO_TOPIC && !isUuid(topic)) || !Number.isInteger(count) || count < 1) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  try {
    const admin = createAdminClient()
    const topics = topic ? [topic] : (await topicCatalog(admin)).filter((t) => t.counts[type] > 0).map((t) => t.id)
    if (!topics.length) return NextResponse.json({ questions: [] })
    const { questions } = await pickTopicQuestions(admin, { topics, type, count: Math.min(count, MAX_GAME_QUESTIONS), seconds: 20 })
    return NextResponse.json({ questions })
  } catch (e) {
    if (e instanceof GrcError) return NextResponse.json({ questions: [] })
    return dbErrorResponse(e as { code?: string; message?: string }, 'pick questions')
  }
}
