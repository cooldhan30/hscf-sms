import { TA, type TaKey } from '@/lib/gameRoomV2/i18n/ta'

// A Tamil-first label: Tamil in the Tamizhi Tamil font as the primary
// text, with the short English beneath (or beside, `inline`) for students
// still building their Tamil reading. `en={false}` shows Tamil only.
export function Bi({ k, inline = false, en = true, className = '' }: { k: TaKey; inline?: boolean; en?: boolean; className?: string }) {
  const t = TA[k]
  if (!en) return <span className={`font-tamil ${className}`}>{t.ta}</span>
  if (inline) {
    return (
      <span className={className}>
        <span className="font-tamil">{t.ta}</span>
        <span className="opacity-70 font-normal text-[0.8em]"> · {t.en}</span>
      </span>
    )
  }
  return (
    <span className={`inline-flex flex-col items-center leading-tight ${className}`}>
      <span className="font-tamil">{t.ta}</span>
      <span className="opacity-70 font-semibold text-[0.62em] tracking-wide">{t.en}</span>
    </span>
  )
}

// Plain-string form for aria-labels, titles and canvas text.
export function ta(k: TaKey, withEn = false) {
  return withEn ? `${TA[k].ta} · ${TA[k].en}` : TA[k].ta
}
