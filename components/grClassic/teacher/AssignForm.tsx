'use client'

import { useEffect, useState } from 'react'
import { FiCheck, FiCheckCircle, FiSend } from 'react-icons/fi'
import { formatDue, inDays } from '@/lib/grClassic/format'
import { DEFAULT_ASSIGNMENT_SETTINGS, type AssignmentSettings, type GameType, type TeacherClass } from '@/lib/grClassic/types'
import { Advanced, Button, ButtonLink, Card, Segmented, Shell, Toggle, TypeChip } from '../ui'
import { grcApi } from './api'

export interface AssignableGame {
  id: string
  title: string
  type: GameType
  category: string
  questionCount: number
}

// Local "YYYY-MM-DDTHH:mm" for <input type="datetime-local">.
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function settingsSummary(s: AssignmentSettings): string {
  return [
    s.maxAttempts === null ? 'Unlimited attempts' : `${s.maxAttempts} attempt${s.maxAttempts === 1 ? '' : 's'}`,
    s.timerMinutes ? `${s.timerMinutes} min timer` : 'No timer',
    s.scorePolicy === 'best' ? 'Best score counts' : 'Latest score counts',
    s.allowLate ? 'Late work allowed' : 'No late work',
  ].join(' · ')
}

// Assign: pick classes, pick a due date, publish. Three decisions; the
// rest are sensible defaults under "Advanced options".
export function AssignForm({ game, classes }: { game: AssignableGame; classes: TeacherClass[] }) {
  const [classIds, setClassIds] = useState<string[]>([])
  // Set in the browser so the default uses the teacher's own time zone.
  const [due, setDue] = useState('')
  useEffect(() => setDue(toLocalInput(inDays(7))), [])
  const [settings, setSettings] = useState<AssignmentSettings>(DEFAULT_ASSIGNMENT_SETTINGS)
  const [error, setError] = useState('')
  const [published, setPublished] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const set = <K extends keyof AssignmentSettings>(k: K, v: AssignmentSettings[K]) => setSettings((s) => ({ ...s, [k]: v }))
  const chosen = classes.filter((c) => classIds.includes(c.id))
  const students = chosen.reduce((n, c) => n + c.studentCount, 0)

  const publish = async () => {
    if (classIds.length === 0) return setError('Pick at least one class.')
    if (!due || new Date(due).getTime() <= Date.now()) return setError('Pick a due date in the future.')
    setError('')
    setPublishing(true)
    const res = await grcApi<{ id: string }>('/assignments', { method: 'POST', body: { gameId: game.id, classIds, dueAt: new Date(due).toISOString(), settings } })
    setPublishing(false)
    if (!res.ok) return setError(res.error)
    setPublished(res.data.id)
  }

  if (published) {
    return (
      <Shell back={{ href: '/gr-classic/teacher', label: 'My Games' }} width="max-w-2xl">
        <Card className="p-8 text-center">
          <FiCheckCircle aria-hidden className="mx-auto h-16 w-16 text-emerald-500" />
          <h1 className="mt-3 text-3xl font-black text-slate-900">Assignment published!</h1>
          <p className="mt-2 font-semibold text-slate-600">
            “{game.title}” is now in My Assignments for {chosen.map((c) => c.name).join(', ')} ({students} students).
          </p>
          <p className="font-bold text-slate-800">Due {formatDue(new Date(due).toISOString())}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href={`/gr-classic/teacher/assignments/${published}`} tone="teal">
              View results
            </ButtonLink>
            <ButtonLink href="/gr-classic/teacher" tone="plain">
              Back to My Games
            </ButtonLink>
          </div>
        </Card>
      </Shell>
    )
  }

  return (
    <Shell back={{ href: '/gr-classic/teacher', label: 'My Games' }} width="max-w-2xl">
      <h1 className="text-3xl font-black text-slate-900">Assign a game</h1>
      <Card className="mt-4 flex items-center gap-4 p-5">
        <div className="min-w-0 flex-1">
          <p className="text-xl font-extrabold text-slate-900">{game.title}</p>
          <p className="text-sm font-semibold text-slate-500">
            {game.questionCount} {game.type === 'match' ? 'boards' : 'questions'}
            {game.category && ` · ${game.category}`}
          </p>
        </div>
        <TypeChip type={game.type} />
      </Card>

      <Card className="mt-4 space-y-6 p-5 sm:p-6">
        <fieldset>
          <legend className="mb-2 text-lg font-extrabold text-slate-900">1. Which classes?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {classes.length === 0 && <p className="font-semibold text-slate-600 sm:col-span-3">You don’t have any classes yet. Ask the school admin to add you to a class first.</p>}
            {classes.map((c) => {
              const on = classIds.includes(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setClassIds((ids) => (on ? ids.filter((x) => x !== c.id) : [...ids, c.id]))}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left ring-2 transition ${on ? 'bg-teal-50 ring-teal-600' : 'bg-white ring-slate-200 hover:ring-slate-300'}`}
                >
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${on ? 'bg-teal-600 text-white' : 'bg-slate-100'}`}>{on && <FiCheck aria-hidden />}</span>
                  <span>
                    <span className="block font-extrabold text-slate-900">{c.name}</span>
                    <span className="block text-xs font-semibold text-slate-500">{c.studentCount} students</span>
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="grc-due" className="mb-2 block text-lg font-extrabold text-slate-900">
            2. Due date
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input id="grc-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="rounded-xl border-0 px-3.5 py-2.5 text-base font-semibold ring-2 ring-slate-200 focus:outline-none focus:ring-teal-500" />
            {[
              { label: 'Tomorrow', days: 1 },
              { label: 'In 1 week', days: 7 },
              { label: 'In 2 weeks', days: 14 },
            ].map((q) => (
              <Button key={q.label} tone="plain" size="sm" onClick={() => setDue(toLocalInput(inDays(q.days)))}>
                {q.label}
              </Button>
            ))}
          </div>
        </div>

        <Advanced summary={settingsSummary(settings)}>
          <Segmented label="Attempts" value={settings.maxAttempts} onChange={(v) => set('maxAttempts', v)} options={[{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }, { value: null, label: 'Unlimited' }]} />
          <Segmented label="Timer" value={settings.timerMinutes} onChange={(v) => set('timerMinutes', v)} options={[{ value: null, label: 'No timer' }, { value: 10, label: '10 min' }, { value: 20, label: '20 min' }, { value: 30, label: '30 min' }]} />
          <Segmented label="Passing score" value={settings.passingPercent} onChange={(v) => set('passingPercent', v)} options={[{ value: null, label: 'None' }, { value: 50, label: '50%' }, { value: 70, label: '70%' }, { value: 80, label: '80%' }]} />
          <Segmented label="Which score counts" value={settings.scorePolicy} onChange={(v) => set('scorePolicy', v)} options={[{ value: 'best', label: 'Best attempt' }, { value: 'latest', label: 'Latest attempt' }]} />
          <Segmented label="Show correct answers" value={settings.showAnswers} onChange={(v) => set('showAnswers', v)} options={[{ value: 'after-due', label: 'After due date' }, { value: 'after-submit', label: 'Right after submitting' }, { value: 'never', label: 'Never' }]} />
          <Toggle label="Shuffle question order" checked={settings.randomize} onChange={(v) => set('randomize', v)} />
          <Toggle label="Allow late submissions" hint="Students can still submit after the due date" checked={settings.allowLate} onChange={(v) => set('allowLate', v)} />
        </Advanced>

        {error && (
          <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 font-bold text-rose-800 ring-1 ring-rose-200">
            {error}
          </p>
        )}
        <Button tone="teal" size="lg" className="w-full" onClick={publish} disabled={publishing || classes.length === 0}>
          <FiSend aria-hidden /> {publishing ? 'Publishing…' : 'Publish Assignment'}
        </Button>
      </Card>
    </Shell>
  )
}
