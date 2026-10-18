'use client'

// Calls a GameRoom Classic API route and returns either its JSON or a
// message a teacher can read. (Plain /api/... paths: the Cloudflare
// Worker forwards /api/* to this app, outside the /tamizhi basePath.)
// `code` is a machine-readable reason some routes add (e.g. WRONG_ACCOUNT).
export async function grcApi<T>(path: string, init?: { method?: string; body?: unknown; headers?: Record<string, string> }): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number; code?: string }> {
  try {
    const res = await fetch(`/api/gr-classic${path}`, {
      method: init?.method ?? 'GET',
      headers: { ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...init?.headers },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, status: res.status, code: json && typeof json.code === 'string' ? json.code : undefined, error: (json && typeof json.error === 'string' && json.error) || 'Something went wrong. Please try again.' }
    return { ok: true, data: json as T }
  } catch {
    return { ok: false, status: 0, error: "Couldn't reach the server. Check your internet connection and try again." }
  }
}
