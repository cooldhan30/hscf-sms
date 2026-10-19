'use client'

// A GameRoom Classic page address on this same site, keeping the base path
// this page is served under (e.g. /tamizhi on tamilschoolfl.org), for
// full-page navigations and links shown to others (the join QR code).
// The base never ends in "/", so the result never starts with "//" --
// which a browser would read as another website.
export function appPath(path: string): string {
  const base = window.location.pathname.split('/gr-classic')[0].replace(/\/+$/, '')
  return `${base}${path}`
}
