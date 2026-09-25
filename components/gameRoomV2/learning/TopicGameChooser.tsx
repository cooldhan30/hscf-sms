'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiPlay, FiUsers, FiClock, FiEye, FiCopy } from 'react-icons/fi'
import { engineIcon } from '@/components/gameRoomV2/shell/ui'
import { HostLiveModal } from '@/components/gameRoomV2/liveClassroom/HostLiveModal'
import { PreviewModal } from '@/app/gameroom-v2/library/PreviewModal'
import { toast } from '@/lib/toast'
import type { EngineOption, TopicSummary } from '@/lib/gameRoomV2/builtin/summaries'
import { useStartGame } from './useStartGame'

export interface TopicSetInfo {
  id: string
  title: string
  kind: string
  questionCount: number
}

const KIND_LABEL: Record<string, string> = {
  quiz: 'Quiz questions',
  sort: 'Sorting rounds',
  match: 'Matching rounds',
  order: 'Ordering rounds',
}

// "Choose a game" for a Tamil topic -- only engines that can actually
// play one of the topic's question sets are listed (compatibility is
// computed from the sets' question types, lib/gameRoomV2/builtin/catalog.ts).
// Students start a solo game; teachers host it live for a class, and can
// preview or duplicate the underlying (read-only) built-in sets.
export function TopicGameChooser({
  topic,
  role,
  sets = [],
}: {
  topic: TopicSummary
  role: 'student' | 'teacher'
  sets?: TopicSetInfo[]
}) {
  const router = useRouter()
  const { start, starting } = useStartGame()
  const [hosting, setHosting] = useState<EngineOption | null>(null)
  const [previewSet, setPreviewSet] = useState<TopicSetInfo | null>(null)
  const [duplicating, setDuplicating] = useState<string | null>(null)

  async function duplicate(set: TopicSetInfo) {
    setDuplicating(set.id)
    const res = await fetch(`/api/gameroom-v2/question-sets/${set.id}/duplicate`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setDuplicating(null)
    if (!res.ok) {
      toast.error(data.error || 'Failed to duplicate')
      return
    }
    toast.success('Copied to My Question Sets -- the copy is yours to edit')
    router.push(`/gameroom-v2/builder/${data.questionSet.id}`)
  }

  const engines = topic.engines

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {engines.map((e) => {
          const Icon = engineIcon(e.engineId)
          const key = `${e.setId}:${e.engineId}`
          return (
            <div key={e.engineId} className="flex flex-col p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-stone-800 dark:text-stone-100">{e.name}</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1 mt-0.5">
                    <FiClock className="w-3 h-3" aria-hidden /> ~{e.minutes} min · {e.questionCount} {KIND_LABEL[e.setKind]?.toLowerCase() ?? 'questions'}
                  </p>
                </div>
              </div>
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-3 line-clamp-3 flex-1">{e.description}</p>
              <div className="mt-4">
                {role === 'student' ? (
                  <button
                    type="button"
                    disabled={starting !== null}
                    onClick={() => start(e.setId, e.engineId, key)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-primary-700 hover:bg-primary-800 dark:bg-primary-600 dark:hover:bg-primary-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    <FiPlay className="w-4 h-4" aria-hidden /> {starting === key ? 'Starting...' : 'Play'}
                  </button>
                ) : e.live ? (
                  <button
                    type="button"
                    onClick={() => setHosting(e)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-primary-700 hover:bg-primary-800 dark:bg-primary-600 dark:hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
                  >
                    <FiUsers className="w-4 h-4" aria-hidden /> Host Live Classroom
                  </button>
                ) : (
                  <p className="text-xs text-stone-500 dark:text-stone-400">Students can play this on their own from this topic. Live Classroom supports Classic Quiz, Racing and Boss Battle.</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {role === 'teacher' && sets.length > 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
          <h2 className="text-lg font-bold text-primary-900 dark:text-white">Question sets in this topic</h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Built-in content is read-only. Duplicate a set to customise it in My Question Sets.
          </p>
          <ul className="mt-4 divide-y divide-stone-100 dark:divide-stone-800">
            {sets.map((s) => (
              <li key={s.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-stone-800 dark:text-stone-100 font-tamil leading-relaxed">{s.title}</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {s.questionCount} {KIND_LABEL[s.kind]?.toLowerCase() ?? 'questions'}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewSet(s)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-stone-300 dark:border-stone-700 text-sm font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800"
                  >
                    <FiEye className="w-4 h-4" aria-hidden /> Preview
                  </button>
                  <button
                    type="button"
                    disabled={duplicating !== null}
                    onClick={() => duplicate(s)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-stone-300 dark:border-stone-700 text-sm font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-50"
                  >
                    <FiCopy className="w-4 h-4" aria-hidden /> {duplicating === s.id ? 'Copying...' : 'Duplicate'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hosting && (
        <HostLiveModal
          open={Boolean(hosting)}
          onClose={() => setHosting(null)}
          questionSetId={hosting.setId}
          engineId={hosting.engineId}
          setTitle={`${topic.tamilTitle} -- ${hosting.name}`}
        />
      )}
      {previewSet && <PreviewModal open onClose={() => setPreviewSet(null)} setId={previewSet.id} setTitle={previewSet.title} />}
    </div>
  )
}
