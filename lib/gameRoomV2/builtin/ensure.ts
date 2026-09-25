import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncBuiltinContent } from './sync'

// Makes sure the built-in catalog is present in the database before a
// page that lists or plays it renders. At most one sync per server
// instance per content version: the first call does a single SELECT
// (and, only after a content change, an upsert); later calls reuse the
// settled promise. A failure is logged and forgotten so the next request
// retries -- it never breaks the page (already-synced content still
// renders from the database).
let pending: Promise<void> | null = null

export function ensureBuiltinContent(): Promise<void> {
  if (!pending) {
    pending = syncBuiltinContent(createAdminClient())
      .then((result) => {
        if (result.status === 'synced') console.info('[gameroom-v2/builtin] synced built-in content', result)
        if (result.status === 'skipped') {
          console.warn('[gameroom-v2/builtin] built-in content sync skipped', result.reason)
          pending = null
        }
      })
      .catch((err: { code?: string; message?: string }) => {
        console.error('[gameroom-v2/builtin] built-in content sync failed', { code: err?.code, message: err?.message })
        pending = null
      })
  }
  return pending
}
