import type { WorksheetContent } from '@/lib/worksheetTypes'

export function ReadingComprehensionWorksheet({ content }: { content: WorksheetContent }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-stone-800 dark:text-stone-100">{content.title}</h2>

      <div>
        <h3 className="text-sm font-bold text-primary-800 dark:text-primary-300 uppercase tracking-wide mb-2">பத்தி</h3>
        <p className="text-stone-700 dark:text-stone-200 whitespace-pre-wrap leading-relaxed">{content.passage}</p>
      </div>

      {content.questions.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-primary-800 dark:text-primary-300 uppercase tracking-wide mb-2">Questions</h3>
          <ol className="list-decimal list-inside space-y-2 text-stone-700 dark:text-stone-200">
            {content.questions.map((q, i) => (
              <li key={i} className="leading-relaxed">{q}</li>
            ))}
          </ol>
        </div>
      )}

      {content.vocabulary.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-primary-800 dark:text-primary-300 uppercase tracking-wide mb-2">Vocabulary</h3>
          <dl className="space-y-2">
            {content.vocabulary.map(({ term, definition }, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:gap-2">
                <dt className="font-semibold text-stone-800 dark:text-stone-100 sm:w-32 shrink-0">{term}</dt>
                <dd className="text-stone-600 dark:text-stone-300">{definition}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}
