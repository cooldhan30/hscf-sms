'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FiPlus, FiUpload, FiEdit2, FiPlay } from 'react-icons/fi'
import type { MyQuestionSet } from './types'

// The teacher's strip at the top of the GameRoom home: add questions with
// their answer options (the Builder), upload a .txt/.csv of them (the
// importer), and edit any of their own sets. A saved set shows up as a
// topic in the launcher right below; "Use" selects it there.
const SHOWN = 6

export function MyQuestions({ sets, onUse }: { sets: MyQuestionSet[]; onUse: (setId: string) => void }) {
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? sets : sets.slice(0, SHOWN)
  const btn = 'min-h-[44px] px-4 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-300'

  return (
    <section className="rounded-2xl border border-gold-200 dark:border-gold-900 bg-gold-50 dark:bg-stone-900 p-4 sm:p-5" aria-labelledby="my-questions">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <h2 id="my-questions" className="text-lg font-bold text-primary-900 dark:text-white">
            My questions <span className="font-tamil font-normal text-stone-500 dark:text-stone-400">· என் வினாக்கள்</span>
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-400">Write questions and answer options, or upload a file. They appear as topics below.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/gameroom-v2/builder/new" className={`${btn} bg-primary-700 hover:bg-primary-800 text-white`}>
            <FiPlus className="w-4 h-4" aria-hidden /> Add questions
          </Link>
          <Link href="/gameroom-v2/library/import" className={`${btn} bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:border-primary-400`}>
            <FiUpload className="w-4 h-4" aria-hidden /> Upload a file
          </Link>
        </div>
      </div>

      {sets.length === 0 ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">You haven&apos;t added any questions yet. The built-in Tamil topics below are ready to play now.</p>
      ) : (
        <>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {shown.map((s) => (
              <li key={s.id} className="flex items-center gap-2 rounded-xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 pl-3 pr-1.5 py-1.5">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-sm text-stone-800 dark:text-stone-100 truncate">{s.title}</span>
                  <span className="block text-xs text-stone-500 dark:text-stone-400">
                    {s.questionCount === 0 ? 'No questions yet' : `${s.questionCount} question${s.questionCount === 1 ? '' : 's'}`}
                  </span>
                </span>
                {s.questionCount > 0 && (
                  <button type="button" onClick={() => onUse(s.id)} className="min-h-[40px] px-2.5 rounded-lg text-sm font-semibold text-primary-700 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950 inline-flex items-center gap-1" aria-label={`Play ${s.title}`}>
                    <FiPlay className="w-4 h-4" aria-hidden /> Use
                  </button>
                )}
                <Link href={`/gameroom-v2/builder/${s.id}`} className="min-h-[40px] px-2.5 rounded-lg text-sm font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 inline-flex items-center gap-1" aria-label={`Edit ${s.title}`}>
                  <FiEdit2 className="w-4 h-4" aria-hidden /> Edit
                </Link>
              </li>
            ))}
          </ul>
          {sets.length > SHOWN && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 min-h-[40px] text-sm font-semibold text-primary-700 dark:text-primary-400 hover:underline">
              {showAll ? 'Show fewer' : `Show all ${sets.length}`}
            </button>
          )}
        </>
      )}
    </section>
  )
}
