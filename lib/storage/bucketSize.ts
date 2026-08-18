import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// sms_resources.file_size is captured at upload time (see
// app/api/resources/route.ts), so resource storage is a plain SUM() --
// no need to touch Storage for that bucket. Assignment images have no
// such column, so this lists the bucket directly and sums real object
// sizes -- the only way to get an accurate total for a bucket that was
// never tracked in the DB. Objects live at {profile_id}/{filename}
// (migration 029), so the top-level list() call returns folders, not
// files; each folder is listed in turn for its actual file sizes.
export async function getBucketTotalSize(bucket: string): Promise<number> {
  const admin = createAdminClient()

  const { data: entries } = await admin.storage.from(bucket).list('', { limit: 1000 })
  if (!entries) return 0

  const sizes = await Promise.all(
    entries.map(async (entry) => {
      // A real object at the bucket root (id is set) vs. a folder
      // (id is null, Storage synthesizes these from path prefixes).
      if (entry.id) return entry.metadata?.size ?? 0

      const { data: files } = await admin.storage.from(bucket).list(entry.name, { limit: 1000 })
      return (files ?? []).reduce((sum, f) => sum + (f.metadata?.size ?? 0), 0)
    })
  )

  return sizes.reduce((sum, s) => sum + s, 0)
}
