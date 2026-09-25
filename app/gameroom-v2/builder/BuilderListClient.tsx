'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { FiPlus, FiEdit2, FiTrash2, FiUsers, FiLock, FiGlobe } from 'react-icons/fi'
import { GameV2Button, GameV2Card, GameV2Empty, GameV2ConfirmDialog } from '@/components/gameRoomV2'
import { checkEngineCompatibility, type GameRoomQuestionType, type QuestionSetVisibility } from '@/lib/gameRoomV2/domain'
import { GAME_ENGINES_V2 } from '@/lib/gameRoomV2/registry'
import { toast } from '@/lib/toast'

export interface QuestionSetRow {
  id: string
  title: string
  tamil_title: string | null
  english_title: string | null
  description: string | null
  question_types: GameRoomQuestionType[]
  question_count: number
  visibility: QuestionSetVisibility
  published: boolean
  created_by: string
  updated_at: string
  creator: { first_name: string; last_name: string } | null
}

const VISIBILITY_ICON = { PRIVATE: FiLock, SCHOOL: FiUsers, PUBLIC: FiGlobe }

export function BuilderListClient({ questionSets, currentProfileId }: { questionSets: QuestionSetRow[]; currentProfileId: string }) {
  const router = useRouter()
  const [sets, setSets] = useState(questionSets)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<QuestionSetRow | null>(null)

  async function handleDelete() {
    if (!confirmDelete) return
    const { id, title } = confirmDelete
    setDeletingId(id)
    const res = await fetch(`/api/gameroom-v2/question-sets/${id}`, { method: 'DELETE' })
    setDeletingId(null)
    setConfirmDelete(null)
    if (res.ok) {
      setSets((prev) => prev.filter((s) => s.id !== id))
      toast.success(`"${title}" deleted`)
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || 'Failed to delete question set')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <GameV2Button variant="spark" onClick={() => router.push('/gameroom-v2/builder/new')}>
          <FiPlus className="w-4 h-4" /> Create New Set
        </GameV2Button>
      </div>

      {sets.length === 0 ? (
        <GameV2Card>
          <GameV2Empty
            title="No question sets yet"
            description="Create your first set to get started."
            actionLabel="Create New Set"
            onAction={() => router.push('/gameroom-v2/builder/new')}
          />
        </GameV2Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sets.map((set) => {
            const VisIcon = VISIBILITY_ICON[set.visibility]
            const isOwner = set.created_by === currentProfileId
            const compatibleCount = checkEngineCompatibility(GAME_ENGINES_V2, set.question_types).filter((r) => r.compatible).length

            return (
              <GameV2Card key={set.id} padding="md">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-tamil leading-relaxed text-lg font-bold text-primary-900 dark:text-white truncate">
                      {set.tamil_title || set.title}
                    </p>
                    {set.english_title && set.tamil_title && (
                      <p className="text-sm text-stone-500 dark:text-stone-400">{set.english_title}</p>
                    )}
                  </div>
                  <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400" title={set.visibility}>
                    <VisIcon className="w-3 h-3" /> {set.visibility}
                  </span>
                </div>

                {set.description && (
                  <p className="text-sm text-stone-500 dark:text-stone-400 mt-2 line-clamp-2">{set.description}</p>
                )}

                <div className="flex items-center gap-2 mt-3 text-xs text-stone-400 dark:text-stone-500">
                  <span>{set.question_count} question{set.question_count === 1 ? '' : 's'}</span>
                  <span aria-hidden>&middot;</span>
                  <span>{compatibleCount} game{compatibleCount === 1 ? '' : 's'} compatible</span>
                  {!isOwner && set.creator && (
                    <>
                      <span aria-hidden>&middot;</span>
                      <span>
                        by {set.creator.first_name} {set.creator.last_name}
                      </span>
                    </>
                  )}
                </div>

                <div className="mt-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      set.published
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                        : 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'
                    }`}
                  >
                    {set.published ? 'Published' : 'Draft'}
                  </span>
                </div>

                {isOwner && (
                  <div className="flex items-center gap-2 mt-4">
                    <GameV2Button size="md" variant="ghost" className="!min-h-0 !py-2 flex-1" onClick={() => router.push(`/gameroom-v2/builder/${set.id}`)}>
                      <FiEdit2 className="w-3.5 h-3.5" /> Edit
                    </GameV2Button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(set)}
                      disabled={deletingId === set.id}
                      aria-label="Delete"
                      className="p-2.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-40"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </GameV2Card>
            )
          })}
        </div>
      )}

      <GameV2ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete this question set?"
        confirmLabel="Delete"
        confirming={deletingId !== null}
        message={
          confirmDelete && (
            <>
              <p>
                &quot;{confirmDelete.title}&quot; ({confirmDelete.question_count} question{confirmDelete.question_count === 1 ? '' : 's'}) will be permanently deleted. This cannot be undone.
              </p>
              {confirmDelete.visibility !== 'PRIVATE' && (
                <p className="mt-2 font-bold text-red-600 dark:text-red-400">
                  This set is shared ({confirmDelete.visibility === 'SCHOOL' ? 'School' : 'Public'}) -- other teachers may be relying on it.
                </p>
              )}
            </>
          )
        }
      />
    </div>
  )
}
