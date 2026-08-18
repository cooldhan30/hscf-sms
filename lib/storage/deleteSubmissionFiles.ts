import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteB2Object } from '@/lib/storage/b2'

// A submission's file/audio can be on either provider (see migration
// 040) -- unlike the single-bucket helpers for resources/assignment
// images, this branches on storage_provider to call the right one.
// file_url/audio_url are raw storage paths here (not public URLs, since
// 'submissions' is a private bucket), so no URL-parsing is needed the
// way deletePublicObject.ts needs it. Best-effort: a missing path or a
// Storage/B2 error should never block deleting the row itself.
export async function deleteSubmissionFiles(submission: {
  file_url: string | null
  audio_url: string | null
  storage_provider: string
}): Promise<void> {
  const paths = [submission.file_url, submission.audio_url].filter((p): p is string => Boolean(p))
  if (paths.length === 0) return

  if (submission.storage_provider === 'b2') {
    await Promise.all(paths.map((p) => deleteB2Object(p).catch(() => {})))
  } else {
    const admin = createAdminClient()
    await admin.storage.from('submissions').remove(paths)
  }
}
