'use client'

import { useState } from 'react'
import { FiEye, FiPlay, FiSend, FiCopy, FiEdit2, FiHeart, FiUsers, FiLock, FiGlobe, FiClock } from 'react-icons/fi'
import { GameV2Card, GameV2Button } from '@/components/gameRoomV2'
import { checkEngineCompatibility, type GameRoomQuestionType, type QuestionSetVisibility } from '@/lib/gameRoomV2/domain'
import { GAME_ENGINES_V2 } from '@/lib/gameRoomV2/registry'
import { GRADE_LEVEL_OPTIONS } from '@/lib/constants'

export interface LibrarySet {
  id: string
  class_id: string | null
  title: string
  tamil_title: string | null
  english_title: string | null
  description: string | null
  level: string | null
  topic: string | null
  difficulty: 'easy' | 'medium' | 'hard' | null
  estimated_duration_minutes: number | null
  question_types: GameRoomQuestionType[]
  question_count: number
  visibility: QuestionSetVisibility
  language: string
  tags: string[]
  published: boolean
  created_by: string
  creator: { first_name: string; last_name: string } | null
  isFavorite: boolean
  usageCount: number
}

const VISIBILITY_ICON = { PRIVATE: FiLock, SCHOOL: FiUsers, PUBLIC: FiGlobe }

function levelLabel(value: string | null) {
  return GRADE_LEVEL_OPTIONS.find((l) => l.value === value)?.label ?? value
}

export function LibrarySetCard({
  set,
  currentProfileId,
  onPreview,
  onPlay,
  onAssign,
  onDuplicate,
  onEdit,
  onToggleFavorite,
}: {
  set: LibrarySet
  currentProfileId: string
  onPreview: () => void
  onPlay: () => void
  onAssign: () => void
  onDuplicate: () => void
  onEdit: () => void
  onToggleFavorite: () => void
}) {
  const [busy, setBusy] = useState<'favorite' | null>(null)
  const isOwner = set.created_by === currentProfileId
  const VisIcon = VISIBILITY_ICON[set.visibility]
  const compatibleEngines = checkEngineCompatibility(GAME_ENGINES_V2, set.question_types).filter((r) => r.compatible)

  async function handleFavoriteClick() {
    setBusy('favorite')
    await onToggleFavorite()
    setBusy(null)
  }

  return (
    <GameV2Card padding="md" className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-tamil text-lg font-extrabold text-gamev2ink-900 dark:text-white truncate">
            {set.tamil_title || set.title}
          </p>
          {(set.english_title || (set.tamil_title && set.title !== set.tamil_title)) && (
            <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400 truncate">{set.english_title || set.title}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleFavoriteClick}
          disabled={busy === 'favorite'}
          aria-label={set.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={set.isFavorite}
          className={`flex-shrink-0 p-2 rounded-xl transition-colors ${
            set.isFavorite ? 'text-gamev2coral-500 bg-gamev2coral-50 dark:bg-gamev2coral-500/10' : 'text-gamev2ink-300 dark:text-gamev2ink-600 hover:text-gamev2coral-400'
          }`}
        >
          <FiHeart className={`w-4 h-4 ${set.isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>

      {set.description && <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400 mt-2 line-clamp-2">{set.description}</p>}

      <div className="flex flex-wrap gap-1.5 mt-3">
        {set.level && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gamev2ink-100 dark:bg-gamev2ink-800 text-gamev2ink-600 dark:text-gamev2ink-300">
            {levelLabel(set.level)}
          </span>
        )}
        {set.topic && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gamev2ink-100 dark:bg-gamev2ink-800 text-gamev2ink-600 dark:text-gamev2ink-300">
            {set.topic}
          </span>
        )}
        {set.difficulty && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold capitalize bg-gamev2spark-100 dark:bg-gamev2spark-500/20 text-gamev2spark-700 dark:text-gamev2spark-300">
            {set.difficulty}
          </span>
        )}
      </div>

      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-3 text-xs text-gamev2ink-400 dark:text-gamev2ink-500">
        <span>{set.question_count} question{set.question_count === 1 ? '' : 's'}</span>
        {set.estimated_duration_minutes && (
          <span className="flex items-center gap-1">
            <FiClock className="w-3 h-3" /> {set.estimated_duration_minutes} min
          </span>
        )}
        <span className="flex items-center gap-1">
          <VisIcon className="w-3 h-3" /> {set.visibility}
        </span>
        {set.usageCount > 0 && <span>Used {set.usageCount}×</span>}
        {set.creator && !isOwner && (
          <span>
            by {set.creator.first_name} {set.creator.last_name}
          </span>
        )}
      </div>

      <p className="text-[11px] text-gamev2ink-400 dark:text-gamev2ink-500 mt-2">
        {compatibleEngines.length} game{compatibleEngines.length === 1 ? '' : 's'} compatible:{' '}
        {compatibleEngines.length > 0 ? compatibleEngines.map((r) => r.engine.name).join(', ') : 'none yet'}
      </p>

      <div className="flex items-center flex-wrap gap-1.5 mt-4 pt-3 border-t border-gamev2ink-100 dark:border-gamev2ink-800">
        <GameV2Button size="md" variant="ghost" className="!min-h-0 !py-1.5 !px-3 !text-xs" onClick={onPreview}>
          <FiEye className="w-3.5 h-3.5" /> Preview
        </GameV2Button>
        <GameV2Button size="md" variant="ghost" className="!min-h-0 !py-1.5 !px-3 !text-xs" onClick={onPlay}>
          <FiPlay className="w-3.5 h-3.5" /> Play
        </GameV2Button>
        {isOwner && (
          <GameV2Button size="md" variant="ghost" className="!min-h-0 !py-1.5 !px-3 !text-xs" onClick={onAssign}>
            <FiSend className="w-3.5 h-3.5" /> Assign
          </GameV2Button>
        )}
        <GameV2Button size="md" variant="ghost" className="!min-h-0 !py-1.5 !px-3 !text-xs" onClick={onDuplicate}>
          <FiCopy className="w-3.5 h-3.5" /> Duplicate
        </GameV2Button>
        {isOwner && (
          <GameV2Button size="md" variant="ghost" className="!min-h-0 !py-1.5 !px-3 !text-xs" onClick={onEdit}>
            <FiEdit2 className="w-3.5 h-3.5" /> Edit
          </GameV2Button>
        )}
      </div>
    </GameV2Card>
  )
}
