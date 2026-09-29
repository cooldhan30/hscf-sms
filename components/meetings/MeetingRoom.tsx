'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LiveKitRoom,
  VideoConference,
  formatChatMessageLinks,
  useRoomInfo,
} from '@livekit/components-react'
import '@livekit/components-styles'
import { FiVideo, FiAlertCircle, FiMaximize, FiMinimize, FiMicOff, FiMic, FiExternalLink } from 'react-icons/fi'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { toast } from '@/lib/toast'

// Safari implements the Fullscreen API only under its webkit prefix and
// never fires the unprefixed event, so both spellings are needed.
type FullscreenTarget = HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> }
type FullscreenDoc = Document & {
  webkitExitFullscreen?: () => Promise<void>
  webkitFullscreenElement?: Element | null
}

// The token is fetched on mount rather than rendered into the page from
// the server: it is a credential with a 12h life, and keeping it out of
// the initial HTML keeps it out of any cached document or view-source.
// standalone: the meeting's own tab (/meeting/[classId]) -- fills the
// window, and leaving shows a Rejoin screen instead of navigating "back"
// (a fresh tab has nowhere to go back to).
export function MeetingRoom({ classId, className, standalone = false }: { classId: string; className: string; standalone?: boolean }) {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [serverUrl, setServerUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const [canModerate, setCanModerate] = useState(false)
  const [left, setLeft] = useState(false)

  // While connected, closing or reloading the tab asks first, so a stray
  // click doesn't drop the teacher out of class.
  useEffect(() => {
    if (!token) return
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [token])
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Tracked from the document rather than from our own click, so the
  // button stays correct when the user leaves fullscreen with Escape or
  // the browser's own control.
  useEffect(() => {
    function syncFullscreenState() {
      const doc = document as FullscreenDoc
      setIsFullscreen(Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement))
    }
    document.addEventListener('fullscreenchange', syncFullscreenState)
    document.addEventListener('webkitfullscreenchange', syncFullscreenState)
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState)
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState)
    }
  }, [])

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current as FullscreenTarget | null
    const doc = document as FullscreenDoc
    if (!el) return

    try {
      if (doc.fullscreenElement ?? doc.webkitFullscreenElement) {
        await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.())
      } else {
        await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.())
      }
    } catch {
      // Denied, or unsupported (notably iPhone Safari, which only allows
      // fullscreen on a <video> element). The meeting keeps working
      // windowed, so there is nothing to report.
    }
  }, [])

  async function join() {
    setJoining(true)
    setError(null)

    const res = await fetch('/api/meetings/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId }),
    })
    const data = await res.json().catch(() => ({}))
    setJoining(false)

    if (!res.ok) {
      setError(data.error || 'Could not join this meeting')
      return
    }
    if (!data.serverUrl) {
      setError('Meetings are not configured yet. NEXT_PUBLIC_LIVEKIT_URL is missing.')
      return
    }

    setServerUrl(data.serverUrl)
    setLeft(false)
    setCanModerate(Boolean(data.canModerate))
    setToken(data.token)
  }

  // Leaving returns to the page they came from rather than dropping them
  // on a dead screen with a disconnected room.
  function handleDisconnect() {
    setToken(null)
    if (standalone) setLeft(true)
    else router.back()
  }

  if (token && serverUrl) {
    return (
      <div
        ref={containerRef}
        // In fullscreen the element becomes the viewport, so the windowed
        // height cap and rounded border have to come off or they letterbox
        // the video inside a black frame.
        className={
          isFullscreen
            ? 'relative h-screen w-screen bg-stone-950'
            : standalone
              ? 'relative h-screen w-screen bg-stone-950'
              : 'relative h-[calc(100vh-8rem)] rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-800'
        }
      >
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          // Above LiveKit's own chrome, and out of the way of the control
          // bar it renders along the bottom.
          className="absolute top-3 right-3 z-50 p-2 rounded-lg bg-stone-900/70 text-white backdrop-blur hover:bg-stone-900/90 transition-colors"
        >
          {isFullscreen ? <FiMinimize className="w-4 h-4" /> : <FiMaximize className="w-4 h-4" />}
        </button>

        <LiveKitRoom
          token={token}
          serverUrl={serverUrl}
          connect
          video
          audio
          onDisconnected={handleDisconnect}
          data-lk-theme="default"
          style={{ height: '100%' }}
        >
          {/* Camera/mic/screen-share, grid + speaker layouts, in-call chat
              and participant list all come from this one component. */}
          <VideoConference chatMessageFormatter={formatChatMessageLinks} />
          <MicLockControl classId={classId} canModerate={canModerate} />
        </LiveKitRoom>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto text-center py-16 space-y-4">
      <div className="w-14 h-14 mx-auto rounded-full bg-primary-100 dark:bg-primary-950 flex items-center justify-center text-primary-700 dark:text-primary-300">
        <FiVideo className="w-6 h-6" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-primary-900 dark:text-white">{className}</h2>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          The meeting room for this class is always open. Anyone in the class can join at any time.
        </p>
      </div>

      {error && (
        <p className="flex items-start gap-2 text-sm text-left text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
          <FiAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </p>
      )}

      {left && <p className="text-sm font-semibold text-stone-600 dark:text-stone-300">You left the meeting.</p>}

      <Button variant="primary" onClick={join} disabled={joining} icon={<FiVideo />}>
        {joining ? 'Connecting...' : left ? 'Rejoin meeting' : 'Join meeting'}
      </Button>

      <p className="text-xs text-stone-400 dark:text-stone-500">
        Your camera and microphone start on. You can turn them off once you are in.
      </p>

      {standalone ? (
        <p className="text-xs text-stone-400 dark:text-stone-500">
          This meeting has its own tab -- keep it open and use the portal in your other tab.
        </p>
      ) : (
        <Link
          href={`/meeting/${classId}`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 dark:text-primary-400 hover:underline"
        >
          <FiExternalLink className="w-3.5 h-3.5" /> Open in a new tab instead
        </Link>
      )}
    </div>
  )
}

// Teacher: "Mute all" / "Allow mics" (enforced server-side by
// /api/meetings/mute-all). Everyone else: a banner while mics are locked.
// The state is the room's metadata, so every participant sees the same
// thing and it updates live.
function MicLockControl({ classId, canModerate }: { classId: string; canModerate: boolean }) {
  const { metadata } = useRoomInfo()
  const [busy, setBusy] = useState(false)
  let micsLocked = false
  try {
    micsLocked = Boolean(metadata && JSON.parse(metadata).micsLocked)
  } catch {
    micsLocked = false
  }

  async function setLock(lock: boolean) {
    setBusy(true)
    const res = await fetch('/api/meetings/mute-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, lock }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      toast.error(data.error || 'Could not update microphones')
      return
    }
    toast.success(lock ? 'Everyone is muted. Students cannot unmute until you allow mics.' : 'Students can turn their mics on again.')
  }

  if (canModerate) {
    return (
      <button
        type="button"
        onClick={() => setLock(!micsLocked)}
        disabled={busy}
        title={micsLocked ? 'Let students use their microphones again' : 'Mute every student and stop them unmuting'}
        className={`absolute top-3 left-3 z-50 inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white backdrop-blur transition-colors disabled:opacity-60 ${
          micsLocked ? 'bg-terracotta-600/90 hover:bg-terracotta-700' : 'bg-stone-900/70 hover:bg-stone-900/90'
        }`}
      >
        {micsLocked ? <FiMic className="w-4 h-4" /> : <FiMicOff className="w-4 h-4" />}
        {busy ? 'Updating...' : micsLocked ? 'Allow mics' : 'Mute all'}
      </button>
    )
  }

  if (!micsLocked) return null
  return (
    <div className="absolute top-3 left-3 z-50 inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-stone-900/80 backdrop-blur">
      <FiMicOff className="w-4 h-4" /> Your teacher has muted everyone
    </div>
  )
}
