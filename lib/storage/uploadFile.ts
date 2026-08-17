'use client'

import type { SupabaseClient } from '@supabase/supabase-js'

export type UploadBucket = 'profile-pictures' | 'assignment-images' | 'submissions'

export interface UploadResult {
  path: string
  provider: 'supabase' | 'b2'
  publicUrl: string | null
}

// The one place every upload in the app goes through client-side. Asks
// /api/storage/upload-url where (and whether) it's allowed to upload,
// then performs the actual PUT itself -- Supabase's uploadToSignedUrl for
// 'profile-pictures'/'assignment-images', a raw fetch PUT to a B2
// presigned URL for 'submissions'. Either way the file's bytes go
// straight from the browser to storage, never through our own server.
export async function uploadFile({
  supabase,
  bucket,
  file,
  assignmentId,
}: {
  supabase: SupabaseClient
  bucket: UploadBucket
  file: File | Blob
  assignmentId?: string
}): Promise<UploadResult> {
  const fileName = file instanceof File ? file.name : `recording-${Date.now()}.webm`
  const contentType = file.type || 'application/octet-stream'

  const res = await fetch('/api/storage/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket, fileName, contentType, size: file.size, assignmentId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'Failed to prepare upload')
  }

  if (data.provider === 'b2') {
    const putRes = await fetch(data.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': contentType },
    })
    if (!putRes.ok) {
      throw new Error('Upload failed')
    }
    return { path: data.path, provider: 'b2', publicUrl: null }
  }

  const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(data.path, data.token, file)
  if (error) {
    throw error
  }

  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(data.path)
  return { path: data.path, provider: 'supabase', publicUrl: pub.publicUrl }
}
