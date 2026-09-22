'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'gamev2:soundEnabled'

// A per-device sound on/off preference, persisted in localStorage --
// deliberately NOT a server-side profile field: this is exactly the
// "per-viewer convenience" case localStorage is the right tool for (a
// remembered toggle), not state that needs to sync across devices or
// be read back by a teacher/admin. Defaults to enabled (true) so sound
// works out of the box; wrapped in try/catch since localStorage can
// throw or come back empty in a private window.
export function useSoundPreference() {
  const [enabled, setEnabled] = useState(true)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored !== null) setEnabled(stored === 'true')
    } catch {
      // Sound preference is an enhancement only -- silently keep the
      // default if storage is unavailable.
    } finally {
      setLoaded(true)
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

  return { soundEnabled: enabled, toggleSound: toggle, loaded }
}
