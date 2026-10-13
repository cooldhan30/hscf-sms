'use client'

// Calls a GameRoom Classic API route and returns either its JSON or a
// message a teacher can read. (Plain /api/... paths: the Cloudflare
// Worker forwards /api/* to this app, outside the /tamizhi basePath.)
export async function grcApi<T>(path: string, init?: { method?: string; body?: unknown }): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/gr-classic${path}`, {
      method: init?.method ?? 'GET',
      headers: init?.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: (json && typeof json.error === 'string' && json.error) || 'Something went wrong. Please try again.' }
    return { ok: true, data: json as T }
  } catch {
    return { ok: false, error: "Couldn't reach the server. Check your internet connection and try again." }
  }
}
