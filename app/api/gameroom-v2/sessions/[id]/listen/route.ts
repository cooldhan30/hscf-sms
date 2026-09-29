import { NextResponse } from 'next/server'
import { requireGameV2Session } from '@/lib/gameRoomV2/requireSession'
import { correctAnswerText } from '@/lib/gameRoomV2/answerReveal'
import { tamilSpeechUrl, TtsUnavailableError } from '@/lib/sarvamTts'

// POST /api/gameroom-v2/sessions/[id]/listen -- Listen & Choose's sound.
// Returns { url } for the CURRENT question: the teacher's own clip for a
// listening (AUDIO_CHOICE) question, otherwise the right answer spoken in
// Tamil by Sarvam (cached, see lib/sarvamTts.ts). The child then taps
// what they heard; the tap is graded by /answer like every engine.
//
// Only for Listen & Choose sessions: in any other game, hearing the right
// answer would give it away. The answer text itself never leaves the
// server -- only the audio does.
const ENGINE = 'listen-choose'
const PLAYABLE = ['MULTIPLE_CHOICE', 'IMAGE_CHOICE', 'AUDIO_CHOICE']

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireGameV2Session(params.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { admin, session } = guard

  if (session.engine_id !== ENGINE) {
    return NextResponse.json({ error: 'Listening is only available in Listen & Choose' }, { status: 403 })
  }
  if (session.status !== 'ACTIVE') {
    return NextResponse.json({ error: `The game is "${session.status}"` }, { status: 409 })
  }
  const questionId = session.question_order[session.current_index]
  if (!questionId) return NextResponse.json({ error: 'No current question' }, { status: 409 })

  const { data: question } = await admin
    .from('sms_gamev2_questions')
    .select('question_type, payload')
    .eq('id', questionId)
    .eq('question_set_id', session.question_set_id)
    .single()
  if (!question || !PLAYABLE.includes(question.question_type)) {
    return NextResponse.json({ error: 'This question has nothing to listen to' }, { status: 422 })
  }

  const payload = (question.payload ?? {}) as Record<string, unknown>
  if (question.question_type === 'AUDIO_CHOICE' && typeof payload.audioUrl === 'string' && payload.audioUrl) {
    return NextResponse.json({ url: payload.audioUrl })
  }

  const text = correctAnswerText(question.question_type, payload)
  if (!text) return NextResponse.json({ error: 'This question has nothing to listen to' }, { status: 422 })

  try {
    return NextResponse.json({ url: await tamilSpeechUrl(admin, text) })
  } catch (err) {
    console.error('listen: TTS unavailable', err)
    const message = err instanceof TtsUnavailableError ? 'Listening is not available right now' : 'Something went wrong'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
