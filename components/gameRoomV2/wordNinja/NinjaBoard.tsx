'use client'

import { useEffect, useRef, type MutableRefObject } from 'react'
import { speedOf, SLOW_FACTOR, STEP_MS_NINJA, type NinjaState } from '@/lib/gameRoomV2/wordNinja'

export interface DojoClock {
  lastStepAt: number
  running: boolean
}

export interface DojoFx {
  id: number
  kind: 'slash' | 'points' | 'miss' | 'block'
  x: number
  y: number
  text?: string
  golden?: boolean
}

// The dojo: falling word tiles over a painted backdrop. React renders
// the set of words (it changes only on spawn/slash/miss); their
// positions are written straight to the DOM every animation frame from
// the simulation ref, interpolated between the 30 Hz steps, so motion is
// smooth without re-rendering React 60 times a second.
export function NinjaBoard({
  stateRef,
  clockRef,
  words,
  targetId,
  onTarget,
  fx,
  shake,
  slowed,
  shielded,
}: {
  stateRef: MutableRefObject<NinjaState | null>
  clockRef: MutableRefObject<DojoClock>
  words: { id: number; item: string; golden: boolean }[]
  targetId: number | null
  onTarget: (id: number) => void
  fx: DojoFx[]
  shake: number
  slowed: boolean
  shielded: boolean
}) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const nodes = useRef(new Map<number, HTMLButtonElement>())

  useEffect(() => {
    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const s = stateRef.current
      const box = boxRef.current
      if (!s || !box) return
      const h = box.clientHeight
      const clock = clockRef.current
      const alpha = clock.running ? Math.min(1, (performance.now() - clock.lastStepAt) / STEP_MS_NINJA) : 0
      const dyStep = (STEP_MS_NINJA * (s.slowMs > 0 ? SLOW_FACTOR : 1) * speedOf(s)) / s.tuning.fallMs
      for (const w of s.air) {
        const el = nodes.current.get(w.id)
        if (!el) continue
        const y = Math.min(1, w.y + dyStep * alpha)
        const top = y * (h - el.offsetHeight - 14)
        el.style.transform = `translate(-50%, ${top}px)`
        el.style.left = `${w.x * 100}%`
        el.dataset.danger = y > 0.72 ? '1' : '0'
      }
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [stateRef, clockRef])

  // Replays the shake animation on every miss without remounting the board.
  useEffect(() => {
    const box = boxRef.current
    if (!box || !shake) return
    box.classList.remove('animate-gamev2-shake')
    void box.offsetWidth
    box.classList.add('animate-gamev2-shake')
  }, [shake])

  return (
    <div
      ref={boxRef}
      className={`relative w-full h-[46vh] min-h-[300px] max-h-[460px] overflow-hidden rounded-3xl border border-white/10 select-none touch-manipulation ${slowed ? 'bg-gradient-to-b from-sky-950 via-indigo-950 to-slate-900' : 'bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-950'}`}
    >
      {/* Backdrop: hanging lanterns, bamboo poles and the wooden floor. */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden>
        <rect x="14" y="0" width="7" height="300" fill="#14532d" opacity="0.55" />
        <rect x="379" y="0" width="7" height="300" fill="#14532d" opacity="0.55" />
        {[60, 130, 200].map((y) => (
          <g key={y}>
            <rect x="13" y={y} width="9" height="3" fill="#166534" opacity="0.7" />
            <rect x="378" y={y} width="9" height="3" fill="#166534" opacity="0.7" />
          </g>
        ))}
        <line x1="0" y1="10" x2="400" y2="10" stroke="#7c2d12" strokeWidth="3" opacity="0.8" />
        {[90, 200, 310].map((x) => (
          <g key={x} opacity="0.85">
            <line x1={x} y1="10" x2={x} y2="22" stroke="#a16207" strokeWidth="1" />
            <ellipse cx={x} cy="32" rx="9" ry="11" fill="#b91c1c" />
            <rect x={x - 5} y="20" width="10" height="3" fill="#78350f" />
            <rect x={x - 5} y="41" width="10" height="3" fill="#78350f" />
          </g>
        ))}
        <rect x="0" y="286" width="400" height="14" fill="#78350f" />
        <rect x="0" y="284" width="400" height="3" fill="#f59e0b" opacity="0.6" />
        <rect x="0" y="210" width="400" height="76" fill="#ef4444" opacity="0.06" />
      </svg>

      {slowed && <p className="absolute top-2 left-1/2 -translate-x-1/2 text-xs font-bold tracking-widest text-sky-300 font-tamil">மெதுநேரம்</p>}
      {shielded && <div className="absolute inset-x-0 bottom-0 h-3 bg-cyan-300/70 shadow-[0_0_18px_rgba(103,232,249,0.9)]" aria-hidden />}

      {words.map((w) => {
        const isTarget = w.id === targetId
        return (
          <button
            key={w.id}
            ref={(el) => {
              if (el) nodes.current.set(w.id, el)
              else nodes.current.delete(w.id)
            }}
            type="button"
            onPointerDown={(e) => {
              e.preventDefault()
              onTarget(w.id)
            }}
            aria-label={`${w.item}${w.golden ? ', பொன் சொல்' : ''}${isTarget ? ', தேர்ந்தெடுக்கப்பட்டது' : ''}`}
            aria-pressed={isTarget}
            style={{ transform: 'translate(-50%, 0px)', left: '50%' }}
            className={`absolute top-3 px-4 py-2 rounded-2xl font-tamil leading-relaxed font-extrabold text-lg sm:text-xl whitespace-nowrap border-2 shadow-lg will-change-transform data-[danger='1']:shadow-red-500/60 ${
              w.golden ? 'bg-amber-300 text-amber-950 border-amber-100' : 'bg-white text-slate-900 border-white'
            } ${isTarget ? 'ring-4 ring-emerald-400 ring-offset-2 ring-offset-slate-900' : ''}`}
          >
            {w.item}
          </button>
        )
      })}

      {fx.map((f) =>
        f.kind === 'slash' ? (
          <span
            key={f.id}
            className={`absolute h-1 w-32 rounded-full pointer-events-none animate-gamev2-slash ${f.golden ? 'bg-amber-200' : 'bg-white'} shadow-[0_0_12px_rgba(255,255,255,0.9)]`}
            style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%` }}
            aria-hidden
          />
        ) : (
          <span
            key={f.id}
            className={`absolute pointer-events-none font-black text-lg animate-gamev2-float-up ${
              f.kind === 'points' ? (f.golden ? 'text-amber-300' : 'text-emerald-300') : f.kind === 'block' ? 'text-cyan-300' : 'text-red-400'
            }`}
            style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%` }}
            aria-hidden
          >
            {f.text}
          </span>
        )
      )}
    </div>
  )
}
