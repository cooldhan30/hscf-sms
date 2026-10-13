import { NextResponse } from 'next/server'
import { dbErrorResponse, grcTeacherApi, readJson } from '@/lib/grClassic/server/auth'
import { listCategories } from '@/lib/grClassic/server/db'
import { clean } from '@/lib/grClassic/validateQuestion'

// GET  /api/gr-classic/categories -- starter topics + the teacher's own.
// POST /api/gr-classic/categories { name } -- add a topic. If a topic with
// that name already exists (any letter case), that one is returned.
export async function GET() {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  return NextResponse.json({ categories: await listCategories(guard.supabase, guard.userId) })
}

export async function POST(request: Request) {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  const body = await readJson(request)
  const name = clean(body?.name)
  if (!name || name.length > 80) return NextResponse.json({ error: 'A topic name needs 1 to 80 characters.' }, { status: 400 })

  const existing = (await listCategories(guard.supabase, guard.userId)).find((c) => c.name.toLocaleLowerCase() === name.toLocaleLowerCase())
  if (existing) return NextResponse.json({ category: existing })

  const { data, error } = await guard.supabase.from('sms_grc_categories').insert({ name, owner_id: guard.userId }).select('id, name').single()
  if (error) return dbErrorResponse(error, 'create topic')
  return NextResponse.json({ category: { id: data.id, name: data.name, own: true } }, { status: 201 })
}
