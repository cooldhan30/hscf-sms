// After a WRONG answer has been graded and recorded, a solo player is
// shown the correct answer (and what they chose) so the moment teaches
// something. This builds that short display text from the stored
// payload. Only /answer calls correctAnswerText(), only after grading,
// and never for Live Classroom sessions (classmates may still be on the
// same question). formatAnswer() is display-only for the client.

export function correctAnswerText(questionType: string, payload: unknown): string | null {
  const p = (payload ?? {}) as Record<string, unknown>
  switch (questionType) {
    case 'MULTIPLE_CHOICE':
    case 'AUDIO_CHOICE':
      return typeof p.correctAnswer === 'string' ? p.correctAnswer : null
    case 'IMAGE_CHOICE': {
      const opts = Array.isArray(p.options) ? (p.options as { imageUrl?: string; label?: string }[]) : []
      const hit = opts.find((o) => o?.imageUrl === p.correctAnswer)
      return hit?.label ?? null
    }
    case 'TRUE_FALSE':
      return typeof p.correctAnswer === 'boolean' ? (p.correctAnswer ? 'True' : 'False') : null
    case 'TEXT_INPUT':
      return Array.isArray(p.acceptedAnswers) && typeof p.acceptedAnswers[0] === 'string' ? (p.acceptedAnswers[0] as string) : null
    case 'FILL_BLANK':
      return Array.isArray(p.blanks) ? (p.blanks as unknown[][]).map((b) => (Array.isArray(b) ? String(b[0] ?? '') : '')).join(', ') : null
    case 'ORDER_LETTERS':
      return Array.isArray(p.correctOrder) ? (p.correctOrder as string[]).join('') : null
    case 'ORDER_WORDS':
      return Array.isArray(p.correctOrder) ? (p.correctOrder as string[]).join(' ') : null
    case 'MATCH':
      return Array.isArray(p.pairs) ? (p.pairs as { left: string; right: string }[]).map((x) => `${x.left} - ${x.right}`).join(', ') : null
    case 'CATEGORIZE':
      return p.answerKey && typeof p.answerKey === 'object'
        ? Object.entries(p.answerKey as Record<string, string>)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')
        : null
    default:
      return null
  }
}

export function formatAnswer(answer: unknown): string {
  if (answer === null || answer === undefined) return 'No answer (time ran out)'
  if (typeof answer === 'boolean') return answer ? 'True' : 'False'
  if (typeof answer === 'string') return answer
  if (Array.isArray(answer)) return answer.map(String).join(' ')
  if (typeof answer === 'object')
    return Object.entries(answer as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(', ')
  return String(answer)
}
