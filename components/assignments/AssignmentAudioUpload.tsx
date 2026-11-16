'use client'

import { useRef, useState } from 'react'
import { FiMusic, FiUpload, FiX } from 'react-icons/fi'
import { useSupabaseBrowserClient } from '@/lib/supabase/client'
import { uploadFile } from '@/lib/storage/uploadFile'
import { AudioRecorder } from '@/components/submissions/AudioRecorder'
import { AudioPlayer } from '@/components/submissions/AudioPlayer'
import { toast } from '@/lib/toast'

const MAX_BYTES = 50 * 1024 * 1024 // 50MB

// The audio clip for an audio homework: upload a file (mp3, m4a, ...) or
// record one here. Same upload-then-hand-back-URL split as
// AssignmentImageUpload -- the clip goes to the public 'resources'
// bucket straight away and is only saved on the assignment when the
// teacher saves the form.
export function AssignmentAudioUpload({ currentUrl, onUploaded }: { currentUrl: string; onUploaded: (url: string, size: number) => void }) {
  const supabase = useSupabaseBrowserClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)

  async function upload(file: File | Blob) {
    if (file.size > MAX_BYTES) {
      toast.error('Audio must be under 50MB.')
      return
    }
    setUploading(true)
    try {
      const { publicUrl } = await uploadFile({ supabase, bucket: 'resources', file })
      onUploaded(publicUrl ?? '', file.size)
      setRecording(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload audio')
    } finally {
      setUploading(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('audio/')) {
      toast.error('Please choose an audio file.')
      return
    }
    void upload(file)
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Audio (optional)</label>
      {currentUrl ? (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <AudioPlayer src={currentUrl} />
          </div>
          <button
            type="button"
            onClick={() => onUploaded('', 0)}
            className="p-1.5 rounded-full bg-terracotta-600 text-white hover:bg-terracotta-700 transition-colors"
            aria-label="Remove audio"
          >
            <FiX className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : recording ? (
        <div className="space-y-2">
          <AudioRecorder attachedLabel="Ready to attach" onRecorded={(blob) => blob && void upload(blob)} />
          <button type="button" onClick={() => setRecording(false)} className="text-xs font-semibold text-stone-500 hover:underline">
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-primary-700 dark:text-primary-400 border border-dashed border-primary-300 dark:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors disabled:opacity-60"
          >
            {uploading ? <FiUpload className="w-3.5 h-3.5 animate-pulse" /> : <FiMusic className="w-3.5 h-3.5" />}
            {uploading ? 'Uploading...' : 'Add Audio File'}
          </button>
          <button
            type="button"
            onClick={() => setRecording(true)}
            disabled={uploading}
            className="px-3 py-2 rounded-lg text-sm font-semibold text-primary-700 dark:text-primary-400 border border-dashed border-primary-300 dark:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors disabled:opacity-60"
          >
            Record Audio
          </button>
        </div>
      )}
      {uploading && recording && <p className="text-xs text-stone-500 mt-1">Uploading recording...</p>}
      <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileChange} className="hidden" />
    </div>
  )
}
