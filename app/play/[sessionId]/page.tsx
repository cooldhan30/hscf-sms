import { PlayGameClient } from './PlayGameClient'

export const dynamic = 'force-dynamic'

export default function PlaySessionPage({ params }: { params: { sessionId: string } }) {
  return <PlayGameClient sessionId={params.sessionId} />
}
