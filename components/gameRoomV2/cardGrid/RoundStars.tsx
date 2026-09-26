'use client'

// The 1-3 star rating shown when a Matching or Memory round is cleared
// (in-match only; see matchingStars / memoryStars).
export function RoundStars({ stars }: { stars: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-2" role="img" aria-label={`${stars} of 3 stars`}>
      {[1, 2, 3].map((i) => (
        <svg key={i} viewBox="0 0 24 24" className={`w-10 h-10 ${i <= stars ? 'fill-amber-300 animate-gamev2-pop-in' : 'fill-white/15'}`} style={{ animationDelay: `${i * 120}ms` }} aria-hidden>
          <path d="M12 2.5l2.9 6.2 6.6.7-5 4.5 1.5 6.6L12 17.1l-6 3.4 1.5-6.6-5-4.5 6.6-.7z" />
        </svg>
      ))}
    </div>
  )
}
