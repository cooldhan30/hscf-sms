import 'server-only'
import type { createClient } from '@/lib/supabase/server'
import { usageCountMapFromRows } from '@/lib/gameRoomV2/questionSetUsageRows'

// Usage count (DUPLICATE + ASSIGN events) for every given set, in ONE
// round trip via the batched RPC from migration 084. Previously both the
// Library page and GET /api/gameroom-v2/question-sets called the
// single-set RPC once per set -- N round trips per Library load.
//
// Falls back to the per-set RPC if the batched function isn't in the
// database yet (migration 084 not applied), so this is safe to deploy
// ahead of the migration.
export async function fetchQuestionSetUsageCounts(supabase: ReturnType<typeof createClient>, setIds: string[]): Promise<Map<string, number>> {
  const ids = Array.from(new Set(setIds))
  if (ids.length === 0) return new Map()

  const { data, error } = await supabase.rpc('sms_gamev2_question_set_usage_counts', { p_question_set_ids: ids })
  if (!error) return usageCountMapFromRows(ids, data)

  const perSet = await Promise.all(
    ids.map(async (id) => {
      const { data: count } = await supabase.rpc('sms_gamev2_question_set_usage_count', { p_question_set_id: id })
      return [id, typeof count === 'number' ? count : 0] as const
    })
  )
  return new Map(perSet)
}
