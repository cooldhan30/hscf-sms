'use client'

import { useAuth } from '@clerk/nextjs'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { useMemo } from 'react'

// Browser-side counterpart to lib/supabase/server.ts's createClient --
// same accessToken pattern, but sourced from Clerk's client-side
// useAuth() since there's no server request to call auth() on. Needed
// for anything that must run in the browser: Storage uploads (so large
// audio/file blobs don't get proxied through a Next.js route handler)
// and Realtime subscriptions (which are inherently client-side).
//
// Exposed as a hook, not a bare factory, so the returned client's
// accessToken callback always calls the current render's getToken --
// a module-level singleton would close over a stale token getter.
export function useSupabaseBrowserClient(): SupabaseClient {
  const { getToken } = useAuth()

  return useMemo(
    () =>
      createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        accessToken: async () => getToken(),
      }),
    [getToken]
  )
}
