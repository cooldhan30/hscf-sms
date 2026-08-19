import 'server-only'
import {
  RESOURCE_CATEGORIES,
  RESOURCE_SKILLS,
  RESOURCE_DIFFICULTIES,
  RESOURCE_FORMATS,
  subcategoriesFor,
} from '@/lib/resourceTaxonomy'
import { GRADE_LEVEL_OPTIONS } from '@/lib/constants'

const CATEGORY_VALUES = new Set(RESOURCE_CATEGORIES.map((c) => c.value))
const SKILL_VALUES = new Set(RESOURCE_SKILLS.map((s) => s.value))
const DIFFICULTY_VALUES = new Set(RESOURCE_DIFFICULTIES.map((d) => d.value))
const FORMAT_VALUES = new Set(RESOURCE_FORMATS.map((f) => f.value))
const LEVEL_VALUES = new Set(GRADE_LEVEL_OPTIONS.map((l) => l.value))

export interface ResourceTaxonomyFields {
  category: string | null
  subcategory: string | null
  difficulty: 'easy' | 'medium' | 'hard' | null
  format: string | null
  levels: string[]
  skills: string[]
  tags: string[]
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim())
}

// Shared by POST (create) and PATCH (edit) -- every field here is
// optional (a resource can be left uncategorized), but any value that
// IS provided must be one of the known taxonomy values from
// lib/resourceTaxonomy.ts / lib/constants.ts. Tags are free-form (a
// teacher can type anything), everything else is a closed vocabulary
// enforced here rather than a DB CHECK constraint, matching the "add a
// new subcategory without a migration" goal.
export function validateResourceTaxonomy(body: Record<string, unknown>, errors: string[]): ResourceTaxonomyFields {
  const category = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : null
  if (category && !CATEGORY_VALUES.has(category as never)) {
    errors.push('Invalid category')
  }

  const subcategory = typeof body.subcategory === 'string' && body.subcategory.trim() ? body.subcategory.trim() : null
  if (subcategory && !subcategoriesFor(category).some((s) => s.value === subcategory)) {
    errors.push('Invalid subcategory for the selected category')
  }

  const difficulty = typeof body.difficulty === 'string' && body.difficulty.trim() ? body.difficulty.trim() : null
  if (difficulty && !DIFFICULTY_VALUES.has(difficulty as never)) {
    errors.push('Invalid difficulty')
  }

  const format = typeof body.format === 'string' && body.format.trim() ? body.format.trim() : null
  if (format && !FORMAT_VALUES.has(format as never)) {
    errors.push('Invalid format')
  }

  const levels = stringArray(body.levels)
  if (levels.some((l) => !LEVEL_VALUES.has(l as never))) {
    errors.push('Invalid level in levels list')
  }

  const skills = stringArray(body.skills)
  if (skills.some((s) => !SKILL_VALUES.has(s as never))) {
    errors.push('Invalid skill in skills list')
  }

  const tags = stringArray(body.tags)

  return {
    category,
    subcategory,
    difficulty: difficulty as 'easy' | 'medium' | 'hard' | null,
    format,
    levels,
    skills,
    tags,
  }
}
