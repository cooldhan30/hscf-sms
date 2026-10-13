'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'

// Wraps every GameRoom Classic page: honours the device's reduced-motion
// setting, and renders the page in the browser so due dates and times show
// in the viewer's own time zone (the server runs in UTC). The data itself
// is loaded on the server by each page.
export function Frame({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#fff8ee] bg-[radial-gradient(rgba(190,18,60,0.07)_1.5px,transparent_1.5px)] font-tamil text-slate-800 [background-size:22px_22px]">
        {mounted ? children : <div className="min-h-[80vh]" aria-busy="true" />}
      </div>
    </MotionConfig>
  )
}
