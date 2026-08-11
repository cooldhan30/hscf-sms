import { auth } from '@clerk/nextjs/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Server-side Supabase client for use in Server Components, Route Handlers,
// and Server Actions. Authenticated with the Clerk session JWT (Supabase
// Third-Party Auth resolves auth.jwt()->>'sub' from it) -- there is no
// Supabase-managed session cookie anymore, Clerk owns the session.
//
// Deliberately plain @supabase/supabase-js, NOT @supabase/ssr:
// @supabase/ssr's cookie-sync wiring calls supabase.auth.onAuthStateChange
// internally, which throws ("Supabase Client is configured with the
// accessToken option, accessing supabase.auth.onAuthStateChange is not
// possible") as soon as you also pass accessToken. There's no cookie
// session to sync anyway under Clerk, so @supabase/ssr adds nothing here.
//
// Still uses the anon key -- RLS is what actually scopes access.
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      accessToken: async () => (await auth()).getToken(),
    }
  )
}
