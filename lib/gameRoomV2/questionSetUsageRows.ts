// Pure half of questionSetUsage.ts (kept separate so the verify script
// can import it without 'server-only'): turns the batched RPC's rows into
// a count for EVERY requested id -- a set with no usage has no row, and
// must read as 0, never undefined.
export function usageCountMapFromRows(requestedIds: string[], rows: unknown): Map<string, number> {
  const counts = new Map<string, number>(requestedIds.map((id) => [id, 0]))
  if (!Array.isArray(rows)) return counts
  for (const row of rows as { question_set_id?: unknown; usage_count?: unknown }[]) {
    if (typeof row?.question_set_id === 'string' && counts.has(row.question_set_id)) {
      counts.set(row.question_set_id, typeof row.usage_count === 'number' ? row.usage_count : Number(row.usage_count) || 0)
    }
  }
  return counts
}
