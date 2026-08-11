/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Mounted at tamilschoolfl.org/tamizhi via a Cloudflare Worker that
  // forwards the request as-is (no path stripping) to this Vercel
  // deployment. basePath makes Next itself prefix every Link, redirect(),
  // router.push(), and _next/static asset URL with /tamizhi automatically
  // -- without it, client-side navigations (Clerk's post-sign-in
  // redirect, router.push() calls) bypass the Worker entirely and land
  // on the bare domain root, and this app's own _next/static requests
  // collide with the (also Next.js) marketing site's asset paths on the
  // same domain. Plain fetch('/api/...') calls are NOT auto-prefixed by
  // basePath, which is why the Worker separately forwards /api/* too.
  basePath: '/tamizhi',
  // The app is reverse-proxied at tamilschoolfl.org/tamizhi (via a
  // Cloudflare Worker forwarding to this Vercel deployment) -- Vercel's
  // own edge sets x-forwarded-host to this deployment's own domain
  // regardless of what the Worker forwards, so Next.js's Server Actions
  // origin check (which compares the browser's real Origin header against
  // x-forwarded-host) rejects every POST as cross-origin. This explicitly
  // allowlists the public-facing domain instead.
  experimental: {
    serverActions: {
      allowedOrigins: ['tamilschoolfl.org'],
    },
    // Next 14's client-side Router Cache otherwise keeps a `dynamic`
    // (force-dynamic) page's last-rendered payload around for 30s and
    // serves it on the next soft navigation into that route, even though
    // the route itself is never server/CDN-cached. Confirmed as a real
    // bug: admin approves/rejects a registration (a normal, durable
    // service-role UPDATE), signs out and back in in quick succession
    // (both client-side navigations, not full reloads), and briefly sees
    // the pre-update list again. Setting dynamic staleTime to 0 makes
    // every dynamic route always refetch. 2026-08-08.
    staleTimes: {
      dynamic: 0,
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default nextConfig;
