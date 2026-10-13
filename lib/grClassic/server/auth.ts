import 'server-only'
import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireTeacher } from '@/lib/require-teacher'
import { isGrClassicEnabled } from '../release'

// GameRoom Classic access checks. They reuse the portal's own teacher
// check (lib/require-teacher.ts) and the caller's RLS-scoped Supabase
// client -- the sms_grc_* RLS policies (migration 094) are the real
// boundary; these give clean errors and a 404 while the module is off.

type Teacher = { ok: true; supabase: SupabaseClient; userId: string }

export async function grcTeacherApi(): Promise<Teacher | { ok: false; response: NextResponse }> {
  if (!isGrClassicEnabled()) return { ok: false, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const guard = await requireTeacher()
  if (!guard.ok) return { ok: false, response: NextResponse.json({ error: guard.error }, { status: guard.status }) }
  return { ok: true, supabase: guard.supabase, userId: guard.profile.id }
}

// For teacher pages: signed-out visitors go to the login page; signed-in
// non-teachers get a friendly message instead of the page.
export async function grcTeacherPage(path: string): Promise<Teacher | { ok: false; error: string }> {
  const { userId } = await auth()
  if (!userId) redirect(`/login?next=${encodeURIComponent(path)}`)
  const guard = await requireTeacher()
  if (!guard.ok) return { ok: false, error: guard.error }
  return { ok: true, supabase: guard.supabase, userId: guard.profile.id }
}

// Turns a database error into a message a teacher can act on, without
// leaking internals.
export function dbErrorResponse(error: { code?: string; message?: string }, context: string): NextResponse {
  if (error.code === '23505') return NextResponse.json({ error: 'You already have this question in your library.' }, { status: 409 })
  const msg = error.message ?? ''
  if (msg.startsWith('GameRoom Classic: ')) return NextResponse.json({ error: msg.slice('GameRoom Classic: '.length) }, { status: 400 })
  if (error.code === '42501') return NextResponse.json({ error: 'You can only change your own questions and games.' }, { status: 403 })
  console.error(`GameRoom Classic ${context} failed:`, error)
  return NextResponse.json({ error: 'Something went wrong while saving. Please try again.' }, { status: 500 })
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const body = await request.json().catch(() => null)
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null
}
