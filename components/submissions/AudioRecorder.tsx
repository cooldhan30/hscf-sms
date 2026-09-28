'use client'

import { useEffect, useRef, useState } from 'react'
import { FiMic, FiSquare, FiRefreshCw, FiCheck } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'

type RecorderState = 'idle' | 'recording' | 'recorded'

// First use of MediaRecorder/getUserMedia in this repo. Mirrors the
// record -> stop -> review -> re-record cycle already built for the
// Flutter app's reading_recording_sheet.dart, but browser-native.
//
// The recording is attached to the parent form the instant it stops
// (onRecorded fires from recorder.onstop below), not behind a separate
// confirmation click -- this used to require an explicit "Use Recording"
// button after stopping, and a student who recorded, saw the preview,
// and went straight to the form's own Submit button (a very natural
// thing to do) had their recording silently dropped: nothing ever called
// onRecorded, so the teacher's gradebook showed the submission with no
// audio at all and no error anywhere. Confirmed as a real bug hit by an
// actual student submission: 2026-08-09.
export function AudioRecorder({
  onRecorded,
  attachedLabel = 'Attached to your submission',
}: {
  onRecorded: (blob: Blob | null) => void
  attachedLabel?: string
}) {
  const [state, setState] = useState<RecorderState>('idle')
  const [elapsedSec, setElapsedSec] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const blobRef = useRef<Blob | null>(null)

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  // Closing the surrounding modal mid-recording must release the mic --
  // otherwise the browser keeps recording (and showing its mic indicator).
  useEffect(() => {
    return () => {
      stopTimer()
      if (recorderRef.current) recorderRef.current.onstop = null
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      stopStream()
    }
  }, [])

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        blobRef.current = blob
        setPreviewUrl(URL.createObjectURL(blob))
        setState('recorded')
        stopStream()
        onRecorded(blob)
      }

      recorder.start()
      setState('recording')
      setElapsedSec(0)
      timerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000)
    } catch {
      setError('Microphone permission is required to record.')
    }
  }

  function stopRecording() {
    stopTimer()
    recorderRef.current?.stop()
  }

  function reRecord() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    blobRef.current = null
    onRecorded(null)
    setState('idle')
    startRecording()
  }

  function format(sec: number): string {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, '0')
    const s = (sec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  return (
    <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950/40 space-y-3">
      {error && <p className="text-sm text-terracotta-600 dark:text-terracotta-400">{error}</p>}

      {state === 'idle' && (
        <Button type="button" variant="outline" icon={<FiMic />} onClick={startRecording}>
          Start Recording
        </Button>
      )}

      {state === 'recording' && (
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-terracotta-500 animate-pulse" />
          <span className="font-mono text-stone-700 dark:text-stone-200">{format(elapsedSec)}</span>
          <Button type="button" variant="secondary" size="sm" icon={<FiSquare />} onClick={stopRecording}>
            Stop
          </Button>
        </div>
      )}

      {state === 'recorded' && previewUrl && (
        <div className="space-y-3">
          <audio controls src={previewUrl} className="w-full" />
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" icon={<FiRefreshCw />} onClick={reRecord}>
              Re-record
            </Button>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-primary-700 dark:text-primary-400">
              <FiCheck className="w-4 h-4" /> {attachedLabel}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
