'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'gamev2:musicEnabled'

// Per-device background-music on/off, separate from the sound-effects
// toggle (useSoundPreference) so a student can keep the game sounds and
// lose the music, or the reverse. Same localStorage pattern and failure
// handling as useSoundPreference.
export function useMusicPreference() {
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored !== null) setEnabled(stored === 'true')
    } catch {
      // Keep the default if storage is unavailable.
    }
  }, [])

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, String(next))
      } catch {
        // Best-effort persistence only.
      }
      return next
    })
  }, [])

  return { musicEnabled: enabled, toggleMusic: toggle }
}
