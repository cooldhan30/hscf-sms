'use client'

import { motion } from 'framer-motion'
import { useGameV2Motion } from './useGameV2Motion'
import type { LearningWorld } from '@/lib/gameRoomV2/domain'

// Six worlds, six distinct identities -- each gets its own gradient +
// glyph so "which world am I looking at" is answerable at a glance,
// while the shared card shape/motion keeps them feeling like one
// family (per "each world should have its own visual identity while
// remaining part of the same GameRoom"). Glyphs are plain emoji/CSS,
// not image assets -- zero new binary weight, per the "optimize
// performance / no large unnecessary dependencies" requirement.
const WORLD_STYLE: Record<string, { gradient: string; glyph: string }> = {
  'letters-world': { gradient: 'from-gamev2coral-300 via-gamev2coral-500 to-gamev2ink-700', glyph: '௃' },
  'sounds-world': { gradient: 'from-gamev2cyan-300 via-gamev2cyan-500 to-gamev2ink-700', glyph: '♪' },
  'words-world': { gradient: 'from-gamev2mint-300 via-gamev2mint-500 to-gamev2ink-700', glyph: '𑀫' },
  'sentence-world': { gradient: 'from-gamev2magenta-300 via-gamev2magenta-500 to-gamev2ink-700', glyph: '¶' },
  'story-world': { gradient: 'from-gamev2spark-300 via-gamev2spark-500 to-gamev2ink-800', glyph: '📖' },
  'tamil-challenge-world': { gradient: 'from-gamev2lime-300 via-gamev2lime-500 to-gamev2ink-800', glyph: '⚡' },
}

export function WorldCard({ world, onClick }: { world: LearningWorld; onClick?: () => void }) {
  const { spring, reduced } = useGameV2Motion()
  const style = WORLD_STYLE[world.id] ?? WORLD_STYLE['letters-world']

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={reduced ? undefined : { y: -4 }}
      whileTap={reduced ? undefined : { scale: 0.98 }}
      transition={spring}
      className="relative text-left rounded-3xl overflow-hidden border-2 border-gamev2ink-100 dark:border-gamev2ink-800 shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gamev2spark-400"
    >
      <div className={`relative h-32 sm:h-36 bg-gradient-to-br ${style.gradient} flex items-center justify-center overflow-hidden`}>
        {/* A subtle repeating kolam-dot motif, pure CSS radial-gradient
            -- a contemporary nod to kolam geometry (per the "Tamil
            cultural influence should be subtle and contemporary"
            requirement) without any image asset or literal ornamental
            clip-art. */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1.5px, transparent 1.5px)',
            backgroundSize: '18px 18px',
          }}
          aria-hidden
        />
        <span className="relative text-5xl text-white/90 font-tamil" aria-hidden>
          {style.glyph}
        </span>
      </div>
      <div className="p-4 bg-white dark:bg-gamev2ink-900">
        <p className="font-tamil text-xl font-extrabold text-gamev2ink-900 dark:text-white leading-relaxed">
          {world.tamilName}
        </p>
        <p className="text-sm font-bold text-gamev2ink-500 dark:text-gamev2ink-400 mt-0.5">{world.name}</p>
        <p className="text-xs text-gamev2ink-400 dark:text-gamev2ink-500 mt-1.5 leading-relaxed line-clamp-2">
          {world.description}
        </p>
      </div>
    </motion.button>
  )
}
