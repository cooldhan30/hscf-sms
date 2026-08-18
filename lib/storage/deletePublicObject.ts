import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// Public bucket URLs look like
// {supabase-url}/storage/v1/object/public/{bucket}/{path}. Deleting a
// row that references one (an assignment's image, say) doesn't touch
// the underlying Storage object -- there's no FK/CASCADE between a text
// column and storage.objects -- so anything that actually wants to free
// the space has to parse the path back out and remove it explicitly.
// Best-effort: a missing/malformed URL or a Storage error here should
// never block deleting the row itself.
export async function deletePublicStorageObject(bucket: string, publicUrl: string | null): Promise<void> {
  if (!publicUrl) return

  const marker = `/storage/v1/object/public/${bucket}/`
  const index = publicUrl.indexOf(marker)
  if (index === -1) return

  const path = decodeURIComponent(publicUrl.slice(index + marker.length))
  if (!path) return

  const admin = createAdminClient()
  await admin.storage.from(bucket).remove([path])
}
