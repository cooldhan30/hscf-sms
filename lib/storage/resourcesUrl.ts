// An assignment's audio clip is played straight from its stored URL by
// every student in the class, so only accept a file uploaded to our own
// public 'resources' bucket -- never an arbitrary outside link.
export function isResourcesBucketUrl(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return false
  return url.startsWith(`${base.replace(/\/$/, '')}/storage/v1/object/public/resources/`)
}
