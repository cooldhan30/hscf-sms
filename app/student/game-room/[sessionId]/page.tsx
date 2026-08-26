import { SessionRouter } from './SessionRouter'

export const dynamic = 'force-dynamic'

export default function PlaySessionPage({ params }: { params: { sessionId: string } }) {
  return (
    <div className="max-w-2xl mx-auto">
      <SessionRouter sessionId={params.sessionId} />
    </div>
  )
}
