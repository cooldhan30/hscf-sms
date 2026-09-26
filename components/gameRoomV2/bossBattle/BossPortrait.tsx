'use client'

import type { DuelBossId } from '@/lib/gameRoomV2/bossBattle/duel'

// Original SVG artwork for the three duel bosses. `phase` darkens and
// sharpens them; `enraged` adds a red aura; `charging` a gathering glow.
export function BossPortrait({
  id,
  phase,
  charging,
  shielded,
  className = 'w-48 h-48',
}: {
  id: DuelBossId
  phase: number
  charging: boolean
  shielded: boolean
  className?: string
}) {
  const enraged = phase === 2
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <defs>
        <radialGradient id={`aura-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={enraged ? '#f43f5e' : charging ? '#facc15' : '#ffffff'} stopOpacity={enraged || charging ? 0.55 : 0.12} />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="96" fill={`url(#aura-${id})`}>
        {(enraged || charging) && <animate attributeName="r" values="88;98;88" dur="1.4s" repeatCount="indefinite" />}
      </circle>

      {id === 'irul' && (
        <g>
          <path d="M40 150 Q100 20 160 150 Q100 175 40 150Z" fill={phase === 0 ? '#6d28d9' : phase === 1 ? '#5b21b6' : '#4c1d95'} />
          <path d="M62 62 L75 30 L88 58 L100 24 L112 58 L125 30 L138 62Z" fill="#facc15" stroke="#a16207" strokeWidth="2" />
          <ellipse cx="80" cy="100" rx="11" ry={phase === 2 ? 6 : 9} fill="#fde68a" />
          <ellipse cx="120" cy="100" rx="11" ry={phase === 2 ? 6 : 9} fill="#fde68a" />
          <circle cx="80" cy="101" r="4" fill="#1e1b4b" />
          <circle cx="120" cy="101" r="4" fill="#1e1b4b" />
          <path d={phase === 2 ? 'M78 130 L90 122 L100 132 L110 122 L122 130' : 'M82 128 Q100 138 118 128'} stroke="#e9d5ff" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      )}

      {id === 'puyal' && (
        <g>
          <circle cx="70" cy="95" r="34" fill="#0369a1" />
          <circle cx="110" cy="80" r="42" fill="#0284c7" />
          <circle cx="140" cy="105" r="30" fill="#0369a1" />
          <rect x="52" y="95" width="110" height="36" rx="18" fill="#075985" />
          <path d="M100 128 L88 160 L104 156 L94 188" stroke="#fde047" strokeWidth="6" fill="none" strokeLinejoin="round">
            {phase > 0 && <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite" />}
          </path>
          <ellipse cx="95" cy="92" rx="9" ry="7" fill="#e0f2fe" />
          <ellipse cx="128" cy="92" rx="9" ry="7" fill="#e0f2fe" />
          <circle cx="97" cy="93" r="3.5" fill="#0c4a6e" />
          <circle cx="130" cy="93" r="3.5" fill="#0c4a6e" />
        </g>
      )}

      {id === 'malai' && (
        <g>
          <path d="M45 170 L60 80 L100 40 L140 80 L155 170Z" fill={phase === 2 ? '#57534e' : '#78716c'} stroke="#44403c" strokeWidth="4" strokeLinejoin="round" />
          <path d="M70 90 L85 110 M130 90 L115 110 M80 150 L95 135 L110 150" stroke="#44403c" strokeWidth="4" fill="none" />
          {phase > 0 && <path d="M100 45 L94 75 L104 88 L98 120" stroke="#f97316" strokeWidth="3" fill="none" />}
          <rect x="72" y="96" width="20" height="10" rx="3" fill="#fbbf24" />
          <rect x="108" y="96" width="20" height="10" rx="3" fill="#fbbf24" />
          <path d="M20 150 Q35 120 55 130 L50 165Z M180 150 Q165 120 145 130 L150 165Z" fill="#78716c" stroke="#44403c" strokeWidth="3" />
        </g>
      )}

      {shielded && <circle cx="100" cy="100" r="86" fill="rgba(125, 211, 252, 0.15)" stroke="#7dd3fc" strokeWidth="4" strokeDasharray="10 6" />}
    </svg>
  )
}
