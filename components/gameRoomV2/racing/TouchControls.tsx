'use client'

import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from 'react'
import type { ControlState } from './useDriveInput'

// On-screen driving controls for tablets and phones. Left thumb: an
// analog steering pad (drag left/right; the knob follows the thumb).
// Right thumb: GAS (hold), BRAKE (hold) and BOOST (tap). Every control
// tracks its OWN pointer id with pointer capture, so holding gas while
// steering while tapping boost all work at once, and each one releases
// on pointerup / pointercancel / lost capture -- never stuck on.
export function TouchControls({
  controls,
  boostReady,
  boosting,
  disabled,
}: {
  controls: MutableRefObject<ControlState>
  boostReady: boolean
  boosting: boolean
  disabled: boolean
}) {
  const padRef = useRef<HTMLDivElement | null>(null)
  const steerPointer = useRef<number | null>(null)
  const [knob, setKnob] = useState(0)
  const [gas, setGas] = useState(false)
  const [brake, setBrake] = useState(false)

  // Pausing / disabling releases everything.
  useEffect(() => {
    if (!disabled) return
    const c = controls.current
    c.touchSteer = 0
    c.touchGas = false
    c.touchBrake = false
    steerPointer.current = null
    setKnob(0)
    setGas(false)
    setBrake(false)
  }, [disabled, controls])

  const steerFrom = (clientX: number) => {
    const el = padRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const v = Math.max(-1, Math.min(1, ((clientX - (r.left + r.width / 2)) / (r.width / 2)) * 1.25))
    const shaped = Math.sign(v) * Math.min(1, Math.abs(v) < 0.08 ? 0 : Math.abs(v))
    controls.current.touchSteer = shaped
    setKnob(shaped)
  }
  const steerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    steerPointer.current = e.pointerId
    steerFrom(e.clientX)
  }
  const steerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (steerPointer.current !== e.pointerId) return
    steerFrom(e.clientX)
  }
  const steerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (steerPointer.current !== e.pointerId) return
    steerPointer.current = null
    controls.current.touchSteer = 0
    setKnob(0)
  }

  const hold = (which: 'gas' | 'brake') => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (disabled) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      if (which === 'gas') {
        controls.current.touchGas = true
        setGas(true)
      } else {
        controls.current.touchBrake = true
        setBrake(true)
      }
    },
    onPointerUp: () => release(which),
    onPointerCancel: () => release(which),
    onLostPointerCapture: () => release(which),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  })
  const release = (which: 'gas' | 'brake') => {
    if (which === 'gas') {
      controls.current.touchGas = false
      setGas(false)
    } else {
      controls.current.touchBrake = false
      setBrake(false)
    }
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 p-3 sm:p-5 select-none [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
      {/* Steering pad */}
      <div
        ref={padRef}
        role="slider"
        aria-label="திசைமாற்றி · Steering"
        aria-valuemin={-1}
        aria-valuemax={1}
        aria-valuenow={Math.round(knob * 100) / 100}
        onPointerDown={steerDown}
        onPointerMove={steerMove}
        onPointerUp={steerUp}
        onPointerCancel={steerUp}
        onLostPointerCapture={steerUp}
        onContextMenu={(e) => e.preventDefault()}
        className="pointer-events-auto touch-none relative h-24 w-44 sm:h-28 sm:w-56 rounded-full bg-white/80 border-2 border-white shadow-lg backdrop-blur"
      >
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-stone-400" aria-hidden>
          ‹
        </span>
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl font-black text-stone-400" aria-hidden>
          ›
        </span>
        <span
          className="absolute top-1/2 h-16 w-16 sm:h-20 sm:w-20 -translate-y-1/2 -translate-x-1/2 rounded-full bg-primary-700 shadow-teal border-4 border-white transition-[left] duration-75"
          style={{ left: `${50 + knob * 32}%` }}
          aria-hidden
        />
      </div>

      {/* Pedals + boost */}
      <div className="pointer-events-auto flex items-end gap-2 sm:gap-3">
        <button
          type="button"
          aria-label="நிறுத்தி · Brake"
          aria-pressed={brake}
          {...hold('brake')}
          className={`touch-none h-20 w-20 sm:h-24 sm:w-24 rounded-2xl font-extrabold text-sm border-2 border-white shadow-lg transition-transform ${
            brake ? 'bg-stone-700 text-white scale-95' : 'bg-white/85 text-stone-700'
          }`}
        >
          <span className="font-tamil block">நிறுத்து</span>
          <span className="block text-[10px] opacity-70">BRAKE</span>
        </button>
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            aria-label="உந்துதல் · Boost"
            disabled={!boostReady}
            onPointerDown={(e) => {
              e.preventDefault()
              if (!disabled) controls.current.boostRequested = true
            }}
            className={`touch-none h-16 w-24 sm:h-20 sm:w-28 rounded-2xl font-black tracking-wide border-2 border-white shadow-lg ${
              boosting ? 'bg-terracotta-500 text-white animate-pulse' : boostReady ? 'bg-gold-400 text-stone-900 shadow-terracotta' : 'bg-white/60 text-stone-400'
            }`}
          >
            <span className="font-tamil block">உந்து</span>
            <span className="block text-[10px] opacity-70">BOOST</span>
          </button>
          <button
            type="button"
            aria-label="முடுக்கி · Accelerate"
            aria-pressed={gas}
            {...hold('gas')}
            className={`touch-none h-24 w-24 sm:h-28 sm:w-28 rounded-full font-black text-lg border-4 border-white shadow-teal transition-transform ${
              gas ? 'bg-primary-800 text-white scale-95' : 'bg-primary-600 text-white'
            }`}
          >
            <span className="font-tamil block text-base">ஓட்டு</span>
            <span className="block text-[10px] opacity-80">GAS</span>
          </button>
        </div>
      </div>
    </div>
  )
}
