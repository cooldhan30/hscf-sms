'use client'

import { GameV2Modal } from './GameV2Modal'
import { GameV2Button } from './GameV2Button'

// A shared confirmation dialog for any irreversible/high-impact
// teacher action (ending a live session, deleting a question set, ...)
// -- built on GameV2Modal so it gets the same focus-trap/escape-key
// behavior for free, and on GameV2Button so its "danger" variant reads
// consistently with every other destructive control in the app. Exists
// specifically to replace ad hoc native `confirm()` calls (which can't
// show rich context like "N students are currently playing" or "this
// set is shared with other teachers") with something in the app's own
// design language.
export function GameV2ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirming = false,
  danger = true,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  confirming?: boolean
  danger?: boolean
}) {
  return (
    <GameV2Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-5">
        <div className="text-sm text-gamev2ink-600 dark:text-gamev2ink-300">{message}</div>
        <div className="grid grid-cols-2 gap-3">
          <GameV2Button variant="ghost" size="md" disabled={confirming} onClick={onClose}>
            {cancelLabel}
          </GameV2Button>
          <GameV2Button variant={danger ? 'danger' : 'spark'} size="md" disabled={confirming} onClick={onConfirm}>
            {confirming ? 'Please wait...' : confirmLabel}
          </GameV2Button>
        </div>
      </div>
    </GameV2Modal>
  )
}
