import { NextResponse } from 'next/server'
import { requireGameV2Teacher } from '@/lib/gameRoomV2/requireTeacherAccess'
import { requireEnum } from '@/lib/validation'

const LOGGABLE_ACTIONS = ['PREVIEW'] as const

// POST /api/gameroom-v2/question-sets/[id]/usage -- logs a usage event
// for "Recently Used" (sms_gamev2_question_set_usage, migration 075).
// Only PREVIEW is loggable through this route -- DUPLICATE and ASSIGN
// are logged by their own routes as a side effect of the action itself
// actually happening (see duplicate/route.ts), never as something a
// client could report independently of doing the real thing. This
// keeps the usage log honest: every row here reflects an action the
// server itself verified took place.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireGameV2Teacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, profile } = guard

  const body = await request.json().catch(() => ({}))
  const errors: string[] = []
  const action = requireEnum(body.action, LOGGABLE_ACTIONS, 'action', errors)
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  // Confirms the set actually exists and the caller can read it (RLS)
  // before logging -- a usage row for a set the caller has no access
  // to would be meaningless.
  const { data: set } = await supabase.from('sms_gamev2_question_sets').select('id').eq('id', params.id).maybeSingle()
  if (!set) {
    return NextResponse.json({ error: 'Question set not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('sms_gamev2_question_set_usage')
    .insert([{ question_set_id: params.id, profile_id: profile.id, action }])

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
