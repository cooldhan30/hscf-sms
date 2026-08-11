import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// SERVER-ONLY. Uses the service_role key, which bypasses Row Level Security
// entirely. Must never be imported from a Client Component or exposed to
// the browser. Reserved for privileged admin operations: creating auth
// users/invites, approving registrations, and other actions a plain
// authenticated user should never be able to perform directly.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for admin client'
    )
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
