'use client'

import { useReducedMotion } from 'framer-motion'

// Framer Motion animations do NOT automatically respect
// prefers-reduced-motion the way CSS animations/transitions do (see
// app/globals.css's blanket @media (prefers-reduced-motion: reduce)
// override, which only catches CSS-driven animation/transition
// properties, not JS-driven Framer Motion transforms) -- every
// GameRoom V2 component that animates via Framer Motion must check
// this and swap to instant/near-instant transitions when true.
//
// Centralized here so the reduced-motion decision is made once per
// component, not re-implemented ad hoc in every file that animates.
export function useGameV2Motion() {
  const reduced = useReducedMotion()

  return {
    reduced,
    // A spring that still "arrives" but skips the bounce/overshoot --
    // used for hover/press/pop-in states.
    spring: reduced ? { duration: 0 } : { type: 'spring' as const, stiffness: 400, damping: 25 },
    // Slower, larger-amplitude spring for celebratory moments (level
    // complete, unlock) -- still skipped entirely when reduced.
    celebrate: reduced ? { duration: 0 } : { type: 'spring' as const, stiffness: 260, damping: 20 },
    fade: reduced ? { duration: 0 } : { duration: 0.2 },
  }
}
