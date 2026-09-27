'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import {
  MAX_PARTICLES,
  TIER_SPEC,
  praiseFor,
  rewardText,
  tierFor,
  type CelebrationTier,
  type Reward,
} from '@/lib/gameRoomV2/celebration'
import { playSound } from '@/components/gameRoomV2/gameplay/playSound'
import { vibrate } from '@/components/gameRoomV2/gameplay/useHaptics'

// The shared correct-answer celebration every GameRoom game mounts once.
// One pooled canvas (sparks, stars, confetti, and coins that fly to a
// counter) plus a short Tamil-first "சரி!" card. The animation frame only
// runs while particles are alive, particles are capped (MAX_PARTICLES), and
// with reduced motion nothing moves: the card simply appears.
//
// Usage:
//   const fx = useRef<CelebrationHandle>(null)
//   <div className="relative"> ... <CelebrationLayer ref={fx} soundEnabled={snd} reducedMotion={rm} /></div>
//   fx.current?.correct({ streak: 4, rewards: [{ kind: 'coins', amount: 45 }], origin, flyTo: coinChipEl })

export interface CorrectOptions {
  streak: number
  rewards?: Reward[]
  hard?: boolean
  milestone?: boolean
  // Where the burst starts, in viewport pixels. Defaults to the card.
  origin?: { x: number; y: number }
  // Coins (or other reward tokens) fly here, e.g. the HUD coin counter.
  flyTo?: HTMLElement | null
  onArrive?: () => void
  // false = particles/sound only (for games that already show their own card).
  card?: boolean
  // Replaces the default praise line.
  message?: string
  // false = no sound or haptics at all (the game plays its own).
  sound?: boolean
  // QuestionOverlay already played the plain "correct" chime and buzz:
  // only layer the tier's extra sounds on top.
  baseSoundPlayed?: boolean
}

export interface CelebrationHandle {
  correct: (o: CorrectOptions) => CelebrationTier
  victory: (o?: { message?: string; rewards?: Reward[] }) => void
  burst: (tier: CelebrationTier, origin?: { x: number; y: number }) => void
}

type Kind = 0 | 1 | 2 | 3 // spark, star, confetti, coin
interface P {
  kind: Kind
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  rot: number
  vr: number
  color: string
  // coin flight
  sx: number
  sy: number
  tx: number
  ty: number
  cx: number
  cy: number
  done?: () => void
}

const SPARK = ['#fde047', '#facc15', '#ffffff', '#5eead4', '#fb923c']
const CONFETTI = ['#0d9488', '#14b8a6', '#eab308', '#facc15', '#f97316', '#fb923c', '#ffffff', '#a855f7', '#ec4899']
const pick = <T,>(a: readonly T[]) => a[(Math.random() * a.length) | 0]

interface Card {
  id: number
  tier: CelebrationTier
  title: string
  lines: string[]
  streak: number
}

export const CelebrationLayer = forwardRef<CelebrationHandle, { soundEnabled: boolean; reducedMotion: boolean; fixed?: boolean }>(function CelebrationLayer(
  { soundEnabled, reducedMotion, fixed = false },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const parts = useRef<P[]>([])
  const rings = useRef<{ x: number; y: number; t: number; max: number; color: string }[]>([])
  const raf = useRef(0)
  const last = useRef(0)
  const soundRef = useRef(soundEnabled)
  const reducedRef = useRef(reducedMotion)
  soundRef.current = soundEnabled
  reducedRef.current = reducedMotion
  const [card, setCard] = useState<Card | null>(null)
  const cardTimer = useRef<number | null>(null)
  const timers = useRef<number[]>([])

  const size = useCallback(() => {
    const c = canvasRef.current
    if (!c) return null
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = c.clientWidth
    const h = c.clientHeight
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
    }
    return { c, dpr, w, h, rect: c.getBoundingClientRect() }
  }, [])

  const frame = useCallback(
    (now: number) => {
      const s = size()
      if (!s) return
      const g = s.c.getContext('2d')
      if (!g) return
      const dt = Math.min(0.05, (now - (last.current || now)) / 1000)
      last.current = now
      g.setTransform(s.dpr, 0, 0, s.dpr, 0, 0)
      g.clearRect(0, 0, s.w, s.h)

      for (let i = rings.current.length - 1; i >= 0; i--) {
        const r = rings.current[i]
        r.t += dt
        const k = r.t / 0.6
        if (k >= 1) {
          rings.current.splice(i, 1)
          continue
        }
        g.globalAlpha = (1 - k) * 0.6
        g.strokeStyle = r.color
        g.lineWidth = 6 * (1 - k) + 1
        g.beginPath()
        g.arc(r.x, r.y, r.max * (0.2 + 0.8 * k), 0, Math.PI * 2)
        g.stroke()
      }

      const ps = parts.current
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i]
        p.life += dt
        const k = p.life / p.max
        if (k >= 1) {
          if (p.kind === 3) p.done?.()
          ps[i] = ps[ps.length - 1]
          ps.pop()
          continue
        }
        if (p.kind === 3) {
          // Quadratic bezier from the burst to the counter, eased.
          const t = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
          const u = 1 - t
          p.x = u * u * p.sx + 2 * u * t * p.cx + t * t * p.tx
          p.y = u * u * p.sy + 2 * u * t * p.cy + t * t * p.ty
          g.globalAlpha = 1
          g.fillStyle = '#f59e0b'
          g.beginPath()
          g.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          g.fill()
          g.fillStyle = '#fde68a'
          g.beginPath()
          g.arc(p.x - p.size * 0.25, p.y - p.size * 0.25, p.size * 0.45, 0, Math.PI * 2)
          g.fill()
          continue
        }
        p.vy += (p.kind === 2 ? 420 : 260) * dt
        if (p.kind === 2) p.vx *= 0.985
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.rot += p.vr * dt
        g.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3
        g.fillStyle = p.color
        if (p.kind === 0) {
          g.beginPath()
          g.arc(p.x, p.y, p.size * (1 - k * 0.6), 0, Math.PI * 2)
          g.fill()
        } else if (p.kind === 1) {
          g.save()
          g.translate(p.x, p.y)
          g.rotate(p.rot)
          const r = p.size
          g.beginPath()
          for (let j = 0; j < 8; j++) {
            const rr = j % 2 === 0 ? r : r * 0.4
            const a = (j / 8) * Math.PI * 2
            g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
          }
          g.closePath()
          g.fill()
          g.restore()
        } else {
          g.save()
          g.translate(p.x, p.y)
          g.rotate(p.rot)
          g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
          g.restore()
        }
      }
      g.globalAlpha = 1
      if (ps.length > 0 || rings.current.length > 0) raf.current = requestAnimationFrame(frame)
      else {
        raf.current = 0
        last.current = 0
      }
    },
    [size]
  )

  const kick = useCallback(() => {
    if (!raf.current) raf.current = requestAnimationFrame(frame)
  }, [frame])

  const room = () => MAX_PARTICLES - parts.current.length

  const spawnBurst = useCallback(
    (tier: CelebrationTier, x: number, y: number, w: number, h: number) => {
      const spec = TIER_SPEC[tier]
      const base = { rot: 0, vr: 0, sx: 0, sy: 0, tx: 0, ty: 0, cx: 0, cy: 0 }
      const sparks = Math.min(spec.sparks, room())
      for (let i = 0; i < sparks; i++) {
        const a = Math.random() * Math.PI * 2
        const sp = 140 + Math.random() * (tier === 'small' ? 200 : 340)
        parts.current.push({
          ...base,
          kind: i % 3 === 0 ? 1 : 0,
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 120,
          life: 0,
          max: 0.6 + Math.random() * 0.5,
          size: i % 3 === 0 ? 6 + Math.random() * 5 : 2.5 + Math.random() * 2.5,
          rot: Math.random() * 6,
          vr: (Math.random() - 0.5) * 10,
          color: pick(SPARK),
        })
      }
      const conf = Math.min(spec.confetti, room())
      for (let i = 0; i < conf; i++) {
        const fromSide = tier === 'victory'
        const left = Math.random() < 0.5
        parts.current.push({
          ...base,
          kind: 2,
          x: fromSide ? (left ? w * 0.1 : w * 0.9) : x + (Math.random() - 0.5) * 40,
          y: fromSide ? h * 0.75 : y,
          vx: fromSide ? (left ? 1 : -1) * (120 + Math.random() * 380) : (Math.random() - 0.5) * 520,
          vy: -(fromSide ? 560 + Math.random() * 420 : 260 + Math.random() * 360),
          life: 0,
          max: fromSide ? 2.6 + Math.random() : 1.3 + Math.random() * 0.6,
          size: 7 + Math.random() * 6,
          rot: Math.random() * 6,
          vr: (Math.random() - 0.5) * 12,
          color: pick(CONFETTI),
        })
      }
      if (spec.pulse) rings.current.push({ x, y, t: 0, max: Math.min(w, h) * 0.35, color: tier === 'victory' ? '#facc15' : '#5eead4' })
      kick()
    },
    [kick]
  )

  const flyCoins = useCallback(
    (fromX: number, fromY: number, to: HTMLElement, count: number, onArrive?: () => void) => {
      const s = size()
      if (!s) return onArrive?.()
      const r = to.getBoundingClientRect()
      const tx = r.left + r.width / 2 - s.rect.left
      const ty = r.top + r.height / 2 - s.rect.top
      const n = Math.min(count, room())
      if (n <= 0) return onArrive?.()
      let arrived = 0
      for (let i = 0; i < n; i++) {
        const sx = fromX + (Math.random() - 0.5) * 30
        const sy = fromY + (Math.random() - 0.5) * 20
        parts.current.push({
          kind: 3,
          x: sx,
          y: sy,
          vx: 0,
          vy: 0,
          life: -i * 0.05,
          max: 0.75 + i * 0.05,
          size: 7,
          rot: 0,
          vr: 0,
          color: '#f59e0b',
          sx,
          sy,
          tx,
          ty,
          cx: (sx + tx) / 2 + (Math.random() - 0.5) * 120,
          cy: Math.min(sy, ty) - 90 - Math.random() * 60,
          done: () => {
            arrived++
            playSound('coin', soundRef.current)
            if (arrived === n) onArrive?.()
          },
        })
      }
      kick()
    },
    [kick, size]
  )

  const localOrigin = (origin?: { x: number; y: number }) => {
    const s = size()
    if (!s) return { x: 0, y: 0, w: 0, h: 0 }
    return origin
      ? { x: origin.x - s.rect.left, y: origin.y - s.rect.top, w: s.w, h: s.h }
      : { x: s.w / 2, y: s.h * 0.24, w: s.w, h: s.h }
  }

  const sounds = (tier: CelebrationTier, streak: number, baseSoundPlayed = false) => {
    const spec = TIER_SPEC[tier]
    const ids = baseSoundPlayed ? spec.sounds.filter((id) => id !== 'correct') : spec.sounds
    ids.forEach((id, i) => {
      const t = window.setTimeout(() => playSound(id, soundRef.current, id === 'streak' ? streak : undefined), (baseSoundPlayed ? i + 1 : i) * 130)
      timers.current.push(t)
    })
    if (!baseSoundPlayed || tier !== 'small') vibrate(spec.haptic, soundRef.current)
  }

  const showCard = (c: Omit<Card, 'id'>) => {
    if (cardTimer.current) window.clearTimeout(cardTimer.current)
    setCard({ ...c, id: Date.now() })
    cardTimer.current = window.setTimeout(() => setCard(null), TIER_SPEC[c.tier].cardMs)
  }

  useImperativeHandle(ref, () => ({
    correct(o) {
      const tier = tierFor({ streak: o.streak, hard: o.hard, milestone: o.milestone })
      const { x, y, w, h } = localOrigin(o.origin)
      if (!reducedRef.current) spawnBurst(tier, x, y, w, h)
      if (o.sound !== false) sounds(tier, o.streak, o.baseSoundPlayed)
      const coins = o.rewards?.find((r) => r.kind === 'coins')
      if (o.flyTo && !reducedRef.current) flyCoins(x, y, o.flyTo, Math.max(4, Math.min(12, Math.round((coins?.amount ?? 20) / 8))), o.onArrive)
      else o.onArrive?.()
      if (o.card !== false) {
        const lines = (o.rewards ?? []).map(rewardText)
        showCard({ tier, title: o.message ?? praiseFor(tier, o.streak), lines, streak: o.streak })
      }
      return tier
    },
    victory(o) {
      const { w, h } = localOrigin()
      if (!reducedRef.current) spawnBurst('victory', w / 2, h * 0.3, w, h)
      sounds('victory', 0)
      showCard({ tier: 'victory', title: o?.message ?? praiseFor('victory', 0), lines: (o?.rewards ?? []).map(rewardText), streak: 0 })
    },
    burst(tier, origin) {
      if (reducedRef.current) return
      const { x, y, w, h } = localOrigin(origin)
      spawnBurst(tier, x, y, w, h)
    },
  }))

  useEffect(() => {
    const onResize = () => size()
    window.addEventListener('resize', onResize)
    const pending = timers.current
    return () => {
      window.removeEventListener('resize', onResize)
      if (raf.current) cancelAnimationFrame(raf.current)
      raf.current = 0
      if (cardTimer.current) window.clearTimeout(cardTimer.current)
      pending.forEach((t) => window.clearTimeout(t))
      parts.current = []
    }
  }, [size])

  const pos = fixed ? 'fixed' : 'absolute'
  const big = card && (card.tier === 'major' || card.tier === 'victory')
  return (
    <>
      <canvas ref={canvasRef} className={`pointer-events-none ${pos} inset-0 z-[60] w-full h-full`} aria-hidden />
      <div className={`pointer-events-none ${pos} inset-x-0 top-[16%] z-[61] flex justify-center px-4`} aria-live="polite">
        {card && (
          <div
            key={card.id}
            role="status"
            className={`rounded-3xl text-center shadow-2xl border-4 ${reducedMotion ? '' : 'animate-gamev2-pop-in'} ${
              card.tier === 'victory'
                ? 'bg-gradient-to-b from-gold-300 to-gold-500 border-white text-stone-900 px-8 py-4'
                : big
                  ? 'bg-gradient-to-b from-primary-500 to-primary-700 border-gold-300 text-white px-7 py-3'
                  : 'bg-gradient-to-b from-primary-500 to-primary-700 border-white/80 text-white px-6 py-2.5'
            }`}
          >
            <p className={`font-tamil font-black leading-tight flex items-center justify-center gap-2 ${big ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'}`}>
              {card.title} <span aria-hidden>✓</span>
            </p>
            {(card.lines.length > 0 || card.streak >= 2) && (
              <p className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm sm:text-base font-extrabold">
                {card.lines.map((l) => (
                  <span key={l} className="font-tamil">
                    {l}
                  </span>
                ))}
                {card.streak >= 2 && (
                  <span className="rounded-full bg-gold-400 px-2.5 text-stone-900">
                    <span className="font-tamil">தொடர்</span> ×{card.streak}
                  </span>
                )}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  )
})
