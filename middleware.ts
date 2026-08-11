import { clerkMiddleware } from '@clerk/nextjs/server'
import { applyRoleGating } from '@/lib/supabase/middleware'

export default clerkMiddleware(async (auth, request) => {
  const { userId, getToken } = await auth()
  return applyRoleGating(request, userId, getToken)
})

export const config = {
  matcher: [
    // The negated-lookahead pattern below doesn't match the bare basePath
    // root (i.e. exactly /tamizhi, no trailing path) -- a known Next.js
    // limitation when basePath is set (vercel/next.js#73786). Without this
    // explicit '/' entry, middleware never runs for that one URL, so
    // Clerk's auth() throws ("can't detect usage of clerkMiddleware()")
    // and the page 500s. Confirmed broken without this: 2026-08-04.
    '/',
    /*
     * Match all request paths except for static assets and image optimization.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
