// Reverse proxy that mounts the hscf-sms app (hosted on Vercel) under
// tamilschoolfl.org/tamizhi/*. The app itself has next.config.mjs's
// `basePath: '/tamizhi'` set, so it expects incoming request paths to
// already carry the /tamizhi prefix, and it emits every Link/redirect()/
// router.push()/_next-asset URL pre-prefixed on its own -- this Worker no
// longer needs to strip or add that prefix anywhere, which is what made
// the earlier no-basePath version of this Worker fragile (client-side
// navigations like Clerk's post-sign-in redirect never touched the
// Worker at all, so header-rewriting alone couldn't fix them).
//
//   - Requests under /tamizhi/* (including its own /tamizhi/_next/...
//     assets) are forwarded to Vercel with the SAME path, unchanged.
//   - Requests to /api/* are forwarded too, but ONLY when the Referer
//     indicates the request came from a /tamizhi page (gated so this
//     never intercepts anything from the marketing site, which has no
//     /api routes of its own but could in principle add one someday).
//     Unlike /tamizhi/* these DO need the prefix added before forwarding:
//     basePath applies to the whole app, including its API route
//     handlers, so Vercel only actually has a route at
//     /tamizhi/api/me/complete-profile, not /api/me/complete-profile --
//     but the client's plain fetch('/api/...') calls are NOT auto-
//     prefixed by basePath (only Next's own Link/router/redirect/asset
//     mechanisms are), so they still request the unprefixed path. Without
//     this rewrite, every API call 404s on Vercel's side (confirmed via a
//     failed complete-profile submission: 2026-08-04).
//   - Requests to /v1/* are ALWAYS forwarded (prefixed the same way, no
//     Referer gating needed -- this is Clerk's own reserved namespace).
//     Clerk's cross-domain session-sync handshake
//     (__clerk_hs_reason=primary-domain-cross-origin-sync) navigates the
//     top-level page straight to https://<primary-domain>/v1/client/handshake
//     using nothing but the bare "Primary domain" configured in the Clerk
//     Dashboard -- Clerk's SDK has zero concept of basePath/subpath
//     mounting, so it never includes /tamizhi. Without this route, that
//     navigation 404s on IONOS instead of ever reaching the app (confirmed
//     via a real user hitting exactly this during sign-in: 2026-08-04).
//   - x-forwarded-host/-proto are set explicitly to the public domain --
//     without this, Vercel's own edge reports its own domain, which
//     doesn't match the browser's real Origin header, and Next.js's
//     Server Actions origin check rejects every POST as forged
//     (confirmed via Vercel function logs: 2026-08-04).
//   - Any redirect response's Location header gets its host swapped back
//     to the public domain -- the *path* is left untouched, since with
//     basePath configured the app already emits a correctly /tamizhi-
//     prefixed path on its own.
//
// Everything else (/, /about, /register, the marketing site's own
// unprefixed /_next/*) passes through to IONOS, completely untouched.

const APP_ORIGIN = 'https://hscf-sms.vercel.app'
const MOUNT_PATH = '/tamizhi'
const SITE_HOST = 'tamilschoolfl.org'
// Both the bare domain and www resolve here (both have matching Worker
// Routes) -- accept either as a legitimate referrer for /api/* gating,
// even though redirects always canonicalize back to the bare domain
// below. Missing the www variant here was a real bug: a visitor who
// landed on www.tamilschoolfl.org (common address-bar/browser default)
// got a genuine IONOS 404 on /tamizhi, since only the bare-domain Worker
// Routes existed. Confirmed and fixed: 2026-08-04.
const ACCEPTED_HOSTS = new Set([SITE_HOST, 'www.' + SITE_HOST])

function refererIsFromApp(request) {
  const referer = request.headers.get('Referer')
  if (!referer) return false
  try {
    const refUrl = new URL(referer)
    return ACCEPTED_HOSTS.has(refUrl.host) && (refUrl.pathname === MOUNT_PATH || refUrl.pathname.startsWith(MOUNT_PATH + '/'))
  } catch {
    return false
  }
}

function isAppRequest(pathname, request) {
  if (pathname === MOUNT_PATH || pathname.startsWith(MOUNT_PATH + '/')) return true
  if (pathname.startsWith('/v1/')) return true
  if (pathname.startsWith('/api/')) return refererIsFromApp(request)
  return false
}

const APP_ORIGIN_HOST = new URL(APP_ORIGIN).host

// Swaps any occurrence of the raw Vercel origin for the public domain in
// a URL string -- used both for the Location header itself and for a
// redirect_url query param possibly embedded inside it (see below).
function withPublicHost(rawUrl, requestUrl) {
  let u
  try {
    u = new URL(rawUrl, requestUrl)
  } catch {
    return rawUrl
  }
  if (u.host !== APP_ORIGIN_HOST) return u.toString()
  u.protocol = 'https:'
  u.host = SITE_HOST
  return u.toString()
}

// The app's own redirects (NextResponse.redirect, Next's basePath-aware
// redirect()) come back with a Location pointing at the raw Vercel
// origin, hscf-sms.vercel.app -- those need their host swapped back to
// the public domain (the path is already correctly /tamizhi-prefixed by
// the app itself). Clerk's OWN redirects (e.g. its cross-domain
// session-sync handshake) legitimately point at clerk.tamilschoolfl.org
// -- a real, different, valid domain -- and must be left otherwise
// untouched. Unconditionally rewriting every redirect's host to the
// public domain, regardless of what it originally was, was a real bug:
// it silently redirected that Clerk handshake to our own domain instead
// of Clerk's Frontend API, breaking the sync entirely and showing as a
// CAPTCHA/handshake-loop error to a real user signing in with Google.
//
// Separately, Clerk's own handshake URL embeds a `redirect_url` query
// param (where to send the browser once the handshake completes) that,
// even after the above fix, was STILL observed pointing at the raw
// Vercel origin (confirmed via a real "does not match one of the allowed
// values for parameter redirect_url" error from Clerk's servers,
// 2026-08-04) -- x-forwarded-host fixes the outer handshake URL's host
// but Clerk's SDK computes this inner param through a different code
// path that doesn't pick it up. Rather than chase why inside Clerk's
// SDK, this rewrites that embedded param directly too, wherever it
// appears in any redirect Location this Worker sees.
function rewriteLocation(rawLocation, requestUrl) {
  let target
  try {
    target = new URL(rawLocation, requestUrl)
  } catch {
    return rawLocation
  }

  const redirectUrl = target.searchParams.get('redirect_url')
  if (redirectUrl) {
    target.searchParams.set('redirect_url', withPublicHost(redirectUrl, requestUrl))
  }

  if (target.host !== APP_ORIGIN_HOST) return target.toString()
  return withPublicHost(target.toString(), requestUrl)
}

export default {
  async fetch(request) {
    const url = new URL(request.url)

    if (!isAppRequest(url.pathname, request)) {
      // Not an SMS-app path -- let it fall through to the zone's normal
      // origin (IONOS) by declining to handle it. In a Worker attached via
      // a Route, returning nothing isn't valid, so this Worker should only
      // be routed for the specific patterns in the README, not the whole
      // zone; this branch is a safety net in case the route is ever made
      // too broad.
      return fetch(request)
    }

    const upstream = new URL(request.url)
    upstream.protocol = 'https:'
    upstream.host = new URL(APP_ORIGIN).host
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/v1/')) {
      upstream.pathname = MOUNT_PATH + url.pathname
    }

    const upstreamRequest = new Request(upstream.toString(), request)
    upstreamRequest.headers.set('X-Forwarded-Host', SITE_HOST)
    upstreamRequest.headers.set('X-Forwarded-Proto', 'https')

    // Every app response is per-user/authenticated (there's no public,
    // shareable content anywhere under /tamizhi, /api, or /v1), but
    // Cloudflare's edge cache doesn't know that on its own -- Cloudflare's
    // default cache key is URL-only and does NOT vary by the `Vary`
    // header Next.js sets to distinguish a full HTML document from an RSC
    // payload at the identical URL (client-side router.refresh() and
    // plain navigations hit the exact same path with different Accept/
    // RSC headers). Confirmed as a real bug: an admin's approve/reject
    // action wrote successfully every time, but the next load of the same
    // URL -- from any client, including a plain router.refresh() -- could
    // still get served whatever response Cloudflare had already cached
    // for that URL. `cacheTtl: 0` forces Cloudflare to never cache this
    // subrequest's response, regardless of what Cache-Control the origin
    // sends. Static hashed assets (/tamizhi/_next/static/...) are exempt
    // since those are genuinely safe (and useful) to cache. 2026-08-08.
    const isStaticAsset = url.pathname.includes('/_next/static/') || url.pathname.startsWith('/_next/image')
    const response = await fetch(upstreamRequest, isStaticAsset ? undefined : { cf: { cacheTtl: 0, cacheEverything: false } })

    // Belt-and-suspenders on top of cacheTtl above: cacheTtl controls
    // whether Cloudflare's edge cache STORES this response, but a stored
    // entry can still be served via a 304 revalidation against the
    // origin's own ETag/Last-Modified -- and Vercel's ETag for a
    // per-session authenticated page isn't guaranteed to vary by session,
    // so a revalidation could in principle reuse one admin's cached body
    // for a different admin. Explicitly overwriting Cache-Control here
    // (and stripping any validator that a revalidation could key off of)
    // makes every cache in the chain -- Cloudflare, any intermediate
    // proxy, the browser itself -- treat this as genuinely
    // never-cacheable, not just "cache but double-check first". Static
    // assets are exempt, same as above. 2026-08-08.
    const newHeaders = new Headers(response.headers)
    if (!isStaticAsset) {
      newHeaders.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
      newHeaders.delete('ETag')
      newHeaders.delete('Last-Modified')
    }

    const location = newHeaders.get('Location')
    if (location && response.status >= 300 && response.status < 400) {
      newHeaders.set('Location', rewriteLocation(location, request.url))
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    })
  },
}
