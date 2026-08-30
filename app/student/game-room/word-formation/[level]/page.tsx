import { WordFormationLevelClient } from './WordFormationLevelClient'

export const dynamic = 'force-dynamic'

export default function WordFormationLevelPage({ params }: { params: { level: string } }) {
  const level = Number(params.level)
  return (
    <div className="max-w-2xl mx-auto">
      <WordFormationLevelClient level={level} />
    </div>
  )
}
