'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'

// Wraps every GameRoom Classic page: honours the device's reduced-motion
// setting, and (prototype only) renders in the browser so sample dates use
// the viewer's own time zone. Phase 2 moves data loading to the server.
export function Frame({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#fff8ee] bg-[radial-gradient(rgba(190,18,60,0.07)_1.5px,transparent_1.5px)] font-tamil text-slate-800 [background-size:22px_22px]">
        <p className="bg-amber-300 px-4 py-1.5 text-center text-xs font-extrabold text-amber-950">Prototype · sample data · nothing is saved</p>
        {mounted ? children : <div className="min-h-[80vh]" />}
      </div>
    </MotionConfig>
  )
}
