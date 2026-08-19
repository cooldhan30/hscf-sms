'use client'

import { useState } from 'react'
import { FiFilter, FiX, FiChevronDown } from 'react-icons/fi'
import {
  RESOURCE_CATEGORIES,
  RESOURCE_SKILLS,
  RESOURCE_DIFFICULTIES,
  RESOURCE_FORMATS,
  QUICK_FILTERS,
  subcategoriesFor,
  categoryLabel,
  subcategoryLabel,
} from '@/lib/resourceTaxonomy'
import { GRADE_LEVEL_OPTIONS } from '@/lib/constants'

export interface ResourceFilterState {
  category: string
  subcategory: string
  level: string
  skill: string
  difficulty: string
  format: string
  tags: string[]
}

export const EMPTY_FILTERS: ResourceFilterState = {
  category: '',
  subcategory: '',
  level: '',
  skill: '',
  difficulty: '',
  format: '',
  tags: [],
}

function selectClass(active: boolean) {
  return `px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent ${
    active
      ? 'border-primary-400 dark:border-primary-700 bg-primary-50 dark:bg-primary-950/40 text-primary-800 dark:text-primary-300'
      : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white'
  }`
}

// AND across filter groups (category/level/skill/difficulty/format/tags
// each narrow independently), OR within a group where multiple values
// are possible (tags). Quick filters are shorthand that set
// category/subcategory directly -- they compose with everything else
// here rather than being a separate mode.
export function ResourceFilterPanel({
  value,
  onChange,
  availableTags,
}: {
  value: ResourceFilterState
  onChange: (next: ResourceFilterState) => void
  availableTags: string[]
}) {
  const [expanded, setExpanded] = useState(false)
  const subcategoryOptions = subcategoriesFor(value.category || null)

  const activeChips: { key: keyof ResourceFilterState | 'tag'; label: string; clear: () => void }[] = []
  if (value.category) {
    activeChips.push({
      key: 'category',
      label: categoryLabel(value.category),
      clear: () => onChange({ ...value, category: '', subcategory: '' }),
    })
  }
  if (value.subcategory) {
    activeChips.push({
      key: 'subcategory',
      label: subcategoryLabel(value.category, value.subcategory) ?? value.subcategory,
      clear: () => onChange({ ...value, subcategory: '' }),
    })
  }
  if (value.level) {
    activeChips.push({
      key: 'level',
      label: GRADE_LEVEL_OPTIONS.find((l) => l.value === value.level)?.label ?? value.level,
      clear: () => onChange({ ...value, level: '' }),
    })
  }
  if (value.skill) {
    activeChips.push({
      key: 'skill',
      label: RESOURCE_SKILLS.find((s) => s.value === value.skill)?.label ?? value.skill,
      clear: () => onChange({ ...value, skill: '' }),
    })
  }
  if (value.difficulty) {
    activeChips.push({
      key: 'difficulty',
      label: RESOURCE_DIFFICULTIES.find((d) => d.value === value.difficulty)?.label ?? value.difficulty,
      clear: () => onChange({ ...value, difficulty: '' }),
    })
  }
  if (value.format) {
    activeChips.push({
      key: 'format',
      label: RESOURCE_FORMATS.find((f) => f.value === value.format)?.label ?? value.format,
      clear: () => onChange({ ...value, format: '' }),
    })
  }
  for (const t of value.tags) {
    activeChips.push({ key: 'tag', label: t, clear: () => onChange({ ...value, tags: value.tags.filter((x) => x !== t) }) })
  }

  const hasActiveFilters = activeChips.length > 0

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {QUICK_FILTERS.map((q) => {
          const active = q.subcategory
            ? value.subcategory === q.subcategory
            : q.category
              ? value.category === q.category && !value.subcategory
              : !value.category && !value.subcategory
          return (
            <button
              key={q.label}
              type="button"
              onClick={() =>
                onChange({
                  ...value,
                  category: q.category ?? (q.subcategory ? RESOURCE_CATEGORIES.find((c) => c.subcategories.some((s) => s.value === q.subcategory))?.value ?? '' : ''),
                  subcategory: q.subcategory ?? '',
                })
              }
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary-600 text-white'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
              }`}
            >
              {q.label}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-600 dark:text-stone-300 hover:text-primary-700 dark:hover:text-primary-400"
      >
        <FiFilter className="w-4 h-4" /> Filters
        <FiChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <select
            value={value.category}
            onChange={(e) => onChange({ ...value, category: e.target.value, subcategory: '' })}
            className={selectClass(!!value.category)}
          >
            <option value="">All Categories</option>
            {RESOURCE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <select
            value={value.subcategory}
            onChange={(e) => onChange({ ...value, subcategory: e.target.value })}
            disabled={!value.category}
            className={`${selectClass(!!value.subcategory)} disabled:opacity-50`}
          >
            <option value="">All Subcategories</option>
            {subcategoryOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <select value={value.level} onChange={(e) => onChange({ ...value, level: e.target.value })} className={selectClass(!!value.level)}>
            <option value="">All Levels</option>
            {GRADE_LEVEL_OPTIONS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>

          <select value={value.skill} onChange={(e) => onChange({ ...value, skill: e.target.value })} className={selectClass(!!value.skill)}>
            <option value="">All Skills</option>
            {RESOURCE_SKILLS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <select value={value.difficulty} onChange={(e) => onChange({ ...value, difficulty: e.target.value })} className={selectClass(!!value.difficulty)}>
            <option value="">All Difficulties</option>
            {RESOURCE_DIFFICULTIES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>

          <select value={value.format} onChange={(e) => onChange({ ...value, format: e.target.value })} className={selectClass(!!value.format)}>
            <option value="">All Formats</option>
            {RESOURCE_FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          {availableTags.length > 0 && (
            <div className="col-span-2 sm:col-span-3 lg:col-span-6 flex flex-wrap gap-2 pt-1">
              {availableTags.map((t) => {
                const active = value.tags.includes(t)
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onChange({ ...value, tags: active ? value.tags.filter((x) => x !== t) : [...value.tags, t] })}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      active
                        ? 'bg-primary-600 text-white'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                    }`}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip, i) => (
            <button
              key={`${chip.key}-${chip.label}-${i}`}
              type="button"
              onClick={chip.clear}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-100 dark:bg-primary-950/40 text-primary-800 dark:text-primary-300"
            >
              {chip.label} <FiX className="w-3 h-3" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="text-xs font-semibold text-stone-500 dark:text-stone-400 hover:text-terracotta-600 dark:hover:text-terracotta-400 underline underline-offset-2"
          >
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  )
}
