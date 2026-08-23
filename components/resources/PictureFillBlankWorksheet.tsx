import type { WorksheetContent } from '@/lib/worksheetTypes'

// Tamil consonants (மெய் எழுத்துகள்) -- a fixed, known set, shown as a
// reference strip above the grid so a student knows which letters they
// can choose from to fill each blank.
const TAMIL_CONSONANTS = [
  'க்', 'ங்', 'ச்', 'ஞ்', 'ட்', 'ண்', 'த்', 'ந்', 'ப்', 'ம்',
  'ய்', 'ர்', 'ல்', 'வ்', 'ழ்', 'ள்', 'ற்', 'ன்',
]

export function PictureFillBlankWorksheet({ content }: { content: WorksheetContent }) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-stone-800 dark:text-stone-100">{content.title}</h2>

      <div>
        <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase mb-2">மெய் எழுத்துகள்</p>
        <div className="flex flex-wrap gap-1.5">
          {TAMIL_CONSONANTS.map((letter) => (
            <span
              key={letter}
              className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 text-sm font-semibold"
            >
              {letter}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {content.items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900"
          >
            <span className="text-4xl leading-none">{item.emoji}</span>
            <span className="text-xl font-bold text-stone-800 dark:text-stone-100 tracking-wide">
              {item.blankedWord}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
