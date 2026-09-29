'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FiUpload,
  FiFile,
  FiImage,
  FiVideo,
  FiMusic,
  FiFileText,
  FiTrash2,
  FiCheckSquare,
  FiSquare,
  FiEye,
  FiDownload,
  FiX,
  FiSend,
  FiCheckCircle,
  FiSearch,
  FiEdit2,
  FiFeather,
  FiLink,
  FiExternalLink,
  FiPlayCircle,
} from 'react-icons/fi'
import { Modal } from '@/components/dashboard/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { useConfirm } from '@/components/ui/ConfirmDialogProvider'
import { useSupabaseBrowserClient } from '@/lib/supabase/client'
import { uploadFile } from '@/lib/storage/uploadFile'
import { toast } from '@/lib/toast'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { ResourceTaxonomyFields, EMPTY_TAXONOMY, type TaxonomyState } from '@/components/resources/ResourceTaxonomyFields'
import { ResourceFilterPanel, EMPTY_FILTERS, type ResourceFilterState } from '@/components/resources/ResourceFilterPanel'
import { WorksheetGeneratorPanel } from '@/components/resources/WorksheetGeneratorPanel'
import { categoryLabel, subcategoryLabel, RESOURCE_DIFFICULTIES, RESOURCE_FORMATS, RESOURCE_SKILLS } from '@/lib/resourceTaxonomy'
import { GRADE_LEVEL_OPTIONS } from '@/lib/constants'
import { extractYouTubeId, youTubeThumbnailUrl, youTubeEmbedUrl } from '@/lib/youtube'
import { suggestTitleFromFile } from '@/lib/resourceTitle'

// One row of a (multi-)file upload: each file becomes its own resource.
// The name is pre-filled from the file (heading inside a PDF/.txt, else the
// file name) until the teacher edits it.
interface PendingUpload {
  key: string
  file: File
  title: string
  edited: boolean
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

export interface ResourceRow {
  id: string
  class_id: string | null
  title: string
  description: string | null
  file_url: string
  file_type: string | null
  file_size: number | null
  category: string | null
  subcategory: string | null
  difficulty: 'easy' | 'medium' | 'hard' | null
  format: string | null
  levels: string[]
  skills: string[]
  tags: string[]
  created_by: string | null
  // Story Generator share (migration 091): the assignment it was shared from
  shared_from_assignment_id?: string | null
  created_at: string
  class: { id: string; name: string } | null
  uploader: { first_name: string; last_name: string } | null
}

const IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']
const VIDEO_TYPES = ['mp4', 'mov', 'webm', 'avi']
const AUDIO_TYPES = ['mp3', 'wav', 'm4a', 'ogg']
const PDF_TYPES = ['pdf']
const OFFICE_TYPES = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx']
const TEXT_TYPES = ['txt', 'csv', 'md', 'json', 'log']

type Kind = 'image' | 'video' | 'audio' | 'pdf' | 'office' | 'text' | 'youtube' | 'link' | 'other'

function kindOf(fileType: string | null): Kind {
  if (!fileType) return 'other'
  const t = fileType.toLowerCase()
  if (t === 'youtube') return 'youtube'
  if (t === 'link') return 'link'
  if (IMAGE_TYPES.includes(t)) return 'image'
  if (VIDEO_TYPES.includes(t)) return 'video'
  if (AUDIO_TYPES.includes(t)) return 'audio'
  if (PDF_TYPES.includes(t)) return 'pdf'
  if (OFFICE_TYPES.includes(t)) return 'office'
  if (TEXT_TYPES.includes(t)) return 'text'
  return 'other'
}

function ThumbIcon({ fileType }: { fileType: string | null }) {
  const kind = kindOf(fileType)
  const cls = 'w-8 h-8'
  if (kind === 'image') return <FiImage className={cls} />
  if (kind === 'video' || kind === 'youtube') return <FiVideo className={cls} />
  if (kind === 'audio') return <FiMusic className={cls} />
  if (kind === 'pdf' || kind === 'office' || kind === 'text') return <FiFileText className={cls} />
  if (kind === 'link') return <FiLink className={cls} />
  return <FiFile className={cls} />
}

// .doc/.xls/.ppt (and their -x variants) have no native browser renderer
// -- Microsoft's own viewer can render any public URL, so this reuses it
// rather than requiring a download to read them.
function officeViewerUrl(fileUrl: string): string {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`
}

// Plain-text formats render better as text than in the object/iframe
// path other kinds use -- fetched once per preview open, not on every
// render.
function TextFilePreview({ fileUrl }: { fileUrl: string }) {
  const [text, setText] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setText(null)
    setFailed(false)
    fetch(fileUrl)
      .then((res) => {
        if (!res.ok) throw new Error('fetch failed')
        return res.text()
      })
      .then((body) => {
        if (!cancelled) setText(body)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [fileUrl])

  if (failed) {
    return <p className="p-4 text-sm text-stone-500 dark:text-stone-400">Couldn&apos;t load a preview for this file.</p>
  }
  if (text === null) {
    return <p className="p-4 text-sm text-stone-500 dark:text-stone-400">Loading preview...</p>
  }
  return (
    <pre className="w-full h-[65vh] overflow-auto p-4 text-xs text-stone-700 dark:text-stone-200 whitespace-pre-wrap break-words">
      {text}
    </pre>
  )
}

export function ResourcesClient({
  initialResources,
  classes,
  currentProfileId,
  canUpload,
  canUploadAllClasses,
  teacherClassIds,
  canAssign = false,
  assignedClassIdsByResource = {},
  resourceAssignments = {},
  canDeleteAny = false,
  canEditAny = false,
  canGenerateWorksheet = false,
}: {
  initialResources: ResourceRow[]
  classes: { id: string; name: string }[]
  currentProfileId: string
  canUpload: boolean
  canUploadAllClasses: boolean
  teacherClassIds: string[]
  canAssign?: boolean
  // Teacher view: resource id -> the caller's classes it's already assigned to
  assignedClassIdsByResource?: Record<string, string[]>
  resourceAssignments?: Record<string, { assignmentId: string; completed: boolean }>
  canDeleteAny?: boolean
  // Any teacher/admin can edit a resource's categorization even if they
  // didn't upload it -- distinct from canDeleteAny, which stays
  // owner-or-admin only since deleting is destructive.
  canEditAny?: boolean
  // Teacher-only, same population as canUpload -- gates the Worksheet
  // Generator entry point (see components/resources/WorksheetGeneratorPanel.tsx).
  canGenerateWorksheet?: boolean
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const supabase = useSupabaseBrowserClient()

  const [classFilter, setClassFilter] = useState(teacherClassIds.length > 0 ? 'mine' : 'all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 200)
  const [filters, setFilters] = useState<ResourceFilterState>(EMPTY_FILTERS)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file')
  const [worksheetGeneratorOpen, setWorksheetGeneratorOpen] = useState(false)
  const [preview, setPreview] = useState<ResourceRow | null>(null)
  const [pendingFiles, setPendingFiles] = useState<PendingUpload[]>([])
  // Bulk delete: only resources the caller may delete (owner or admin)
  // can be selected; the database enforces the same rule on delete.
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [uploadClassId, setUploadClassId] = useState<string>(teacherClassIds[0] ?? classes[0]?.id ?? '')
  const [uploadTaxonomy, setUploadTaxonomy] = useState<TaxonomyState>(EMPTY_TAXONOMY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editTarget, setEditTarget] = useState<ResourceRow | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editClassId, setEditClassId] = useState<string>('')
  const [editTaxonomy, setEditTaxonomy] = useState<TaxonomyState>(EMPTY_TAXONOMY)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [assignTarget, setAssignTarget] = useState<ResourceRow | null>(null)
  const [assignClassId, setAssignClassId] = useState<string>(teacherClassIds[0] ?? '')
  const [assignDueDate, setAssignDueDate] = useState('')
  const [assignMaxScore, setAssignMaxScore] = useState('100')
  const [assignPenalty, setAssignPenalty] = useState('0')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  const availableTypes = useMemo(() => {
    const types = new Set<string>()
    initialResources.forEach((r) => {
      if (r.file_type) types.add(r.file_type.toLowerCase())
    })
    return Array.from(types).sort()
  }, [initialResources])

  const availableTags = useMemo(() => {
    const tags = new Set<string>()
    initialResources.forEach((r) => r.tags.forEach((t) => tags.add(t)))
    return Array.from(tags).sort()
  }, [initialResources])

  const filtered = useMemo(() => {
    return initialResources.filter((r) => {
      if (classFilter === 'mine') {
        if (!r.class_id || !teacherClassIds.includes(r.class_id)) return false
      } else if (classFilter !== 'all') {
        if (r.class_id !== classFilter) return false
      }
      if (typeFilter !== 'all' && (r.file_type ?? '').toLowerCase() !== typeFilter) return false
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.trim().toLowerCase()
        const haystack = [r.title, r.description ?? '', categoryLabel(r.category), subcategoryLabel(r.category, r.subcategory) ?? '', ...r.tags]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      // AND across filter groups; each group here is single-valued except
      // tags, which is OR'd against the resource's own tag list.
      if (filters.category && r.category !== filters.category) return false
      if (filters.subcategory && r.subcategory !== filters.subcategory) return false
      if (filters.level && !r.levels.includes(filters.level)) return false
      if (filters.skill && !r.skills.includes(filters.skill)) return false
      if (filters.difficulty && r.difficulty !== filters.difficulty) return false
      if (filters.format && r.format !== filters.format) return false
      if (filters.tags.length > 0 && !filters.tags.some((t) => r.tags.includes(t))) return false
      return true
    })
  }, [initialResources, classFilter, typeFilter, teacherClassIds, debouncedSearch, filters])

  function openUpload() {
    setPendingFiles([])
    setLinkUrl('')
    setUploadMode('file')
    setTitle('')
    setDescription('')
    setUploadTaxonomy(EMPTY_TAXONOMY)
    setUploadClassId(teacherClassIds[0] ?? '')
    setError(null)
    setUploadOpen(true)
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()

    if (uploadMode === 'link') {
      if (!linkUrl.trim()) {
        setError('Enter a link')
        return
      }
      setSaving(true)
      setError(null)

      try {
        const fileType = extractYouTubeId(linkUrl.trim()) ? 'youtube' : 'link'

        const res = await fetch('/api/resources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description: description || null,
            fileUrl: linkUrl.trim(),
            fileType,
            classId: uploadClassId || null,
            category: uploadTaxonomy.category || null,
            subcategory: uploadTaxonomy.subcategory || null,
            difficulty: uploadTaxonomy.difficulty || null,
            format: uploadTaxonomy.format || null,
            levels: uploadTaxonomy.levels,
            skills: uploadTaxonomy.skills,
            tags: uploadTaxonomy.tags,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Failed to save resource')

        setUploadOpen(false)
        toast.success('Link added')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add link')
      } finally {
        setSaving(false)
      }
      return
    }

    const toUpload = pendingFiles.filter((p) => p.status !== 'done')
    if (toUpload.length === 0) {
      setError('Choose at least one file to upload')
      return
    }
    if (toUpload.some((p) => !p.title.trim())) {
      setError('Give every file a name')
      return
    }
    setSaving(true)
    setError(null)

    // One at a time, each its own resource; class, description and tags
    // apply to all. A failure doesn't stop the rest -- it stays in the
    // list with its error so the teacher can retry just that one.
    let uploaded = 0
    for (const item of toUpload) {
      setPendingFiles((prev) => prev.map((p) => (p.key === item.key ? { ...p, status: 'uploading', error: undefined } : p)))
      try {
        const { publicUrl } = await uploadFile({ supabase, bucket: 'resources', file: item.file })
        if (!publicUrl) throw new Error('Upload succeeded but no URL was returned')

        const ext = item.file.name.includes('.') ? item.file.name.split('.').pop()!.toLowerCase() : null

        const res = await fetch('/api/resources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: item.title.trim(),
            description: description || null,
            fileUrl: publicUrl,
            fileType: ext,
            fileSize: item.file.size,
            classId: uploadClassId || null,
            category: uploadTaxonomy.category || null,
            subcategory: uploadTaxonomy.subcategory || null,
            difficulty: uploadTaxonomy.difficulty || null,
            format: uploadTaxonomy.format || null,
            levels: uploadTaxonomy.levels,
            skills: uploadTaxonomy.skills,
            tags: uploadTaxonomy.tags,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Failed to save resource')

        uploaded++
        setPendingFiles((prev) => prev.map((p) => (p.key === item.key ? { ...p, status: 'done' } : p)))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed'
        setPendingFiles((prev) => prev.map((p) => (p.key === item.key ? { ...p, status: 'error', error: message } : p)))
      }
    }

    setSaving(false)
    if (uploaded > 0) router.refresh()
    if (uploaded === toUpload.length) {
      setUploadOpen(false)
      toast.success(uploaded === 1 ? 'Resource uploaded' : `${uploaded} resources uploaded`)
    } else {
      setError(`${uploaded} of ${toUpload.length} uploaded. Fix or remove the ones marked below and click Upload again.`)
    }
  }

  function addFiles(list: FileList | null) {
    const added: PendingUpload[] = Array.from(list ?? []).map((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      title: '',
      edited: false,
      status: 'pending',
    }))
    setPendingFiles((prev) => [...prev, ...added])
    for (const item of added) {
      suggestTitleFromFile(item.file).then((suggested) =>
        setPendingFiles((prev) => prev.map((p) => (p.key === item.key && !p.edited ? { ...p, title: suggested } : p)))
      )
    }
  }

  function openEdit(resource: ResourceRow) {
    setEditTarget(resource)
    setEditTitle(resource.title)
    setEditDescription(resource.description ?? '')
    setEditClassId(resource.class_id ?? '')
    setEditTaxonomy({
      category: resource.category ?? '',
      subcategory: resource.subcategory ?? '',
      difficulty: resource.difficulty ?? '',
      format: resource.format ?? '',
      levels: resource.levels,
      skills: resource.skills,
      tags: resource.tags,
    })
    setEditError(null)
  }

  // Whether THIS resource's class can be reassigned by the current
  // user -- moving a resource to a different class is owner-or-admin
  // only (see app/api/resources/[id]/route.ts's PATCH), unlike
  // taxonomy edits which any teacher/admin can make on any resource.
  // canDeleteAny is already scoped to the same "admin, or nothing"
  // population as that check (delete is also owner-or-admin), so it
  // doubles as the admin half of this gate.
  function canEditClass(resource: ResourceRow): boolean {
    return canDeleteAny || resource.created_by === currentProfileId
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editTarget) return
    setEditSaving(true)
    setEditError(null)

    const res = await fetch(`/api/resources/${editTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editTitle,
        description: editDescription || null,
        ...(canEditClass(editTarget) ? { classId: editClassId || null } : {}),
        category: editTaxonomy.category || null,
        subcategory: editTaxonomy.subcategory || null,
        difficulty: editTaxonomy.difficulty || null,
        format: editTaxonomy.format || null,
        levels: editTaxonomy.levels,
        skills: editTaxonomy.skills,
        tags: editTaxonomy.tags,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setEditSaving(false)

    if (res.ok) {
      toast.success('Resource updated')
      setEditTarget(null)
      router.refresh()
    } else {
      setEditError(data.error || 'Failed to update resource')
    }
  }

  // A plain <a download> only forces a save (vs. just opening the file)
  // for same-origin URLs -- Storage links are on Supabase's own domain,
  // so the browser ignores the hint and navigates to it instead. Fetching
  // the bytes ourselves and downloading a blob: URL (same-origin by
  // definition) makes the browser's real "Save As" behavior fire
  // consistently, letting the user pick where it goes.
  async function handleDownload(resource: ResourceRow) {
    try {
      const res = await fetch(resource.file_url)
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const filename = resource.file_type ? `${resource.title}.${resource.file_type}` : resource.title

      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(blobUrl)
    } catch {
      toast.error('Failed to download file')
    }
  }

  function canDelete(resource: ResourceRow): boolean {
    return canDeleteAny || resource.created_by === currentProfileId
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    const confirmed = await confirm({
      title: `Delete ${ids.length} resource${ids.length === 1 ? '' : 's'}?`,
      description: 'They will be removed for everyone. This cannot be undone.',
      confirmLabel: `Delete ${ids.length}`,
      tone: 'danger',
    })
    if (!confirmed) return

    setBulkDeleting(true)
    const res = await fetch('/api/resources/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    const data = await res.json().catch(() => ({}))
    setBulkDeleting(false)
    if (!res.ok) {
      toast.error(data.error || 'Failed to delete resources')
      return
    }
    const deleted: number = data.deleted?.length ?? 0
    if (deleted === ids.length) toast.success(`Deleted ${deleted} resource${deleted === 1 ? '' : 's'}`)
    else toast.error(`Deleted ${deleted} of ${ids.length} -- the rest weren't yours to delete or were already gone`)
    exitSelectMode()
    router.refresh()
  }

  async function handleDelete(resource: ResourceRow) {
    const confirmed = await confirm({
      title: `Delete "${resource.title}"?`,
      description: 'This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!confirmed) return

    const res = await fetch(`/api/resources/${resource.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      toast.success('Resource deleted')
      setPreview(null)
      router.refresh()
    } else {
      toast.error(data.error || 'Failed to delete resource')
    }
  }

  function openAssign(resource: ResourceRow) {
    setAssignTarget(resource)
    // Prefer a class that doesn't have this resource yet
    const alreadyIn = assignedClassIdsByResource[resource.id] ?? []
    const preferred = resource.class_id && teacherClassIds.includes(resource.class_id) ? resource.class_id : null
    setAssignClassId(
      preferred && !alreadyIn.includes(preferred)
        ? preferred
        : (teacherClassIds.find((id) => !alreadyIn.includes(id)) ?? preferred ?? teacherClassIds[0] ?? '')
    )
    setAssignDueDate('')
    setAssignMaxScore('100')
    setAssignPenalty('0')
    setAssignError(null)
  }

  // Assigning a resource just creates a normal sms_assignments row
  // linked back to it (resource_id) -- due date, scoring, and the late
  // decay preview are the exact same machinery every other assignment
  // already uses, so nothing about grading needed to be rebuilt here.
  const assignAlreadyAssigned = Boolean(assignTarget && assignedClassIdsByResource[assignTarget.id]?.includes(assignClassId))

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!assignTarget) return
    if (!assignClassId) {
      setAssignError('Choose a class')
      return
    }
    setAssigning(true)
    setAssignError(null)

    const res = await fetch('/api/teacher/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classId: assignClassId,
        title: assignTarget.title,
        description: assignTarget.description,
        dueDate: assignDueDate || null,
        maxScore: assignMaxScore,
        pointsDeductionPerDay: assignPenalty,
        published: true,
        resourceId: assignTarget.id,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setAssigning(false)

    if (res.ok) {
      toast.success(`Assigned "${assignTarget.title}" to your class`)
      setAssignTarget(null)
      router.refresh()
    } else {
      setAssignError(data.error || 'Failed to assign resource')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by file name..."
              className="pl-9 pr-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent w-48 sm:w-56"
            />
          </div>

          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          >
            {teacherClassIds.length > 0 && <option value="mine">My Classes</option>}
            <option value="all">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          >
            <option value="all">All File Types</option>
            {availableTypes.map((t) => (
              <option key={t} value={t}>
                .{t}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          {initialResources.some(canDelete) && !selectMode && (
            <Button variant="outline" size="sm" icon={<FiCheckSquare />} onClick={() => setSelectMode(true)}>
              Select
            </Button>
          )}
          {canGenerateWorksheet && (
            <Button variant="outline" size="sm" icon={<FiFeather />} onClick={() => setWorksheetGeneratorOpen(true)}>
              Generate Worksheet
            </Button>
          )}
          {canUpload && (
            <Button variant="primary" size="sm" icon={<FiUpload />} onClick={openUpload}>
              Upload Resource
            </Button>
          )}
        </div>
      </div>

      <ResourceFilterPanel value={filters} onChange={setFilters} availableTags={availableTags} />

      {selectMode && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl border border-primary-200 dark:border-primary-900 bg-primary-50/95 dark:bg-primary-950/95 backdrop-blur">
          <span className="text-sm font-semibold text-primary-900 dark:text-primary-200 mr-auto">
            {selectedIds.size === 0 ? 'Tick the resources to delete' : `${selectedIds.size} selected`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set(filtered.filter(canDelete).map((r) => r.id)))}
            disabled={bulkDeleting}
          >
            Select all mine shown ({filtered.filter(canDelete).length})
          </Button>
          {selectedIds.size > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} disabled={bulkDeleting}>
              Clear
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={<FiTrash2 />}
            onClick={handleBulkDelete}
            disabled={selectedIds.size === 0 || bulkDeleting}
          >
            {bulkDeleting ? 'Deleting...' : `Delete ${selectedIds.size || ''}`.trim()}
          </Button>
          <Button variant="outline" size="sm" onClick={exitSelectMode} disabled={bulkDeleting}>
            Done
          </Button>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title="No resources found matching your selected filters"
          description="Try a different search or filter, or clear all filters."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((r) => (
            <div
              key={r.id}
              className={`relative rounded-2xl border bg-white dark:bg-stone-900 overflow-hidden flex flex-col ${
                selectMode && selectedIds.has(r.id)
                  ? 'border-terracotta-500 ring-2 ring-terracotta-400 dark:border-terracotta-500'
                  : 'border-stone-200 dark:border-stone-800'
              }`}
            >
              {selectMode && canDelete(r) && (
                <button
                  type="button"
                  onClick={() => toggleSelected(r.id)}
                  aria-pressed={selectedIds.has(r.id)}
                  aria-label={`${selectedIds.has(r.id) ? 'Unselect' : 'Select'} ${r.title}`}
                  className="absolute top-2 left-2 z-10 p-1.5 rounded-lg bg-white/90 dark:bg-stone-900/90 shadow text-terracotta-600 dark:text-terracotta-400"
                >
                  {selectedIds.has(r.id) ? <FiCheckSquare className="w-5 h-5" /> : <FiSquare className="w-5 h-5" />}
                </button>
              )}
              <button
                type="button"
                onClick={() => (selectMode && canDelete(r) ? toggleSelected(r.id) : setPreview(r))}
                className="relative aspect-square flex items-center justify-center bg-stone-50 dark:bg-stone-950/40 text-stone-400 dark:text-stone-600 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                {kindOf(r.file_type) === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element -- resource thumbnail, arbitrary Storage URL
                  <img src={r.file_url} alt="" className="w-full h-full object-cover" />
                ) : kindOf(r.file_type) === 'youtube' && extractYouTubeId(r.file_url) ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail, no next/image domain config needed */}
                    <img
                      src={youTubeThumbnailUrl(extractYouTubeId(r.file_url)!)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <FiPlayCircle className="absolute inset-0 m-auto w-10 h-10 text-white drop-shadow-lg" />
                  </>
                ) : (
                  <ThumbIcon fileType={r.file_type} />
                )}
              </button>
              <div className="p-3 flex-1 flex flex-col gap-1">
                <p className="text-sm font-semibold text-stone-800 dark:text-stone-100 line-clamp-2">{r.title}</p>
                <p className="text-xs text-stone-400 dark:text-stone-500">
                  {r.class?.name ?? 'All Classes'}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {canAssign && assignedClassIdsByResource[r.id]?.length > 0 && (
                    <span
                      title={`Already assigned to: ${assignedClassIdsByResource[r.id]
                        .map((id) => classes.find((c) => c.id === id)?.name ?? 'a class')
                        .join(', ')}`}
                    >
                      <Badge variant="success" size="sm">
                        <span className="inline-flex items-center gap-1">
                          <FiCheckCircle className="w-3 h-3" /> Assigned
                        </span>
                      </Badge>
                    </span>
                  )}
                  {(r.category || r.subcategory) && (
                    <Badge variant="neutral" size="sm">
                      {subcategoryLabel(r.category, r.subcategory) ?? categoryLabel(r.category)}
                    </Badge>
                  )}
                  {r.levels[0] && (
                    <Badge variant="secondary" size="sm">
                      {GRADE_LEVEL_OPTIONS.find((l) => l.value === r.levels[0])?.label ?? r.levels[0]}
                      {r.levels.length > 1 ? ` +${r.levels.length - 1}` : ''}
                    </Badge>
                  )}
                  {r.difficulty && (
                    <Badge variant={r.difficulty === 'easy' ? 'success' : r.difficulty === 'hard' ? 'secondary' : 'gold'} size="sm">
                      {RESOURCE_DIFFICULTIES.find((d) => d.value === r.difficulty)?.label ?? r.difficulty}
                    </Badge>
                  )}
                  {r.format && (
                    <Badge variant="primary" size="sm">
                      {RESOURCE_FORMATS.find((f) => f.value === r.format)?.label ?? r.format}
                    </Badge>
                  )}
                </div>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPreview(r)}
                      className="p-1.5 rounded-lg text-stone-500 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
                      aria-label="Preview"
                    >
                      <FiEye className="w-4 h-4" />
                    </button>
                    {kindOf(r.file_type) === 'youtube' || kindOf(r.file_type) === 'link' ? (
                      <a
                        href={r.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-stone-500 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors inline-flex"
                        aria-label="Open link"
                      >
                        <FiExternalLink className="w-4 h-4" />
                      </a>
                    ) : (
                      <button
                        onClick={() => handleDownload(r)}
                        className="p-1.5 rounded-lg text-stone-500 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors inline-flex"
                        aria-label="Download"
                      >
                        <FiDownload className="w-4 h-4" />
                      </button>
                    )}
                    {canAssign && (
                      <button
                        onClick={() => openAssign(r)}
                        className="p-1.5 rounded-lg text-stone-500 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
                        aria-label="Assign as reading exercise"
                      >
                        <FiSend className="w-4 h-4" />
                      </button>
                    )}
                    {resourceAssignments[r.id] &&
                      (resourceAssignments[r.id].completed ? (
                        <span className="p-1.5 text-primary-600 dark:text-primary-400" aria-label="Completed">
                          <FiCheckCircle className="w-4 h-4" />
                        </span>
                      ) : (
                        <Link
                          href={`/student/assignments/${resourceAssignments[r.id].assignmentId}`}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors inline-flex"
                          aria-label="Record and submit"
                        >
                          <FiCheckCircle className="w-4 h-4" />
                        </Link>
                      ))}
                  </div>
                  <div className="flex items-center gap-1">
                    {(canEditAny || canDeleteAny || r.created_by === currentProfileId) && (
                      <button
                        onClick={() => openEdit(r)}
                        className="p-1.5 rounded-lg text-stone-500 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
                        aria-label="Edit"
                      >
                        <FiEdit2 className="w-4 h-4" />
                      </button>
                    )}
                    {(canDeleteAny || r.created_by === currentProfileId) && (
                      <button
                        onClick={() => handleDelete(r)}
                        className="p-1.5 rounded-lg text-terracotta-600 hover:bg-terracotta-50 dark:hover:bg-terracotta-950/40 transition-colors"
                        aria-label="Delete"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={uploadOpen} title="Add Resource" onClose={() => setUploadOpen(false)}>
        <form
          onSubmit={handleUpload}
          // A file dropped anywhere else in the form would make the browser
          // open it and leave the page
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => e.preventDefault()}
          className="space-y-4"
        >
          {error && (
            <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setUploadMode('file')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                uploadMode === 'file'
                  ? 'border-primary-700 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-950 dark:text-primary-300'
                  : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300'
              }`}
            >
              <FiUpload className="w-4 h-4 inline mr-1.5" /> Upload File
            </button>
            <button
              type="button"
              onClick={() => setUploadMode('link')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                uploadMode === 'link'
                  ? 'border-primary-700 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-950 dark:text-primary-300'
                  : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300'
              }`}
            >
              <FiLink className="w-4 h-4 inline mr-1.5" /> Add Link
            </button>
          </div>

          {uploadMode === 'file' ? (
            <div>
              <p className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Files</p>
              {/* Drop zone: the whole box is the (visually hidden) file input's
                  label, so clicking opens the picker and files can also be dropped */}
              <label
                onDragOver={(e) => {
                  e.preventDefault()
                  if (!saving) setDragActive(true)
                }}
                onDragLeave={(e) => {
                  // Moving over the text inside the box fires dragleave too
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragActive(false)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragActive(false)
                  if (!saving) addFiles(e.dataTransfer.files)
                }}
                className={`flex flex-col items-center justify-center gap-1.5 px-4 py-6 rounded-xl border-2 border-dashed text-center transition-colors ${
                  saving ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                } ${
                  dragActive
                    ? 'border-primary-600 bg-primary-50 dark:border-primary-400 dark:bg-primary-950/40'
                    : 'border-stone-300 dark:border-stone-700 hover:border-primary-400 hover:bg-stone-50 dark:hover:bg-stone-800/50'
                }`}
              >
                <FiUpload className="w-6 h-6 text-primary-700 dark:text-primary-400" />
                <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">
                  {dragActive ? 'Drop the files here' : 'Drag and drop files here, or click to choose'}
                </span>
                <span className="text-xs text-stone-500 dark:text-stone-400">
                  You can pick several at once (Ctrl-click or Shift-click; ⌘-click on a Mac)
                </span>
                <input
                  type="file"
                  multiple
                  onChange={(e) => {
                    addFiles(e.target.files)
                    e.target.value = ''
                  }}
                  disabled={saving}
                  className="sr-only"
                />
              </label>
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-1.5">
                Each file becomes its own resource. Names are read from the title in each image, PDF or text file (images take a
                few seconds each), otherwise taken from the file name. Check them before uploading.
              </p>

              {pendingFiles.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {pendingFiles.map((p) => (
                    <li
                      key={p.key}
                      className={`rounded-lg border p-2.5 ${
                        p.status === 'error'
                          ? 'border-terracotta-300 dark:border-terracotta-800'
                          : p.status === 'done'
                            ? 'border-primary-300 dark:border-primary-800 opacity-70'
                            : 'border-stone-200 dark:border-stone-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs text-stone-500 dark:text-stone-400 truncate" title={p.file.name}>
                          {p.file.name}
                        </span>
                        <span className="flex items-center gap-2 flex-shrink-0 text-xs font-semibold">
                          {p.status === 'uploading' && <span className="text-stone-500">Uploading...</span>}
                          {p.status === 'done' && (
                            <span className="inline-flex items-center gap-1 text-primary-700 dark:text-primary-400">
                              <FiCheckCircle className="w-3.5 h-3.5" /> Uploaded
                            </span>
                          )}
                          {(p.status === 'pending' || p.status === 'error') && !saving && (
                            <button
                              type="button"
                              onClick={() => setPendingFiles((prev) => prev.filter((x) => x.key !== p.key))}
                              className="p-1 rounded text-stone-400 hover:text-terracotta-600"
                              aria-label={`Remove ${p.file.name}`}
                            >
                              <FiX className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={p.title}
                        placeholder="Reading the title from the file..."
                        onChange={(e) =>
                          setPendingFiles((prev) => prev.map((x) => (x.key === p.key ? { ...x, title: e.target.value, edited: true } : x)))
                        }
                        disabled={saving || p.status === 'done'}
                        aria-label={`Name for ${p.file.name}`}
                        className="w-full px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                      />
                      {p.error && <p className="text-xs text-terracotta-700 dark:text-terracotta-300 mt-1">{p.error}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                Link (YouTube or any URL)
              </label>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                required
                className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
              />
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
                A YouTube link shows a video thumbnail; any other link opens in a new tab when clicked.
              </p>
            </div>
          )}

          {uploadMode === 'link' && (
            <div>
              <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Name</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Class</label>
            <select
              value={uploadClassId}
              onChange={(e) => setUploadClassId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            >
              <option value="">All Classes / Everyone</option>
              {(canUploadAllClasses ? classes : classes.filter((c) => teacherClassIds.includes(c.id))).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <ResourceTaxonomyFields value={uploadTaxonomy} onChange={setUploadTaxonomy} />

          <Button type="submit" variant="primary" fullWidth disabled={saving}>
            {saving
              ? `Uploading ${Math.min(pendingFiles.filter((p) => p.status === 'done').length + 1, pendingFiles.length)} of ${pendingFiles.length}...`
              : uploadMode === 'file' && pendingFiles.filter((p) => p.status !== 'done').length > 1
                ? `Upload ${pendingFiles.filter((p) => p.status !== 'done').length} files`
                : 'Upload'}
          </Button>
        </form>
      </Modal>

      <Modal open={editTarget !== null} title="Edit Resource" onClose={() => setEditTarget(null)} size="large">
        <form onSubmit={handleEdit} className="space-y-4">
          {editError && (
            <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
              {editError}
            </p>
          )}

          <div>
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Name</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Description (optional)
            </label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            />
          </div>

          {editTarget && (
            <div>
              <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Class</label>
              {canEditClass(editTarget) ? (
                <select
                  value={editClassId}
                  onChange={(e) => setEditClassId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                >
                  <option value="">All Classes / Everyone</option>
                  {(canUploadAllClasses ? classes : classes.filter((c) => teacherClassIds.includes(c.id))).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                // Only the uploader or an admin can move a resource to a
                // different class (see app/api/resources/[id]/route.ts) --
                // shown read-only here so it's still visible, per the
                // original complaint that the class wasn't shown at all.
                <p className="text-sm text-stone-600 dark:text-stone-300 px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-800/60">
                  {editTarget.class?.name ?? 'All Classes / Everyone'}
                </p>
              )}
            </div>
          )}

          <ResourceTaxonomyFields value={editTaxonomy} onChange={setEditTaxonomy} />

          <Button type="submit" variant="primary" fullWidth disabled={editSaving}>
            {editSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </Modal>

      <Modal open={preview !== null} title={preview?.title ?? ''} onClose={() => setPreview(null)} size="large">
        {preview && (
          <div className="space-y-4">
            <div className="rounded-xl overflow-hidden bg-stone-50 dark:bg-stone-950/40 flex items-center justify-center min-h-[10rem]">
              {kindOf(preview.file_type) === 'image' && (
                // eslint-disable-next-line @next/next/no-img-element -- resource preview, arbitrary Storage URL
                <img src={preview.file_url} alt="" className="max-h-[70vh] w-full object-contain" />
              )}
              {kindOf(preview.file_type) === 'video' && (
                <video controls src={preview.file_url} className="max-h-[70vh] w-full" />
              )}
              {kindOf(preview.file_type) === 'audio' && (
                <audio controls src={preview.file_url} className="w-full m-4" />
              )}
              {kindOf(preview.file_type) === 'pdf' && (
                <iframe src={preview.file_url} className="w-full h-[70vh]" title={preview.title} />
              )}
              {kindOf(preview.file_type) === 'office' && (
                <iframe src={officeViewerUrl(preview.file_url)} className="w-full h-[70vh]" title={preview.title} />
              )}
              {kindOf(preview.file_type) === 'text' && <TextFilePreview fileUrl={preview.file_url} />}
              {kindOf(preview.file_type) === 'youtube' && extractYouTubeId(preview.file_url) && (
                <iframe
                  src={youTubeEmbedUrl(extractYouTubeId(preview.file_url)!)}
                  className="w-full aspect-video"
                  title={preview.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
              {kindOf(preview.file_type) === 'link' && (
                <div className="py-10 text-stone-400 dark:text-stone-600 flex flex-col items-center gap-2">
                  <FiLink className="w-8 h-8" />
                  <a
                    href={preview.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-primary-700 dark:text-primary-400 hover:underline inline-flex items-center gap-1"
                  >
                    Open link <FiExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
              {kindOf(preview.file_type) === 'other' && (
                <div className="py-10 text-stone-400 dark:text-stone-600 flex flex-col items-center gap-2">
                  <ThumbIcon fileType={preview.file_type} />
                  <p className="text-sm">No preview available for this file type -- download to view it.</p>
                </div>
              )}
            </div>

            {preview.description && (
              <p className="text-sm text-stone-600 dark:text-stone-300">{preview.description}</p>
            )}

            <div className="flex flex-wrap gap-1.5">
              {(preview.category || preview.subcategory) && (
                <Badge variant="neutral" size="sm">
                  {subcategoryLabel(preview.category, preview.subcategory) ?? categoryLabel(preview.category)}
                </Badge>
              )}
              {preview.difficulty && (
                <Badge variant={preview.difficulty === 'easy' ? 'success' : preview.difficulty === 'hard' ? 'secondary' : 'gold'} size="sm">
                  {RESOURCE_DIFFICULTIES.find((d) => d.value === preview.difficulty)?.label ?? preview.difficulty}
                </Badge>
              )}
              {preview.format && (
                <Badge variant="primary" size="sm">
                  {RESOURCE_FORMATS.find((f) => f.value === preview.format)?.label ?? preview.format}
                </Badge>
              )}
              {preview.levels.map((l) => (
                <Badge key={l} variant="secondary" size="sm">
                  {GRADE_LEVEL_OPTIONS.find((g) => g.value === l)?.label ?? l}
                </Badge>
              ))}
              {preview.skills.map((s) => (
                <Badge key={s} variant="gold" size="sm">
                  {RESOURCE_SKILLS.find((sk) => sk.value === s)?.label ?? s}
                </Badge>
              ))}
              {preview.tags.map((t) => (
                <Badge key={t} variant="neutral" size="sm">
                  {t}
                </Badge>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2">
              {(canEditAny || canDeleteAny || preview.created_by === currentProfileId) && (
                <button
                  onClick={() => openEdit(preview)}
                  className="p-2 rounded-lg text-stone-500 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
                  aria-label="Edit"
                >
                  <FiEdit2 className="w-4 h-4" />
                </button>
              )}
              {(canDeleteAny || preview.created_by === currentProfileId) && (
                <button
                  onClick={() => handleDelete(preview)}
                  className="p-2 rounded-lg text-terracotta-600 hover:bg-terracotta-50 dark:hover:bg-terracotta-950/40 transition-colors"
                  aria-label="Delete"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setPreview(null)}
                className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                aria-label="Close"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={assignTarget !== null} title={`Assign "${assignTarget?.title ?? ''}"`} onClose={() => setAssignTarget(null)}>
        <form onSubmit={handleAssign} className="space-y-4">
          {assignError && (
            <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
              {assignError}
            </p>
          )}

          <div>
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Class</label>
            <select
              value={assignClassId}
              onChange={(e) => setAssignClassId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            >
              {teacherClassIds.length === 0 && <option value="">No classes assigned to you</option>}
              {classes
                .filter((c) => teacherClassIds.includes(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {assignTarget && assignedClassIdsByResource[assignTarget.id]?.includes(c.id) ? ' (already assigned)' : ''}
                  </option>
                ))}
            </select>
            {assignAlreadyAssigned && (
              <p className="mt-1.5 text-sm text-gold-800 dark:text-gold-300">
                Already assigned to this class -- assigning it again would create a duplicate. Edit or delete the existing one from Assignments
                instead.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Due Date</label>
              <input
                type="date"
                value={assignDueDate}
                onChange={(e) => setAssignDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Max Score</label>
              <input
                type="number"
                min="1"
                value={assignMaxScore}
                onChange={(e) => setAssignMaxScore(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Late Penalty (points/day)
            </label>
            <input
              type="number"
              min="0"
              value={assignPenalty}
              onChange={(e) => setAssignPenalty(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            />
          </div>

          <Button type="submit" variant="primary" fullWidth disabled={assigning || teacherClassIds.length === 0 || assignAlreadyAssigned}>
            {assigning ? 'Assigning...' : 'Assign'}
          </Button>
        </form>
      </Modal>

      {canGenerateWorksheet && (
        <WorksheetGeneratorPanel
          open={worksheetGeneratorOpen}
          onClose={() => setWorksheetGeneratorOpen(false)}
          classes={classes.filter((c) => teacherClassIds.includes(c.id))}
        />
      )}
    </div>
  )
}
