import { NextResponse } from 'next/server'
import { requireGameV2Teacher } from '@/lib/gameRoomV2/requireTeacherAccess'

// POST /api/gameroom-v2/question-sets/[id]/favorite -- adds the set to
// the caller's own favorites (sms_gamev2_favorites, migration 075).
// RLS ("gamev2_favorites: teacher manage own") scopes writes to the
// caller's own profile_id; the FK to sms_gamev2_question_sets means
// this simply fails if the set doesn't exist, and favoriting a set the
// caller can't otherwise READ is harmless (it just can't ever be
// resolved back to anything visible in their list).
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireGameV2Teacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, profile } = guard

  const { error } = await supabase
    .from('sms_gamev2_favorites')
    .upsert([{ profile_id: profile.id, question_set_id: params.id }], { onConflict: 'profile_id,question_set_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}

// DELETE /api/gameroom-v2/question-sets/[id]/favorite -- removes it.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireGameV2Teacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, profile } = guard

  const { error } = await supabase
    .from('sms_gamev2_favorites')
    .delete()
    .eq('profile_id', profile.id)
    .eq('question_set_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
