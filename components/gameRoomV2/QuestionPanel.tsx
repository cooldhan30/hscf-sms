import type { ReactNode } from 'react'
import { GameV2Card } from './GameV2Card'

// The frame every question-type UI renders inside. `category` is an
// optional small pill above the prompt (mirroring legacy GameRoom's
// category badge for mixed-mode quizzes -- a student otherwise has no
// way to know what a mixed question is testing), kept generic here so
// any question type can use it, not just multiple choice.
export function QuestionPanel({
  category,
  prompt,
  mediaUrl,
  children,
}: {
  category?: string | null
  prompt: string
  mediaUrl?: string | null
  children: ReactNode
}) {
  return (
    <GameV2Card padding="lg" className="max-w-xl w-full mx-auto">
      {category && (
        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300 mb-3">
          {category}
        </span>
      )}
      {mediaUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary Storage/media URL, decorative question art
        <img src={mediaUrl} alt="" className="w-full max-h-56 object-contain rounded-2xl mb-4" />
      )}
      {/* Tamil text gets its own larger line-height/letter-spacing here
          rather than relying on the body default -- Tamil vowel signs
          and conjuncts need visibly more vertical room than Latin text
          at the same font-size or they read as cramped/clipped. */}
      <p className="font-tamil text-2xl sm:text-3xl font-bold text-primary-900 dark:text-white leading-[1.6] tracking-wide text-center">
        {prompt}
      </p>
      <div className="mt-6 space-y-3">{children}</div>
    </GameV2Card>
  )
}
