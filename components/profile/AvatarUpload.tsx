'use client'

import { useRef, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { FiUser, FiCamera } from 'react-icons/fi'
import { useSupabaseBrowserClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast'

const MAX_BYTES = 5 * 1024 * 1024 // 5MB

// Uploads directly to the public 'profile-pictures' Storage bucket (see
// migration 027) and hands the resulting public URL back to the parent
// via onUploaded -- the parent still owns actually persisting that URL
// (each profile form already PATCHes avatarUrl alongside its other
// fields, so this only handles the upload step, not the save).
export function AvatarUpload({
  currentUrl,
  onUploaded,
}: {
  currentUrl: string
  onUploaded: (url: string) => void
}) {
  const { userId } = useAuth()
  const supabase = useSupabaseBrowserClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(currentUrl)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !userId) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.')
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error('Image must be under 5MB.')
      return
    }

    setUploading(true)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${userId}/${Date.now()}.${ext}`

    const { error } = await supabase.storage.from('profile-pictures').upload(path, file, { upsert: true })
    if (error) {
      setUploading(false)
      toast.error(error.message || 'Failed to upload image')
      return
    }

    const { data } = supabase.storage.from('profile-pictures').getPublicUrl(path)
    setUploading(false)
    setPreviewUrl(data.publicUrl)
    onUploaded(data.publicUrl)
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-20 h-20 rounded-full overflow-hidden bg-primary-100 dark:bg-primary-950 flex items-center justify-center flex-shrink-0">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatars are user-uploaded, arbitrary external-looking Storage URLs not worth Next/Image's remote-pattern config for a small thumbnail
          <img src={previewUrl} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          <FiUser className="w-8 h-8 text-primary-700 dark:text-primary-300" />
        )}
      </div>
      <div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-primary-700 dark:text-primary-400 border border-primary-200 dark:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors disabled:opacity-60"
        >
          <FiCamera className="w-3.5 h-3.5" />
          {uploading ? 'Uploading...' : 'Change Photo'}
        </button>
        <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">JPG, PNG, up to 5MB</p>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
    </div>
  )
}
