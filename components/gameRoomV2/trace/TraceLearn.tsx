'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { FiArrowLeft, FiRotateCcw, FiCheck, FiChevronRight, FiVolume2, FiStar } from 'react-icons/fi'
import { CelebrationLayer, type CelebrationHandle } from '@/components/gameRoomV2/celebration/CelebrationLayer'
import { useSoundPreference, playSound } from '@/components/gameRoomV2/gameplay'
import { useGameV2Motion } from '@/components/gameRoomV2/useGameV2Motion'
import { PraiseBubble, useTamilVoice } from '@/components/gameRoomV2/kids'
import { scoreTrace, PRAISE, type TraceScore } from '@/lib/gameRoomV2/kids'
import { UYIR, MEI } from '@/lib/gameRoomV2/builtin/content/letters'

// Trace & Learn (எழுதிப் பழகு) -- Little Learners, ages 4-9. Not a quiz:
// the child traces a big letter with a finger. Practice only, as agreed:
// the trace is checked on the device (lib/gameRoomV2/kids/trace.ts) and
// earns stars on screen -- never server XP -- and the letters done are
// remembered on this device only.

const SETS: { key: string; ta: string; en: string; letters: string[] }[] = [
  { key: 'uyir', ta: 'உயிர்', en: 'Vowels', letters: UYIR },
  { key: 'mei', ta: 'மெய்', en: 'Consonants', letters: MEI },
  { key: 'ka', ta: 'க வரிசை', en: 'க row', letters: ['க', 'கா', 'கி', 'கீ', 'கு', 'கூ', 'கெ', 'கே', 'கை', 'கொ', 'கோ', 'கௌ'] },
]
const GRID = 48
const STROKE_COLORS = ['#f43f5e', '#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#06b6d4']

function loadDone(set: string): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(`tamizhi.trace.${set}`) ?? '[]')
  } catch {
    return []
  }
}
function saveDone(set: string, letters: string[]) {
  try {
    window.localStorage.setItem(`tamizhi.trace.${set}`, JSON.stringify(letters))
  } catch {
    // storage unavailable -- progress just isn't remembered
  }
}

export function TraceLearn() {
  const { soundEnabled } = useSoundPreference()
  const reduced = !!useGameV2Motion().reduced
  const fx = useRef<CelebrationHandle>(null)
  const voice = useTamilVoice()
  const [setKey, setSetKey] = useState(SETS[0].key)
  const set = SETS.find((s) => s.key === setKey)!
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState<string[]>([])
  const [stars, setStars] = useState(0)
  const [result, setResult] = useState<TraceScore | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  const letter = set.letters[index]

  useEffect(() => {
    setDone(loadDone(setKey))
    setIndex(0)
  }, [setKey])

  const say = useCallback(() => {
    if (!voice) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(letter)
    u.voice = voice
    u.lang = voice.lang
    u.rate = 0.8
    window.speechSynthesis.speak(u)
  }, [voice, letter])

  const next = () => {
    setResult(null)
    setIndex((i) => (i + 1) % set.letters.length)
  }

  const onChecked = (s: TraceScore, origin: DOMRect | null) => {
    setResult(s)
    if (s.passed) {
      const words = PRAISE[Math.floor(Math.random() * PRAISE.length)]
      setPraise(words)
      setStars((n) => n + 1)
      const nextDone = Array.from(new Set([...done, letter]))
      setDone(nextDone)
      saveDone(setKey, nextDone)
      fx.current?.correct({ streak: stars + 1, origin: origin ? { x: origin.left + origin.width / 2, y: origin.top + origin.height / 2 } : undefined, card: false })
      window.setTimeout(next, 1700)
    } else {
      playSound('button', soundEnabled)
    }
  }

  return (
    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-gradient-to-b from-sky-100 via-amber-50 to-orange-50 select-none">
      <CelebrationLayer ref={fx} soundEnabled={soundEnabled} reducedMotion={reduced} fixed />
      <div className="mx-auto max-w-3xl px-3 py-3 flex flex-col items-center gap-3 min-h-full">
        <div className="w-full flex items-center gap-2">
          <Link
            href="/gameroom-v2"
            aria-label="விளையாட்டு அறைக்குத் திரும்பு · Back to Game Room"
            className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-sky-800"
          >
            <FiArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="flex-1 text-center font-tamil text-xl sm:text-2xl font-extrabold text-rose-600">
            எழுதிப் பழகு <span className="text-sky-800 font-sans text-base sm:text-lg">· Trace & Learn</span>
          </h1>
          <div className="flex items-center gap-1 rounded-full bg-white shadow-md px-3 h-12 text-amber-600 font-extrabold text-xl" aria-label={`${stars} stars`}>
            <FiStar className="w-6 h-6 fill-amber-400" /> {stars}
          </div>
        </div>

        {/* which letters */}
        <div className="flex gap-2" role="group" aria-label="எழுத்து வகை · Letter set">
          {SETS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSetKey(s.key)}
              aria-pressed={s.key === setKey}
              className={`rounded-full px-4 min-h-[44px] font-tamil font-bold ${s.key === setKey ? 'bg-sky-600 text-white' : 'bg-white text-sky-800 border border-sky-200'}`}
            >
              {s.ta} <span className="font-sans text-xs opacity-80">{s.en}</span>
            </button>
          ))}
        </div>

        {/* progress through the set */}
        <div className="flex flex-wrap justify-center gap-1 max-w-full" aria-label={`${index + 1} / ${set.letters.length}`}>
          {set.letters.map((l, i) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setResult(null)
                setIndex(i)
              }}
              className={`min-w-9 h-9 px-1 rounded-lg font-tamil font-bold text-sm ${i === index ? 'bg-rose-500 text-white' : done.includes(l) ? 'bg-emerald-100 text-emerald-800' : 'bg-white/80 text-slate-600'}`}
            >
              {l}
            </button>
          ))}
        </div>

        <TracePad key={`${setKey}-${letter}`} letter={letter} color={STROKE_COLORS[index % STROKE_COLORS.length]} onChecked={onChecked} onSay={voice ? say : undefined} onSkip={next} result={result} />
      </div>
      {result?.passed && <PraiseBubble praise={praise} top={96} reduced={reduced} />}
    </div>
  )
}

// The drawing area: the letter drawn big and faint, the child's strokes on
// top, and the check.
function TracePad({
  letter,
  color,
  result,
  onChecked,
  onSay,
  onSkip,
}: {
  letter: string
  color: string
  result: TraceScore | null
  onChecked: (s: TraceScore, rect: DOMRect | null) => void
  onSay?: () => void
  onSkip: () => void
}) {
  const guideRef = useRef<HTMLCanvasElement>(null)
  const drawRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(320)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [hasInk, setHasInk] = useState(false)

  useLayoutEffect(() => {
    const fit = () => setSize(Math.floor(Math.min(window.innerWidth * 0.9, window.innerHeight * 0.55, 520)))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  // Draw the faint letter once the Tamil font is ready
  useEffect(() => {
    const c = guideRef.current
    if (!c) return
    const family = getComputedStyle(boxRef.current ?? document.body).fontFamily || 'sans-serif'
    // Browsers disagree on Tamil text metrics on a canvas (Safari's
    // baseline/width for these fonts, a fallback font before the web font
    // loads...), which pushed the letter off to one side on some phones.
    // So the letter is drawn on a large scratch canvas first, its REAL ink
    // is found by scanning the pixels, and exactly that is scaled to fill
    // ~78% of the board and centred -- whatever the font's metrics say.
    const paint = () => {
      const dpr = window.devicePixelRatio || 1
      const W = Math.round(size * dpr)
      c.width = W
      c.height = W
      const ctx = c.getContext('2d')
      if (!ctx) return
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, W, W)

      const px = Math.max(120, Math.round(W * 0.6))
      // Scratch canvas sized from the letter's measured width with wide
      // margins; if the ink still reaches an edge (a font measuring short),
      // try again bigger, so no letter (ஔ is very wide) is ever cut off.
      let margin = 1
      let scratch: HTMLCanvasElement | null = null
      let box: { minX: number; minY: number; maxX: number; maxY: number } | null = null
      for (let attempt = 0; attempt < 3 && !box; attempt++, margin *= 2) {
        const probe = document.createElement('canvas').getContext('2d')
        if (!probe) return
        probe.font = `800 ${px}px ${family}`
        const textW = probe.measureText(letter).width
        const SW = Math.round(textW * (1 + margin) + px * margin)
        const SH = Math.round(px * (1.6 + margin))
        const cvs = document.createElement('canvas')
        cvs.width = SW
        cvs.height = SH
        const sctx = cvs.getContext('2d', { willReadFrequently: true })
        if (!sctx) return
        sctx.font = `800 ${px}px ${family}`
        sctx.textAlign = 'center'
        sctx.textBaseline = 'middle'
        sctx.fillStyle = '#cbd5e1'
        sctx.fillText(letter, SW / 2, SH / 2)
        sctx.setLineDash([px * 0.02, px * 0.02])
        sctx.lineWidth = Math.max(2, px * 0.007)
        sctx.strokeStyle = '#94a3b8'
        sctx.strokeText(letter, SW / 2, SH / 2)

        // Where the ink actually is
        const data = sctx.getImageData(0, 0, SW, SH).data
        let minX = SW
        let minY = SH
        let maxX = -1
        let maxY = -1
        for (let y = 0; y < SH; y++) {
          for (let x = 0; x < SW; x++) {
            if (data[(y * SW + x) * 4 + 3] > 10) {
              if (x < minX) minX = x
              if (x > maxX) maxX = x
              if (y < minY) minY = y
              if (y > maxY) maxY = y
            }
          }
        }
        if (maxX < 0) return // nothing drawn (font not usable yet) -- fonts.ready repaints
        const touchesEdge = minX === 0 || minY === 0 || maxX === SW - 1 || maxY === SH - 1
        if (!touchesEdge || attempt === 2) {
          scratch = cvs
          box = { minX, minY, maxX, maxY }
        }
      }
      if (!scratch || !box) return
      const { minX, minY, maxX, maxY } = box
      const bw = maxX - minX + 1
      const bh = maxY - minY + 1
      const target = W * 0.78
      const scale = Math.min(target / bw, target / bh)
      const w = bw * scale
      const h = bh * scale
      ctx.drawImage(scratch, minX, minY, bw, bh, (W - w) / 2, (W - h) / 2, w, h)
    }
    paint()
    document.fonts?.ready.then(paint).catch(() => undefined)
  }, [letter, size])

  // Fresh drawing canvas for each size/letter
  useEffect(() => {
    const c = drawRef.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = size * dpr
    c.height = size * dpr
    c.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
    setHasInk(false)
  }, [size, letter])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ctx = drawRef.current?.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = color
    ctx.lineWidth = size * 0.075
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  }

  const clear = () => {
    const c = drawRef.current
    c?.getContext('2d')?.clearRect(0, 0, size, size)
    setHasInk(false)
  }

  // Reduce a canvas to a GRID x GRID yes/no map of where there is ink
  const cells = (c: HTMLCanvasElement): boolean[] => {
    const small = document.createElement('canvas')
    small.width = GRID
    small.height = GRID
    const ctx = small.getContext('2d')
    if (!ctx) return []
    ctx.drawImage(c, 0, 0, GRID, GRID)
    const data = ctx.getImageData(0, 0, GRID, GRID).data
    return Array.from({ length: GRID * GRID }, (_, i) => data[i * 4 + 3] > 40)
  }

  const check = () => {
    const g = guideRef.current
    const d = drawRef.current
    if (!g || !d) return
    onChecked(scoreTrace(cells(g), cells(d), GRID), boxRef.current?.getBoundingClientRect() ?? null)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={boxRef} className="relative rounded-3xl bg-white shadow-xl border-4 border-amber-300 font-tamil" style={{ width: size, height: size }}>
        <canvas ref={guideRef} className="absolute inset-0" style={{ width: size, height: size }} aria-hidden />
        <canvas
          ref={drawRef}
          data-trace-pad
          className="absolute inset-0 touch-none cursor-crosshair"
          style={{ width: size, height: size }}
          aria-label={`${letter} - இந்த எழுத்தின் மேல் வரை · Trace this letter`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            drawing.current = true
            const p = point(e)
            last.current = p
            stroke(p, p)
            setHasInk(true)
          }}
          onPointerMove={(e) => {
            if (!drawing.current || !last.current) return
            const p = point(e)
            stroke(last.current, p)
            last.current = p
          }}
          onPointerUp={() => {
            drawing.current = false
            last.current = null
          }}
          onPointerCancel={() => {
            drawing.current = false
            last.current = null
          }}
        />
      </div>

      {result && !result.passed && (
        <p className="font-tamil rounded-2xl bg-white px-4 py-2 text-center font-bold text-amber-800 shadow" aria-live="polite">
          இன்னும் கொஞ்சம்! சாம்பல் எழுத்தின் மேல் வரை · Almost! Trace over the grey letter
          <span className="block mt-1 h-2 rounded-full bg-amber-100 overflow-hidden" aria-hidden>
            <span className="block h-full bg-amber-400" style={{ width: `${Math.round(result.coverage * 100)}%` }} />
          </span>
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        {onSay && (
          <button type="button" onClick={onSay} aria-label="கேள் · Hear it" className="w-14 h-14 rounded-full bg-amber-400 text-white shadow-md flex items-center justify-center">
            <FiVolume2 className="w-7 h-7" />
          </button>
        )}
        <button type="button" onClick={clear} className="inline-flex items-center gap-2 min-h-[56px] px-5 rounded-2xl bg-white border-2 border-slate-200 font-bold text-slate-700">
          <FiRotateCcw className="w-5 h-5" /> <span className="font-tamil">அழி</span> · Clear
        </button>
        <button
          type="button"
          onClick={check}
          disabled={!hasInk}
          className="inline-flex items-center gap-2 min-h-[56px] px-6 rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 text-white text-lg font-extrabold shadow-[0_5px_0_#047857] disabled:opacity-50"
        >
          <FiCheck className="w-6 h-6" /> <span className="font-tamil">சரிபார்</span> · Done
        </button>
        <button type="button" onClick={onSkip} className="inline-flex items-center gap-1 min-h-[56px] px-4 rounded-2xl text-slate-500 font-semibold underline">
          <span className="font-tamil">அடுத்தது</span> · Next <FiChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
