import 'server-only'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

export type FieldType = 'string' | 'number' | 'boolean'
export type FieldSpec = Record<string, FieldType>

// Shared CRUD shape for the simple admin-managed reference lists in
// Settings (grade levels, sections, calendar events, email templates).
// Each is already admin-only at the RLS layer (migration 013); the
// fieldSpec whitelist keeps requests from writing unexpected columns
// (id, created_at, ...) and coerces values -- form fields from
// ListManager always arrive as strings, but sort_order/is_active columns
// are numeric/boolean, so a raw passthrough would send the wrong type.
export function createListHandlers(table: string, orderColumn: string) {
  async function GET() {
    const guard = await requireAdmin()
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

    const admin = createAdminClient()
    const { data, error } = await admin.from(table).select('*').order(orderColumn)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ items: data })
  }

  function POST(fieldSpec: FieldSpec) {
    return async (request: Request) => {
      const guard = await requireAdmin()
      if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

      const body = await request.json().catch(() => null)
      if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

      const insertData = pick(body, fieldSpec)
      const admin = createAdminClient()
      const { data, error } = await admin.from(table).insert([insertData]).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ item: data }, { status: 201 })
    }
  }

  return { GET, POST }
}

export function createItemHandlers(table: string) {
  function PATCH(fieldSpec: FieldSpec) {
    return async (request: Request, { params }: { params: { id: string } }) => {
      const guard = await requireAdmin()
      if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

      const body = await request.json().catch(() => null)
      if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

      const updateData = pick(body, fieldSpec)
      const admin = createAdminClient()
      const { data, error } = await admin.from(table).update(updateData).eq('id', params.id).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ item: data })
    }
  }

  async function DELETE(_request: Request, { params }: { params: { id: string } }) {
    const guard = await requireAdmin()
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

    const admin = createAdminClient()
    const { error } = await admin.from(table).delete().eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  return { PATCH, DELETE }
}

function pick(body: Record<string, unknown>, fieldSpec: FieldSpec): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, type] of Object.entries(fieldSpec)) {
    if (!(key in body)) continue
    const raw = body[key]
    // number/boolean columns here (sort_order, is_active, is_current) are
    // all NOT NULL with a DB default -- a blank form field must coerce to
    // a real 0/false, not null, or the insert violates the NOT NULL
    // constraint despite the column having a default value.
    if (type === 'number') {
      result[key] = raw === null || raw === '' ? 0 : Number(raw)
    } else if (type === 'boolean') {
      result[key] = raw === true || raw === 'true'
    } else if (raw === null || raw === '') {
      result[key] = null
    } else {
      result[key] = String(raw)
    }
  }
  return result
}
