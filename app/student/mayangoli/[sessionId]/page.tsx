import { MayangoliPlayClient } from './MayangoliPlayClient'

export const dynamic = 'force-dynamic'

export default function MayangoliPlayPage({ params }: { params: { sessionId: string } }) {
  return (
    <div className="max-w-2xl mx-auto">
      <MayangoliPlayClient sessionId={params.sessionId} />
    </div>
  )
}
