// What a student can hand in for an assignment (sms_assignments.allow_submission_types).
// 'photo' (migration 106) is a picture of their written work, stored like
// any other submitted file in sms_submissions.file_url.
export const SUBMISSION_TYPES = ['text', 'file', 'audio', 'photo'] as const
export type SubmissionType = (typeof SUBMISSION_TYPES)[number]

export const DEFAULT_SUBMISSION_TYPES: SubmissionType[] = ['text', 'file', 'audio']
export const PHOTO_SUBMISSION_TYPES: SubmissionType[] = ['photo']

export function isPhotoOnly(types: string[] | null | undefined): boolean {
  return Array.isArray(types) && types.length === 1 && types[0] === 'photo'
}

// A known, non-empty list from a request body, or null if it isn't one.
export function parseSubmissionTypes(value: unknown): SubmissionType[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const known = new Set<string>(SUBMISSION_TYPES)
  if (!value.every((v) => typeof v === 'string' && known.has(v))) return null
  return Array.from(new Set(value as SubmissionType[]))
}
