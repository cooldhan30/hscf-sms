const AVATAR_COLORS = [
  'bg-gamev2ink-500',
  'bg-gamev2coral-500',
  'bg-gamev2mint-500',
  'bg-gamev2cyan-500',
  'bg-gamev2magenta-500',
  'bg-gamev2lime-600',
]

// Deterministic color per name (same idea as most chat-app avatar
// colors) so a given player always gets the same color across a
// session without needing to persist a color choice anywhere.
function colorForName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function PlayerAvatar({
  name,
  size = 'md',
  rank,
}: {
  name: string
  size?: 'sm' | 'md' | 'lg'
  rank?: number
}) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  const sizeClasses = { sm: 'w-8 h-8 text-sm', md: 'w-12 h-12 text-lg', lg: 'w-16 h-16 text-2xl' }

  return (
    <div className="relative inline-flex">
      <div
        className={`rounded-2xl flex items-center justify-center font-extrabold text-white ${colorForName(name)} ${sizeClasses[size]}`}
        aria-hidden
      >
        {initial}
      </div>
      {rank !== undefined && rank <= 3 && (
        <span
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gamev2spark-400 text-gamev2ink-950 text-[10px] font-extrabold flex items-center justify-center border-2 border-white dark:border-gamev2ink-950"
          aria-hidden
        >
          {rank}
        </span>
      )}
      <span className="sr-only">{name}{rank !== undefined ? `, rank ${rank}` : ''}</span>
    </div>
  )
}
