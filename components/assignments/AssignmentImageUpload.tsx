'use client'

import { useRef, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { FiImage, FiUpload, FiX } from 'react-icons/fi'
import { useSupabaseBrowserClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast'

const MAX_BYTES = 8 * 1024 * 1024 // 8MB

// Uploads to the public 'assignment-images' bucket (see migration 029)
// and hands the resulting public URL back via onUploaded -- same
// upload-then-hand-back-URL split as AvatarUpload, so the parent form
// still owns actually persisting it alongside the rest of the assignment
// fields (only saved for real once the teacher submits the form).
export function AssignmentImageUpload({
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
      toast.error('Image must be under 8MB.')
      return
    }

    setUploading(true)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${userId}/${Date.now()}.${ext}`

    const { error } = await supabase.storage.from('assignment-images').upload(path, file, { upsert: true })
    if (error) {
      setUploading(false)
      toast.error(error.message || 'Failed to upload image')
      return
    }

    const { data } = supabase.storage.from('assignment-images').getPublicUrl(path)
    setUploading(false)
    setPreviewUrl(data.publicUrl)
    onUploaded(data.publicUrl)
  }

  function remove() {
    setPreviewUrl('')
    onUploaded('')
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Image (optional)</label>
      {previewUrl ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element -- teacher-uploaded, arbitrary Storage URL not worth Next/Image's remote-pattern config */}
          <img src={previewUrl} alt="Assignment attachment" className="max-h-48 rounded-xl border border-stone-200 dark:border-stone-800" />
          <button
            type="button"
            onClick={remove}
            className="absolute -top-2 -right-2 p-1 rounded-full bg-terracotta-600 text-white hover:bg-terracotta-700 transition-colors"
            aria-label="Remove image"
          >
            <FiX className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-primary-700 dark:text-primary-400 border border-dashed border-primary-300 dark:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors disabled:opacity-60"
        >
          {uploading ? <FiUpload className="w-3.5 h-3.5 animate-pulse" /> : <FiImage className="w-3.5 h-3.5" />}
          {uploading ? 'Uploading...' : 'Add Image'}
        </button>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
    </div>
  )
}
