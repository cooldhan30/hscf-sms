import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getB2ReadUrl } from '@/lib/storage/b2'

// The one place that turns a sms_submissions file_url/audio_url path
// into an actual signed link, branching on which provider that row's
// bytes live on. Used by every reader of the 'submissions' bucket: the
// student's own assignment page, the teacher's gradebook, and the
// generic /api/storage/read-url route.
export async function getSubmissionSignedUrl(
  supabase: SupabaseClient,
  path: string,
  provider: string,
  ttlSeconds: number
): Promise<string | null> {
  if (provider === 'b2') {
    return getB2ReadUrl(path, ttlSeconds)
  }
  const { data } = await supabase.storage.from('submissions').createSignedUrl(path, ttlSeconds)
  return data?.signedUrl ?? null
}
