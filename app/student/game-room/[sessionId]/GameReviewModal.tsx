'use client'

import { useEffect, useState } from 'react'
import { FiCheckCircle, FiXCircle } from 'react-icons/fi'
import { Modal } from '@/components/dashboard/Modal'
import { Badge } from '@/components/ui/Badge'

interface ReviewItem {
  questionIndex: number
  prompt: string
  options: string[]
  selectedAnswer: string | null
  correctAnswer: string | null
  isCorrect: boolean
  points: number
  explanation: string | null
  category: string | null
  categoryLabel: string | null
}

interface ReviewPayload {
  gameName: string
  score: number
  correctCount: number
  totalCount: number
  review: ReviewItem[]
}

// Post-game review: every question this player answered, their pick,
// the correct answer, and why -- so mistakes are something a student
// can actually learn from, not just a final score they move past.
// Loaded lazily (only when opened), not as part of the poll loop, since
// this data never changes mid-game and there's no reason to fetch it
// before the student asks to see it.
export function GameReviewModal({ sessionId, open, onClose }: { sessionId: string; open: boolean; onClose: () => void }) {
  const [data, setData] = useState<ReviewPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setData(null)
    setError(null)

    fetch('/api/game-room/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
      .then((res) => res.json())
      .then((payload) => {
        if (cancelled) return
        if (payload.error) {
          setError(payload.error)
          return
        }
        setData(payload)
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load your review')
      })

    return () => {
      cancelled = true
    }
  }, [open, sessionId])

  return (
    <Modal open={open} onClose={onClose} title="Review Your Answers" size="large">
      {error ? (
        <p className="text-sm text-terracotta-600 dark:text-terracotta-400">{error}</p>
      ) : !data ? (
        <p className="text-sm text-stone-400 dark:text-stone-500">Loading...</p>
      ) : data.review.length === 0 ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">No answers to review yet.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {data.gameName} &middot; {data.correctCount}/{data.totalCount} correct &middot; {data.score} points
          </p>
          <div className="space-y-3">
            {data.review.map((item) => (
              <div
                key={item.questionIndex}
                className={`rounded-2xl border p-4 ${
                  item.isCorrect
                    ? 'border-primary-200 dark:border-primary-900 bg-primary-50/50 dark:bg-primary-950/20'
                    : 'border-terracotta-200 dark:border-terracotta-900 bg-terracotta-50/50 dark:bg-terracotta-950/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    {item.isCorrect ? (
                      <FiCheckCircle className="w-5 h-5 mt-0.5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                    ) : (
                      <FiXCircle className="w-5 h-5 mt-0.5 text-terracotta-600 dark:text-terracotta-400 flex-shrink-0" />
                    )}
                    <div>
                      {item.categoryLabel && (
                        <Badge variant="secondary" size="sm">
                          {item.categoryLabel}
                        </Badge>
                      )}
                      <p className="font-semibold text-stone-800 dark:text-stone-100 mt-1">
                        {item.questionIndex + 1}. {item.prompt}
                      </p>
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-sm font-semibold text-stone-500 dark:text-stone-400">
                    +{item.points}
                  </span>
                </div>

                <div className="mt-2 ml-7 space-y-1 text-sm">
                  <p className="text-stone-600 dark:text-stone-300">
                    Your answer:{' '}
                    <span className={item.isCorrect ? 'font-semibold text-primary-700 dark:text-primary-400' : 'font-semibold text-terracotta-600 dark:text-terracotta-400'}>
                      {item.selectedAnswer ?? '(no answer -- time ran out)'}
                    </span>
                  </p>
                  {!item.isCorrect && (
                    <p className="text-stone-600 dark:text-stone-300">
                      Correct answer: <span className="font-semibold text-primary-700 dark:text-primary-400">{item.correctAnswer}</span>
                    </p>
                  )}
                  {item.explanation && <p className="text-stone-500 dark:text-stone-400">{item.explanation}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
