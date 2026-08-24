import { useMemo } from 'react'
import type { WorksheetContent } from '@/lib/worksheetTypes'

// A student needs a letter bank that actually contains the answer to
// every blank -- the blanked letter can be a pure consonant (மெய்
// எழுத்து, e.g. க்) OR a consonant+vowel combination (உயிர்மெய்
// எழுத்து, e.g. கு, வா, நா), since blankOutOneLetter (lib/
// tamilVocabEmoji.ts) removes a whole grapheme cluster, not just pure
// consonants. A fixed மெய்-only reference list was previously shown
// regardless of what got blanked, so any உயிர்மெய் blank had no way to
// be solved from the letters on screen. The bank is now built directly
// from this worksheet's own missingLetter values (deduped, shuffled),
// so it's always solvable.
function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function PictureFillBlankWorksheet({ content }: { content: WorksheetContent }) {
  const letterBank = useMemo(
    () => shuffle(Array.from(new Set(content.items.map((item) => item.missingLetter)))),
    [content.items]
  )

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-stone-800 dark:text-stone-100">{content.title}</h2>

      <div>
        <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase mb-2">எழுத்துகள்</p>
        <div className="flex flex-wrap gap-1.5">
          {letterBank.map((letter, i) => (
            <span
              key={`${letter}-${i}`}
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
