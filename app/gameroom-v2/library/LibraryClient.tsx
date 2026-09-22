'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GameV2Card, GameV2Empty } from '@/components/gameRoomV2'
import { ChooseGameModal } from '@/components/gameRoomV2/builder/ChooseGameModal'
import { LibraryFilterPanel, EMPTY_LIBRARY_FILTERS, type LibraryFilterState } from './LibraryFilterPanel'
import { LibrarySetCard, type LibrarySet } from './LibrarySetCard'
import { AssignModal } from './AssignModal'
import { PreviewModal } from './PreviewModal'
import { toast } from '@/lib/toast'

type Tab = 'my-sets' | 'school' | 'public' | 'favorites' | 'recent'

const TABS: { id: Tab; label: string }[] = [
  { id: 'my-sets', label: 'My Sets' },
  { id: 'school', label: 'School Library' },
  { id: 'public', label: 'Public Library' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'recent', label: 'Recently Used' },
]

export function LibraryClient({
  initialSets,
  currentProfileId,
  recentSetIds,
  classes,
}: {
  initialSets: LibrarySet[]
  currentProfileId: string
  recentSetIds: string[]
  classes: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [sets, setSets] = useState(initialSets)
  const [tab, setTab] = useState<Tab>('my-sets')
  const [filters, setFilters] = useState<LibraryFilterState>(EMPTY_LIBRARY_FILTERS)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [playSet, setPlaySet] = useState<LibrarySet | null>(null)
  const [assignSet, setAssignSet] = useState<LibrarySet | null>(null)

  const creators = useMemo(() => {
    const map = new Map<string, string>()
    sets.forEach((s) => {
      if (s.creator) map.set(s.created_by, `${s.creator.first_name} ${s.creator.last_name}`)
    })
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
  }, [sets])

  const tabFiltered = useMemo(() => {
    switch (tab) {
      case 'my-sets':
        return sets.filter((s) => s.created_by === currentProfileId)
      case 'school':
        return sets.filter((s) => s.created_by !== currentProfileId && (s.visibility === 'SCHOOL' || s.visibility === 'PUBLIC'))
      case 'public':
        return sets.filter((s) => s.visibility === 'PUBLIC')
      case 'favorites':
        return sets.filter((s) => s.isFavorite)
      case 'recent':
        // Preserve recency order (recentSetIds is already most-recent-
        // first, deduped server-side) rather than the default
        // updated_at ordering `sets` came in.
        return recentSetIds.map((id) => sets.find((s) => s.id === id)).filter((s): s is LibrarySet => Boolean(s))
      default:
        return sets
    }
  }, [sets, tab, currentProfileId, recentSetIds])

  const filtered = useMemo(() => {
    return tabFiltered.filter((s) => {
      if (filters.search.trim()) {
        const q = filters.search.trim().toLowerCase()
        const haystack = [s.title, s.tamil_title ?? '', s.english_title ?? '', s.topic ?? '', ...s.tags].join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (filters.level && s.level !== filters.level) return false
      if (filters.difficulty && s.difficulty !== filters.difficulty) return false
      if (filters.questionType && !s.question_types.includes(filters.questionType as never)) return false
      if (filters.language && s.language !== filters.language) return false
      if (filters.creator && s.created_by !== filters.creator) return false
      return true
    })
  }, [tabFiltered, filters])

  async function handleToggleFavorite(set: LibrarySet) {
    const method = set.isFavorite ? 'DELETE' : 'POST'
    const res = await fetch(`/api/gameroom-v2/question-sets/${set.id}/favorite`, { method })
    if (res.ok) {
      setSets((prev) => prev.map((s) => (s.id === set.id ? { ...s, isFavorite: !s.isFavorite } : s)))
    } else {
      toast.error('Failed to update favorite')
    }
  }

  async function handleDuplicate(set: LibrarySet) {
    const res = await fetch(`/api/gameroom-v2/question-sets/${set.id}/duplicate`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      toast.success(`Duplicated "${set.title}" -- the copy is independent and yours to edit`)
      router.push(`/gameroom-v2/builder/${data.questionSet.id}`)
    } else {
      toast.error(data.error || 'Failed to duplicate question set')
    }
  }

  const previewSet = sets.find((s) => s.id === previewId) ?? null

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              tab === t.id ? 'bg-gamev2ink-800 text-white' : 'text-gamev2ink-500 dark:text-gamev2ink-400 hover:bg-gamev2ink-100 dark:hover:bg-gamev2ink-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <LibraryFilterPanel value={filters} onChange={setFilters} creators={creators} />

      {filtered.length === 0 ? (
        <GameV2Card>
          <GameV2Empty
            title={sets.length === 0 ? 'No question sets yet' : 'No sets match your filters'}
            description={sets.length === 0 ? 'Create one in the Question Set Builder to get started.' : 'Try a different search or clear your filters.'}
          />
        </GameV2Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((set) => (
            <LibrarySetCard
              key={set.id}
              set={set}
              currentProfileId={currentProfileId}
              onPreview={() => setPreviewId(set.id)}
              onPlay={() => setPlaySet(set)}
              onAssign={() => setAssignSet(set)}
              onDuplicate={() => handleDuplicate(set)}
              onEdit={() => router.push(`/gameroom-v2/builder/${set.id}`)}
              onToggleFavorite={() => handleToggleFavorite(set)}
            />
          ))}
        </div>
      )}

      {previewSet && (
        <PreviewModal open={previewId !== null} onClose={() => setPreviewId(null)} setId={previewSet.id} setTitle={previewSet.title} />
      )}

      {playSet && (
        <ChooseGameModal
          open={playSet !== null}
          onClose={() => setPlaySet(null)}
          questionSetId={playSet.id}
          questionTypes={playSet.question_types}
          setTitle={playSet.title}
        />
      )}

      {assignSet && (
        <AssignModal
          open={assignSet !== null}
          onClose={() => setAssignSet(null)}
          setId={assignSet.id}
          setTitle={assignSet.title}
          classes={classes}
          onAssigned={() => router.refresh()}
        />
      )}
    </div>
  )
}
