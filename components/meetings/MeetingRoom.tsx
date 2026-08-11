'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LiveKitRoom,
  VideoConference,
  formatChatMessageLinks,
} from '@livekit/components-react'
import '@livekit/components-styles'
import { FiVideo, FiAlertCircle } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'

// The token is fetched on mount rather than rendered into the page from
// the server: it is a credential with a 12h life, and keeping it out of
// the initial HTML keeps it out of any cached document or view-source.
export function MeetingRoom({ classId, className }: { classId: string; className: string }) {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [serverUrl, setServerUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

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
    setToken(data.token)
  }

  // Leaving returns to the page they came from rather than dropping them
  // on a dead screen with a disconnected room.
  function handleDisconnect() {
    setToken(null)
    router.back()
  }

  if (token && serverUrl) {
    return (
      <div className="h-[calc(100vh-8rem)] rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-800">
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

      <Button variant="primary" onClick={join} disabled={joining} icon={<FiVideo />}>
        {joining ? 'Connecting...' : 'Join meeting'}
      </Button>

      <p className="text-xs text-stone-400 dark:text-stone-500">
        Your camera and microphone start on. You can turn them off once you are in.
      </p>
    </div>
  )
}
