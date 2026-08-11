import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import { roleHomePath } from '@/lib/role-home-path'
import type { SmsRole } from '@/types/database'

// POST /api/me/active-role -- switch which portal you are acting in.
// Body: { role }
//
// Deliberately uses the caller's own RLS-scoped client, not the service
// role: sms_switch_active_role() derives the profile from the session
// and refuses any role the caller was not granted, so there is no
// argument here that could switch somebody else, and no path that could
// grant a role that isn't already held.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const role = body?.role

  if (typeof role !== 'string') {
    return NextResponse.json({ error: 'Role is required' }, { status: 400 })
  }

  const supabase = createClient()

  const { data, error } = await supabase.rpc('sms_switch_active_role', { p_role: role })

  if (error) {
    // The function raises for a role the caller doesn't hold, which is a
    // permission problem rather than a malformed request.
    return NextResponse.json({ error: error.message }, { status: 403 })
  }

  return NextResponse.json({ role: data, redirectTo: roleHomePath(data as SmsRole) })
}
