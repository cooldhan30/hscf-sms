import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import type { SmsRole } from '@/types/database'

type Role = SmsRole | 'pending'

const ROLE_HOME: Record<Role, string> = {
  admin: '/admin',
  teacher: '/teacher',
  student: '/student',
  parent: '/parent',
  pending: '/pending-approval',
}

const ROLE_PREFIXES: { prefix: string; role: SmsRole }[] = [
  { prefix: '/admin', role: 'admin' },
  { prefix: '/teacher', role: 'teacher' },
  { prefix: '/student', role: 'student' },
  { prefix: '/parent', role: 'parent' },
]

export async function applyRoleGating(
  request: NextRequest,
  userId: string | null,
  getToken: () => Promise<string | null>
) {
  const { pathname } = request.nextUrl
  const isAuthRoute = pathname === '/login' || pathname === '/sign-up'
  const isPendingRoute = pathname === '/pending-approval'
  // Stand-alone meeting tab (opened from any portal's Meetings list).
  // Any active role; the page and the token endpoint check the class.
  const isMeetingRoute = pathname.startsWith('/meeting/')
  const matchedRolePrefix = ROLE_PREFIXES.find((r) => pathname.startsWith(r.prefix))

  // Not signed in, hitting a protected route -> send to /login
  if (!userId && (matchedRolePrefix || isPendingRoute || isMeetingRoute)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  if (!userId) {
    return NextResponse.next()
  }

  // Signed in: look up their role/active status via Supabase (RLS-scoped
  // by the Clerk JWT through Supabase Third-Party Auth). Plain
  // @supabase/supabase-js, not @supabase/ssr -- see lib/supabase/server.ts
  // for why (@supabase/ssr's cookie-sync wiring is incompatible with
  // accessToken mode, and there's no cookie session to sync under Clerk).
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      accessToken: getToken,
    }
  )

  const { data: profile } = await supabase.from('sms_profiles').select('*').eq('id', userId).single()

  const role = profile?.is_active ? (profile.role as Role) : undefined

  // Every Server Component render (getCurrentProfile) used to re-run this
  // exact query a second time -- middleware and the render phase are
  // separate request contexts in Next.js, so there was no way to share an
  // in-memory cache between them. Forward the row we already fetched via
  // a header instead: same data, same request, one round-trip instead of
  // two, on every single authenticated navigation.
  const requestHeaders = new Headers(request.headers)
  // Never trust an inbound value: this header is the caller's identity as
  // far as getCurrentProfile()/RoleGuard are concerned, and the Cloudflare
  // Worker forwards client headers as-is. Without this delete, a signed-in
  // user with no profile row yet (the webhook lag window) could forge one
  // and RoleGuard -- the layer that exists specifically to survive a
  // matcher mistake here -- would believe it.
  requestHeaders.delete('x-sms-profile')
  if (profile) {
    requestHeaders.set('x-sms-profile', Buffer.from(JSON.stringify(profile)).toString('base64'))
  }

  // Signed in but visiting /login or /sign-up -> bounce to their dashboard.
  // A signed-in user with no resolvable role (no profile row yet -- the
  // webhook hasn't caught up -- or an inactive/pending account) always
  // lands on /pending-approval, never back on /login or '/': both of
  // those re-enter this same check and would loop forever.
  if (isAuthRoute) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = role ? ROLE_HOME[role] : '/pending-approval'
    return NextResponse.redirect(redirectUrl)
  }

  if (isMeetingRoute && !role) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/pending-approval'
    return NextResponse.redirect(redirectUrl)
  }

  // Signed in and hitting a role-prefixed route -> verify it's THEIR role
  // and that their account hasn't been disabled.
  if (matchedRolePrefix && role !== matchedRolePrefix.role) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = role ? ROLE_HOME[role] : '/pending-approval'
    return NextResponse.redirect(redirectUrl)
  }

  return NextResponse.next({ request: { headers: requestHeaders } })
}
