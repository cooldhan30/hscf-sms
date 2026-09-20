import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

// Turns a sms_grades.audio_feedback_url path into a short-lived signed
// link -- same idea as lib/storage/submissionUrl.ts's
// getSubmissionSignedUrl, but simpler: the 'grade-feedback' bucket is
// plain Supabase Storage only (never B2), since feedback clips are
// teacher-authored and far smaller/less frequent than student
// submissions, so there was no need for B2's scale here.
export async function getGradeFeedbackSignedUrl(
  supabase: SupabaseClient,
  path: string,
  ttlSeconds: number
): Promise<string | null> {
  const { data } = await supabase.storage.from('grade-feedback').createSignedUrl(path, ttlSeconds)
  return data?.signedUrl ?? null
}
