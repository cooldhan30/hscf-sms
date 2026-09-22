import { AnswerOption } from '@/components/gameRoomV2'
import type { DraftQuestion } from './types'
import type {
  MultipleChoicePayload,
  TrueFalsePayload,
  ImageChoicePayload,
  TextInputPayload,
  MatchPayload,
  OrderLettersPayload,
  OrderWordsPayload,
  CategorizePayload,
  AudioChoicePayload,
} from '@/lib/gameRoomV2/domain'

// Renders a question exactly the way a student would see it using the
// SAME design-system pieces the real play screen will use (AnswerOption
// etc) -- this is the Builder's "Preview" step, so a teacher checks
// against the actual student-facing look, not a simplified admin-only
// rendering that could hide a real display problem.
export function QuestionPreviewCard({ question }: { question: DraftQuestion }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-gamev2ink-200 dark:border-gamev2ink-700 p-5 bg-gamev2ink-50/50 dark:bg-gamev2ink-950/40">
      {question.mediaUrl && question.questionType !== 'AUDIO_CHOICE' && (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary teacher-provided media URL, preview only
        <img src={question.mediaUrl} alt="" className="w-full max-h-48 object-contain rounded-xl mb-4" />
      )}
      <p className="font-tamil text-2xl font-extrabold text-gamev2ink-900 dark:text-white leading-[1.6] tracking-wide text-center mb-5">
        {question.prompt || <span className="italic text-gamev2ink-400 text-lg">(no question text yet)</span>}
      </p>

      <div className="space-y-2 max-w-md mx-auto">
        <PayloadPreview question={question} />
      </div>

      {question.explanation && (
        <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400 mt-4 text-center italic">
          &quot;{question.explanation}&quot;
        </p>
      )}
    </div>
  )
}

function PayloadPreview({ question }: { question: DraftQuestion }) {
  const p = question.payload

  switch (question.questionType) {
    case 'MULTIPLE_CHOICE': {
      const v = p as unknown as Partial<MultipleChoicePayload>
      return (
        <>
          {(v.options ?? []).filter((o) => o.trim()).map((o) => (
            <AnswerOption key={o} label={o} state={o === v.correctAnswer ? 'correct' : 'idle'} disabled />
          ))}
        </>
      )
    }
    case 'TRUE_FALSE': {
      const v = p as unknown as Partial<TrueFalsePayload>
      return (
        <>
          <AnswerOption label="True" state={v.correctAnswer === true ? 'correct' : 'idle'} disabled />
          <AnswerOption label="False" state={v.correctAnswer === false ? 'correct' : 'idle'} disabled />
        </>
      )
    }
    case 'IMAGE_CHOICE': {
      const v = p as unknown as Partial<ImageChoicePayload>
      return (
        <div className="grid grid-cols-2 gap-3">
          {(v.options ?? []).filter((o) => o.imageUrl.trim()).map((o) => (
            <div
              key={o.imageUrl}
              className={`rounded-xl border-2 overflow-hidden ${o.imageUrl === v.correctAnswer ? 'border-gamev2mint-500' : 'border-gamev2ink-200 dark:border-gamev2ink-700'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary teacher-provided image URL, preview only */}
              <img src={o.imageUrl} alt={o.label ?? ''} className="w-full h-24 object-cover" />
              {o.label && <p className="text-xs text-center py-1 font-tamil">{o.label}</p>}
            </div>
          ))}
        </div>
      )
    }
    case 'TEXT_INPUT': {
      const v = p as unknown as Partial<TextInputPayload>
      return (
        <div className="text-center">
          <input
            disabled
            placeholder="Student types their answer..."
            className="w-full px-4 py-3 rounded-2xl border-2 border-gamev2ink-200 dark:border-gamev2ink-700 bg-white dark:bg-gamev2ink-900 text-center font-tamil"
          />
          <p className="text-xs text-gamev2ink-400 mt-2">Accepts: {(v.acceptedAnswers ?? []).filter(Boolean).join(', ') || '(none set)'}</p>
        </div>
      )
    }
    case 'FILL_BLANK':
      return <p className="text-center text-sm text-gamev2ink-500">Each ___ becomes a fillable blank for the student.</p>
    case 'MATCH': {
      const v = p as unknown as Partial<MatchPayload>
      return (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            {(v.pairs ?? []).map((pr, i) => (
              <div key={i} className="px-3 py-2 rounded-xl bg-white dark:bg-gamev2ink-900 border-2 border-gamev2ink-200 dark:border-gamev2ink-700 font-tamil text-sm text-center">
                {pr.left || '...'}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {(v.pairs ?? []).map((pr, i) => (
              <div key={i} className="px-3 py-2 rounded-xl bg-white dark:bg-gamev2ink-900 border-2 border-gamev2ink-200 dark:border-gamev2ink-700 font-tamil text-sm text-center">
                {pr.right || '...'}
              </div>
            ))}
          </div>
        </div>
      )
    }
    case 'ORDER_LETTERS':
    case 'ORDER_WORDS': {
      const v = p as unknown as Partial<OrderLettersPayload & OrderWordsPayload>
      const items = v.letters ?? v.words ?? []
      return (
        <div className="flex flex-wrap gap-2 justify-center">
          {items.filter(Boolean).map((item, i) => (
            <span key={i} className="px-3 py-2 rounded-xl bg-white dark:bg-gamev2ink-900 border-2 border-gamev2ink-200 dark:border-gamev2ink-700 font-tamil font-bold">
              {item}
            </span>
          ))}
        </div>
      )
    }
    case 'CATEGORIZE': {
      const v = p as unknown as Partial<CategorizePayload>
      return (
        <div className="space-y-2">
          {(v.categories ?? []).filter(Boolean).map((cat) => (
            <div key={cat} className="rounded-xl border-2 border-gamev2ink-200 dark:border-gamev2ink-700 p-2">
              <p className="text-xs font-bold text-gamev2ink-500 dark:text-gamev2ink-400 mb-1">{cat}</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(v.answerKey ?? {})
                  .filter(([, c]) => c === cat)
                  .map(([item]) => (
                    <span key={item} className="px-2 py-1 rounded-lg bg-gamev2ink-100 dark:bg-gamev2ink-800 text-xs font-tamil">
                      {item}
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )
    }
    case 'AUDIO_CHOICE': {
      const v = p as unknown as Partial<AudioChoicePayload>
      return (
        <>
          {v.audioUrl && <audio controls src={v.audioUrl} className="w-full mb-3" />}
          {(v.options ?? []).filter((o) => o.trim()).map((o) => (
            <AnswerOption key={o} label={o} state={o === v.correctAnswer ? 'correct' : 'idle'} disabled />
          ))}
        </>
      )
    }
    default:
      return null
  }
}
