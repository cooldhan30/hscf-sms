'use client'

import { FiSearch } from 'react-icons/fi'
import { GRADE_LEVEL_OPTIONS } from '@/lib/constants'
import { QUESTION_SET_DIFFICULTIES, QUESTION_SET_LANGUAGES, GAME_ROOM_V2_QUESTION_TYPES } from '@/lib/gameRoomV2/domain'

export type LibrarySortOption = 'updated' | 'title' | 'usage' | 'duration'

export interface LibraryFilterState {
  search: string
  level: string
  difficulty: string
  questionType: string
  language: string
  creator: string
  tag: string
  sort: LibrarySortOption
}

export const EMPTY_LIBRARY_FILTERS: LibraryFilterState = {
  search: '',
  level: '',
  difficulty: '',
  questionType: '',
  language: '',
  creator: '',
  tag: '',
  sort: 'updated',
}

const SORT_OPTIONS: { value: LibrarySortOption; label: string }[] = [
  { value: 'updated', label: 'Recently Updated' },
  { value: 'title', label: 'Title (A-Z)' },
  { value: 'usage', label: 'Most Used' },
  { value: 'duration', label: 'Shortest First' },
]

function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm text-stone-700 dark:text-stone-200"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

// Title/Topic/Tags are folded into one free-text search box (matching
// components/resources/ResourcesClient.tsx's search-across-several-
// fields idiom) -- Level/Difficulty/Question type/Language/Creator each
// get their own dropdown since those are closed or near-closed
// vocabularies, not free text.
export function LibraryFilterPanel({
  value,
  onChange,
  creators,
}: {
  value: LibraryFilterState
  onChange: (v: LibraryFilterState) => void
  creators: { value: string; label: string }[]
}) {
  function set<K extends keyof LibraryFilterState>(key: K, v: LibraryFilterState[K]) {
    onChange({ ...value, [key]: v })
  }

  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative flex-1 min-w-[200px]">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" aria-hidden />
        <input
          value={value.search}
          onChange={(e) => set('search', e.target.value)}
          placeholder="Search by title, topic, or tags..."
          aria-label="Search question sets by title, topic, or tags"
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm font-tamil leading-relaxed"
        />
      </div>
      <Select value={value.level} onChange={(v) => set('level', v)} options={GRADE_LEVEL_OPTIONS as unknown as { value: string; label: string }[]} placeholder="Any Level" />
      <Select
        value={value.difficulty}
        onChange={(v) => set('difficulty', v)}
        options={QUESTION_SET_DIFFICULTIES.map((d) => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) }))}
        placeholder="Any Difficulty"
      />
      <Select
        value={value.questionType}
        onChange={(v) => set('questionType', v)}
        options={GAME_ROOM_V2_QUESTION_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ') }))}
        placeholder="Any Question Type"
      />
      <Select
        value={value.language}
        onChange={(v) => set('language', v)}
        options={QUESTION_SET_LANGUAGES.map((l) => ({ value: l, label: l.charAt(0).toUpperCase() + l.slice(1) }))}
        placeholder="Any Language"
      />
      {creators.length > 0 && <Select value={value.creator} onChange={(v) => set('creator', v)} options={creators} placeholder="Any Creator" />}
      <select
        value={value.sort}
        onChange={(e) => set('sort', e.target.value as LibrarySortOption)}
        aria-label="Sort by"
        className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm font-bold text-stone-700 dark:text-stone-200"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            Sort: {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
