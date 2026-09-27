'use client'

import { FiInfo } from 'react-icons/fi'
import { encouragementFor } from '@/lib/gameRoomV2/celebration'
import { TA } from '@/lib/gameRoomV2/i18n/ta'

// The shared "not quite" card. No shame effects: a calm heading, what the
// student chose, the right answer, the teacher's explanation, and a short
// encouraging line. Correctness is shown with words and an icon, never by
// colour alone. Teacher-authored text is shown exactly as written.
export function AnswerReview({
  yourAnswer,
  correctAnswer,
  explanation,
  seed = 0,
  onDismiss,
  dismissLabel,
  compact = false,
}: {
  yourAnswer: string | null
  correctAnswer: string | null
  explanation: string | null
  seed?: number
  onDismiss?: () => void
  dismissLabel?: string
  compact?: boolean
}) {
  const nudge = encouragementFor(seed)
  return (
    <div role="status" className={`w-full rounded-2xl bg-white shadow-xl border-2 border-amber-300 ${compact ? 'px-3 py-2' : 'px-4 py-3'} text-left`}>
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-2 text-lg font-black text-amber-800">
          <FiInfo className="w-5 h-5 shrink-0" aria-hidden />
          <span className="font-tamil">{TA.notQuite.ta}</span>
          <span className="text-xs font-semibold text-stone-500">· {TA.notQuite.en}</span>
        </p>
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="min-h-[40px] rounded-xl px-3 text-sm font-bold text-primary-800 hover:bg-primary-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-300">
            <span className="font-tamil">{dismissLabel ?? TA.gotIt.ta}</span>
          </button>
        )}
      </div>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm text-stone-700">
        {yourAnswer !== null && yourAnswer !== '' && (
          <>
            <dt className="font-semibold text-stone-500 font-tamil">{TA.yourAnswer.ta}</dt>
            <dd className="font-tamil font-semibold break-words">
              <span aria-hidden>✗ </span>
              {yourAnswer}
            </dd>
          </>
        )}
        {correctAnswer && (
          <>
            <dt className="font-semibold text-stone-500 font-tamil">{TA.correctAnswer.ta}</dt>
            <dd className="font-tamil font-bold text-primary-800 break-words">
              <span aria-hidden>✓ </span>
              {correctAnswer}
            </dd>
          </>
        )}
        {explanation && (
          <>
            <dt className="font-semibold text-stone-500 font-tamil">{TA.why.ta}</dt>
            <dd className="font-tamil leading-relaxed text-stone-600 break-words">{explanation}</dd>
          </>
        )}
      </dl>
      <p className="mt-1.5 text-sm font-semibold text-primary-700">
        <span className="font-tamil">{nudge.ta}</span>
      </p>
    </div>
  )
}
