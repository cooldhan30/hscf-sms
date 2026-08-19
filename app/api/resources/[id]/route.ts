import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import { optionalString } from '@/lib/validation'
import { validateResourceTaxonomy } from '@/lib/validateResourceTaxonomy'

// PATCH /api/resources/[id] -- edit a resource. Any teacher or admin can
// edit categorization (category/subcategory/levels/skills/difficulty/
// tags/description) and the title on ANY resource, since most of the
// shared library wasn't uploaded by whoever needs to maintain it -- RLS
// ("resources: teacher manage any") permits this broadly. class_id is
// more like "moving someone else's upload", a placement/ownership
// decision, so that alone stays owner-or-admin only, enforced here at
// the app layer since RLS can't distinguish which columns changed.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const supabase = createClient()

  const { data: profile } = await supabase.from('sms_profiles').select('role').eq('id', userId).single()
  const { data: existing } = await supabase.from('sms_resources').select('created_by').eq('id', params.id).single()
  if (!existing) {
    return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
  }
  const isOwnerOrAdmin = profile?.role === 'admin' || existing.created_by === userId

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!isOwnerOrAdmin && 'classId' in body) {
    return NextResponse.json({ error: 'Only the uploader or an admin can move this resource to a different class' }, { status: 403 })
  }

  const errors: string[] = []
  const updates: Record<string, unknown> = {}
  if ('title' in body) updates.title = (optionalString(body.title) ?? '').trim() || undefined
  if ('description' in body) updates.description = optionalString(body.description)
  if ('classId' in body) updates.class_id = optionalString(body.classId)

  const taxonomy = validateResourceTaxonomy(body, errors)
  updates.category = taxonomy.category
  updates.subcategory = taxonomy.subcategory
  updates.difficulty = taxonomy.difficulty
  updates.format = taxonomy.format
  updates.levels = taxonomy.levels
  updates.skills = taxonomy.skills
  updates.tags = taxonomy.tags

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }
  if (updates.title === undefined) {
    delete updates.title
  }

  const { data, error } = await supabase
    .from('sms_resources')
    .update(updates)
    .eq('id', params.id)
    .select('*, class:sms_classes(id, name), uploader:sms_profiles(first_name, last_name)')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Resource not found' }, { status: 404 })
  }

  return NextResponse.json({ resource: data })
}

// DELETE /api/resources/[id] -- admin can delete any resource; a
// teacher only their own (created_by). RLS ("resources: teacher delete
// own" / "resources: admin all") is the real enforcement -- the delete
// itself will simply affect 0 rows if this teacher doesn't own it, which
// is surfaced below as a 404 rather than a silent no-op.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const supabase = createClient()

  const { data, error } = await supabase.from('sms_resources').delete().eq('id', params.id).select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Resource not found, or you can only delete resources you uploaded' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
