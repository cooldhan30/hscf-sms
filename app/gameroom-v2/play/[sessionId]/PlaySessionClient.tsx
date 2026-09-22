'use client'

import { useRouter } from 'next/navigation'
import { GameSessionRuntime } from '@/components/gameRoomV2/gameplay'

export function PlaySessionClient({ sessionId }: { sessionId: string }) {
  const router = useRouter()

  return (
    <GameSessionRuntime
      sessionId={sessionId}
      onExit={() => router.push('/gameroom-v2/library')}
    />
  )
}
