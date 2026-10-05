// The balloon itself, shared by Balloon Pop's choice rounds and pop rounds.
export function BalloonShape({ fill, dark, glow }: { fill: string; dark: string; glow: boolean }) {
  return (
    <svg
      viewBox="0 0 100 140"
      className={`w-full h-full ${glow ? 'drop-shadow-[0_0_18px_rgba(250,204,21,0.95)]' : 'drop-shadow-[0_6px_6px_rgba(15,23,42,0.25)]'}`}
      aria-hidden
    >
      {/* string */}
      <path d="M50 96 C 44 108, 56 118, 48 139" stroke="#64748b" strokeWidth="1.6" fill="none" />
      {/* body */}
      <path d="M50 4 C 22 4, 6 26, 6 50 C 6 74, 28 92, 50 96 C 72 92, 94 74, 94 50 C 94 26, 78 4, 50 4 Z" fill={fill} />
      {/* shading */}
      <path d="M50 96 C 72 92, 94 74, 94 50 C 94 34, 86 20, 74 12 C 84 26, 86 44, 80 60 C 74 78, 62 88, 50 96 Z" fill={dark} opacity="0.35" />
      {/* shine */}
      <ellipse cx="30" cy="30" rx="9" ry="15" transform="rotate(-25 30 30)" fill="#ffffff" opacity="0.45" />
      {/* knot */}
      <path d="M44 95 L56 95 L52 101 L48 101 Z" fill={dark} />
    </svg>
  )
}
