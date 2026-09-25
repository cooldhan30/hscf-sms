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
import { TopicLibraryClient } from '@/components/gameRoomV2/learning/TopicLibraryClient'
import type { TopicSummary } from '@/lib/gameRoomV2/builtin/summaries'

export type LibraryTab = 'builtin' | 'my-sets' | 'shared' | 'favorites' | 'recent'
type Tab = LibraryTab

// Built-in Tamil content is kept clearly separate from teachers' own and
// shared sets: it is read-only and listed by topic.
const TABS: { id: Tab; label: string }[] = [
  { id: 'builtin', label: 'Built-in Tamil Content' },
  { id: 'my-sets', label: 'My Question Sets' },
  { id: 'shared', label: 'Shared Question Sets' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'recent', label: 'Recently Used' },
]

export function LibraryClient({
  initialSets,
  currentProfileId,
  recentSetIds,
  classes,
  builtinTopics,
  initialTab = 'builtin',
}: {
  initialSets: LibrarySet[]
  currentProfileId: string
  recentSetIds: string[]
  classes: { id: string; name: string }[]
  builtinTopics: TopicSummary[]
  initialTab?: Tab
}) {
  const router = useRouter()
  const [sets, setSets] = useState(initialSets)
  const [tab, setTab] = useState<Tab>(initialTab)
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
      case 'shared':
        return sets.filter((s) => s.created_by !== currentProfileId && (s.visibility === 'SCHOOL' || s.visibility === 'PUBLIC'))
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
    const matches = tabFiltered.filter((s) => {
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

    // "Recently Used" is already meaningfully pre-ordered by recentSetIds
    // (see tabFiltered above) -- re-sorting it would defeat the tab's
    // whole point, so the sort control only applies elsewhere.
    if (tab === 'recent') return matches

    const sorted = [...matches]
    switch (filters.sort) {
      case 'title':
        sorted.sort((a, b) => (a.tamil_title || a.title).localeCompare(b.tamil_title || b.title))
        break
      case 'usage':
        sorted.sort((a, b) => b.usageCount - a.usageCount)
        break
      case 'duration':
        sorted.sort((a, b) => (a.estimated_duration_minutes ?? Infinity) - (b.estimated_duration_minutes ?? Infinity))
        break
      default:
        break
    }
    return sorted
  }, [tabFiltered, filters, tab])

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

  const builtinGames = useMemo(() => {
    const seen = new Map<string, string>()
    builtinTopics.forEach((t) => t.engines.forEach((e) => seen.set(e.engineId, e.name)))
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
  }, [builtinTopics])
  const previewSet = sets.find((s) => s.id === previewId) ?? null
  const hasActiveFilters = Object.values(filters).some((v) => v !== '')

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Question set collections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 min-h-[40px] rounded-lg text-sm font-semibold transition-colors ${
              tab === t.id
                ? 'bg-primary-800 text-white'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'builtin' ? (
        <div className="space-y-3">
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Ready-made Tamil topics, available to every student automatically. Read-only: open a topic to preview it, host it live, or duplicate
            it into My Question Sets to edit.
          </p>
          <TopicLibraryClient topics={builtinTopics} games={builtinGames} />
        </div>
      ) : (
        <>
      <LibraryFilterPanel value={filters} onChange={setFilters} creators={creators} />

      {filtered.length === 0 ? (
        <GameV2Card>
          <GameV2Empty
            title={tabFiltered.length === 0 ? (tab === 'my-sets' ? "You haven't created any question sets yet" : 'Nothing here yet') : 'No sets match your filters'}
            description={
              tabFiltered.length === 0
                ? tab === 'my-sets'
                  ? 'Create one in the Question Set Builder, or duplicate built-in Tamil content to customise it.'
                  : 'Sets will appear here as you and other teachers use the library.'
                : 'Try a different search or clear your filters.'
            }
            actionLabel={tabFiltered.length === 0 ? (tab === 'my-sets' ? 'Create Question Set' : undefined) : hasActiveFilters ? 'Clear Filters' : undefined}
            onAction={tabFiltered.length === 0 ? () => router.push('/gameroom-v2/builder/new') : () => setFilters(EMPTY_LIBRARY_FILTERS)}
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

        </>
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
          currentClassId={assignSet.class_id}
          onAssigned={() => router.refresh()}
        />
      )}
    </div>
  )
}
