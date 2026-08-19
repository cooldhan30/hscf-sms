'use client'

import { useMemo } from 'react'
import {
  RESOURCE_CATEGORIES,
  RESOURCE_SKILLS,
  RESOURCE_DIFFICULTIES,
  RESOURCE_FORMATS,
  SUGGESTED_TAGS,
  subcategoriesFor,
} from '@/lib/resourceTaxonomy'
import { GRADE_LEVEL_OPTIONS } from '@/lib/constants'

export interface TaxonomyState {
  category: string
  subcategory: string
  difficulty: string
  format: string
  levels: string[]
  skills: string[]
  tags: string[]
}

export const EMPTY_TAXONOMY: TaxonomyState = {
  category: '',
  subcategory: '',
  difficulty: '',
  format: '',
  levels: [],
  skills: [],
  tags: [],
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
        active
          ? 'border-primary-600 bg-primary-50 dark:bg-primary-950/40 text-primary-800 dark:text-primary-300'
          : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
      }`}
    >
      {children}
    </button>
  )
}

// Category/subcategory/difficulty/format/levels/skills/tags -- the same
// set of fields for both the upload form and the edit form, so the two
// stay in sync automatically instead of drifting apart as two separate
// copies of this markup.
export function ResourceTaxonomyFields({
  value,
  onChange,
}: {
  value: TaxonomyState
  onChange: (next: TaxonomyState) => void
}) {
  const subcategoryOptions = useMemo(() => subcategoriesFor(value.category || null), [value.category])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Category</label>
          <select
            value={value.category}
            onChange={(e) => onChange({ ...value, category: e.target.value, subcategory: '' })}
            className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          >
            <option value="">Uncategorized</option>
            {RESOURCE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Subcategory</label>
          <select
            value={value.subcategory}
            onChange={(e) => onChange({ ...value, subcategory: e.target.value })}
            disabled={!value.category}
            className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent disabled:opacity-50"
          >
            <option value="">None</option>
            {subcategoryOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Difficulty</label>
          <select
            value={value.difficulty}
            onChange={(e) => onChange({ ...value, difficulty: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          >
            <option value="">Not set</option>
            {RESOURCE_DIFFICULTIES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Format</label>
          <select
            value={value.format}
            onChange={(e) => onChange({ ...value, format: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          >
            <option value="">Not set</option>
            {RESOURCE_FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Levels</label>
        <div className="flex flex-wrap gap-2">
          {GRADE_LEVEL_OPTIONS.map((l) => (
            <Chip key={l.value} active={value.levels.includes(l.value)} onClick={() => onChange({ ...value, levels: toggle(value.levels, l.value) })}>
              {l.label}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Learning Skills</label>
        <div className="flex flex-wrap gap-2">
          {RESOURCE_SKILLS.map((s) => (
            <Chip key={s.value} active={value.skills.includes(s.value)} onClick={() => onChange({ ...value, skills: toggle(value.skills, s.value) })}>
              {s.label}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Tags</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {SUGGESTED_TAGS.map((t) => (
            <Chip key={t} active={value.tags.includes(t)} onClick={() => onChange({ ...value, tags: toggle(value.tags, t) })}>
              {t}
            </Chip>
          ))}
        </div>
        <input
          type="text"
          placeholder="Type a tag and press Enter"
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            const next = e.currentTarget.value.trim()
            if (next && !value.tags.includes(next)) {
              onChange({ ...value, tags: [...value.tags, next] })
            }
            e.currentTarget.value = ''
          }}
          className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
        />
        {value.tags.filter((t) => !SUGGESTED_TAGS.includes(t)).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {value.tags
              .filter((t) => !SUGGESTED_TAGS.includes(t))
              .map((t) => (
                <Chip key={t} active onClick={() => onChange({ ...value, tags: toggle(value.tags, t) })}>
                  {t} &times;
                </Chip>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
