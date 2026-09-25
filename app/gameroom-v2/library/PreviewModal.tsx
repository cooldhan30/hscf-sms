'use client'

import { useEffect, useState } from 'react'
import { GameV2Modal, GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { QuestionPreviewCard } from '@/components/gameRoomV2/builder/QuestionPreviewCard'
import type { DraftQuestion } from '@/components/gameRoomV2/builder/types'
import type { GameRoomQuestionType } from '@/lib/gameRoomV2/domain'

// Logs a PREVIEW usage event once per open -- best-effort, never blocks
// or affects the preview itself if the log write fails.
export function PreviewModal({ open, onClose, setId, setTitle }: { open: boolean; onClose: () => void; setId: string; setTitle: string }) {
  const [questions, setQuestions] = useState<DraftQuestion[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setQuestions(null)
    setError(null)

    fetch(`/api/gameroom-v2/question-sets/${setId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.error) {
          setError(data.error)
          return
        }
        setQuestions(
          (data.questions ?? []).map((q: Record<string, unknown>) => ({
            localId: q.id as string,
            id: q.id as string,
            questionType: q.question_type as GameRoomQuestionType,
            prompt: q.prompt as string,
            payload: (q.payload as Record<string, unknown>) ?? {},
            explanation: (q.explanation as string) ?? '',
            mediaUrl: (q.media_url as string | null) ?? null,
            points: q.points as number,
          }))
        )
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load question set')
      })

    fetch(`/api/gameroom-v2/question-sets/${setId}/usage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'PREVIEW' }),
    }).catch(() => {})

    return () => {
      cancelled = true
    }
  }, [open, setId])

  return (
    <GameV2Modal open={open} onClose={onClose} title={`Preview: ${setTitle}`} size="large">
      {error ? (
        <GameV2Error description={error} />
      ) : !questions ? (
        <GameV2Loading />
      ) : questions.length === 0 ? (
        <p className="text-sm text-stone-500 dark:text-stone-400 text-center py-8">This set has no questions yet.</p>
      ) : (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {questions.map((q, i) => (
            <div key={q.localId}>
              <p className="text-xs font-bold uppercase tracking-wide text-stone-400 dark:text-stone-500 mb-1.5">
                Question {i + 1}
              </p>
              <QuestionPreviewCard question={q} />
            </div>
          ))}
        </div>
      )}
    </GameV2Modal>
  )
}
