import { summarize, type ImportRow } from './csv'
import { clean, validateQuestion, type ValidQuestion } from './validateQuestion'
import type { Category } from './types'

export type PlanStatus = 'ok' | 'duplicate' | 'error'

export interface PlanRow {
  line: number
  status: PlanStatus
  errors: string[]
  summary: string
  topic: string
  newTopic: boolean
  value?: ValidQuestion
}

// Decides what happens to each CSV row: imported, skipped as a duplicate
// (already in the library, or earlier in the same file), or rejected with
// reasons. Pure -- `hash` turns a content key into the stored fingerprint.
export function planImport(rows: ImportRow[], existingKeys: Set<string>, categories: Category[], hash: (key: string) => string): PlanRow[] {
  const seen = new Set<string>()
  const byName = new Map(categories.map((c) => [c.name.toLocaleLowerCase(), c]))
  return rows.map((row) => {
    const topic = clean(row.topic)
    const known = topic ? byName.get(topic.toLocaleLowerCase()) : undefined
    const summary = summarize(row.input) || '(empty row)'
    const errors: string[] = []
    if (topic.length > 80) errors.push('The topic can be at most 80 characters.')
    const v = validateQuestion({ ...row.input, categoryId: null })
    if (!v.ok) errors.push(...v.errors)
    if (errors.length || !v.ok) return { line: row.line, status: 'error', errors, summary, topic, newTopic: false }
    const key = hash(v.value.contentKey)
    const dup = existingKeys.has(key) || seen.has(key)
    seen.add(key)
    return {
      line: row.line,
      status: dup ? 'duplicate' : 'ok',
      errors: dup ? [existingKeys.has(key) ? 'Already in your library.' : 'Same as an earlier row in this file.'] : [],
      summary,
      topic: known?.name ?? topic,
      newTopic: Boolean(topic) && !known,
      value: v.value,
    }
  })
}
