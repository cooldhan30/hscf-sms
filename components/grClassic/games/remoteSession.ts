'use client'

import type { CheckResult, Hint, PlayResponse, PlaySession } from '@/lib/grClassic/play'

// A PlaySession whose answers live on the server. `base` is the API path
// under /api/gr-classic that owns the questions (e.g. /games/<id> for a
// teacher preview); it must offer POST <base>/check and POST <base>/hint.
// Network trouble is retried once, then reported to the game so it can
// ask the player to try again (nothing is lost: the answer wasn't taken).
// A refusal (e.g. time is up) carries the server's own message.
export function remoteSession(base: string): PlaySession {
  const post = async <T>(path: string, body: unknown): Promise<T> => {
    const wait = () => new Promise((r) => setTimeout(r, 600))
    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response
      try {
        res = await fetch(`/api/gr-classic${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      } catch (e) {
        if (attempt === 1) throw e
        await wait()
        continue
      }
      if (res.ok) return (await res.json()) as T
      // 4xx won't get better by retrying; a 5xx gets one more try.
      if (res.status < 500 || attempt === 1) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(res.status < 500 && j?.error ? j.error : `HTTP ${res.status}`)
      }
      await wait()
    }
    throw new Error('unreachable')
  }
  return {
    check: (questionId: string, response: PlayResponse) => post<CheckResult>('/check', { questionId, response }),
    hint: (questionId: string, matched?: number[]) => post<Hint>('/hint', { questionId, matched: matched ?? [] }),
  }
}
