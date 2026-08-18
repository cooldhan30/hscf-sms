import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'assignment-images'

// GET /api/admin/storage/orphaned-images -- every object in the
// assignment-images bucket whose path isn't referenced by any current
// assignment's image_url. Deleting an assignment removes its image
// (deletePublicStorageObject), but images that were replaced/re-uploaded
// on the same assignment, or removed back when cleanup didn't run,
// leave the old object behind with nothing pointing to it -- these are
// pure wasted space an admin can safely delete.
export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const admin = createAdminClient()

  const [{ data: assignments }, { data: topLevel }] = await Promise.all([
    admin.from('sms_assignments').select('image_url').not('image_url', 'is', null),
    admin.storage.from(BUCKET).list('', { limit: 1000 }),
  ])

  const referencedPaths = new Set(
    (assignments ?? [])
      .map((a) => {
        const marker = `/storage/v1/object/public/${BUCKET}/`
        const index = (a.image_url ?? '').indexOf(marker)
        return index === -1 ? null : decodeURIComponent(a.image_url!.slice(index + marker.length))
      })
      .filter((p): p is string => p !== null)
  )

  const orphans: { path: string; size: number; uploadedAt: string | null; uploaderId: string | null }[] = []
  for (const entry of topLevel ?? []) {
    // Objects live at {profile_id}/{filename} (migration 029) -- a
    // top-level entry with no id is a synthesized folder, not a file.
    if (entry.id) continue
    const { data: files } = await admin.storage.from(BUCKET).list(entry.name, { limit: 1000 })
    for (const f of files ?? []) {
      const path = `${entry.name}/${f.name}`
      if (referencedPaths.has(path)) continue
      orphans.push({ path, size: f.metadata?.size ?? 0, uploadedAt: f.created_at ?? null, uploaderId: entry.name })
    }
  }

  const uploaderIds = Array.from(new Set(orphans.map((o) => o.uploaderId).filter((id): id is string => !!id)))
  const { data: profiles } = uploaderIds.length
    ? await admin.from('sms_profiles').select('id, first_name, last_name').in('id', uploaderIds)
    : { data: [] }
  const nameById = new Map((profiles ?? []).map((p) => [p.id, `${p.first_name} ${p.last_name}`.trim()]))

  const items = orphans.map((o) => ({
    ...o,
    uploaderName: o.uploaderId ? nameById.get(o.uploaderId) ?? 'Unknown' : 'Unknown',
  }))

  return NextResponse.json({ items })
}

// DELETE /api/admin/storage/orphaned-images -- remove one orphaned
// object by its exact storage path.
export async function DELETE(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = await request.json().catch(() => null)
  const path = body?.path
  if (typeof path !== 'string' || !path) {
    return NextResponse.json({ error: 'path is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.storage.from(BUCKET).remove([path])
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
