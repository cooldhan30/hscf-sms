// GameRoom Classic: colour contrast of the main text/background pairs,
// checked against WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text --
// 24px+, or 18.66px+ bold). Colours are Tailwind's defaults as used in
// components/grClassic. Run with: npx tsx scripts/verify-grc-contrast.ts
const C: Record<string, string> = {
  white: '#ffffff',
  cream: '#fff8ee',
  'teal-600': '#0d9488',
  'teal-700': '#0f766e',
  'rose-600': '#e11d48',
  'rose-700': '#be123c',
  'rose-800': '#9f1239',
  'rose-50': '#fff1f2',
  'indigo-600': '#4f46e5',
  'indigo-700': '#4338ca',
  'indigo-50': '#eef2ff',
  'amber-300': '#fcd34d',
  'amber-400': '#fbbf24',
  'amber-800': '#92400e',
  'amber-900': '#78350f',
  'amber-950': '#451a03',
  'amber-50': '#fffbeb',
  'amber-100': '#fef3c7',
  'emerald-600': '#059669',
  'emerald-700': '#047857',
  'emerald-800': '#065f46',
  'emerald-100': '#d1fae5',
  'sky-900': '#0c4a6e',
  'sky-50': '#f0f9ff',
  'slate-100': '#f1f5f9',
  'slate-500': '#64748b',
  'slate-600': '#475569',
  'slate-700': '#334155',
  'slate-900': '#0f172a',
  'violet-900': '#4c1d95',
  'indigo-950': '#1e1b4b',
}

type Size = 'normal' | 'large'
const PAIRS: [fg: string, bg: string, size: Size, where: string][] = [
  ['white', 'teal-700', 'normal', 'Teal buttons (Assign, Check, Publish…)'],
  ['white', 'rose-600', 'normal', 'Primary buttons (Create Game, Play…)'],
  ['white', 'indigo-600', 'normal', 'Indigo buttons (Host), Classic Quiz band'],
  ['amber-950', 'amber-400', 'normal', 'Amber buttons, Word Builder band, word tiles'],
  ['white', 'rose-600', 'normal', 'Match the Pairs band'],
  ['white', 'teal-600', 'large', 'Answer button (sun), 24px+ bold'],
  ['white', 'rose-600', 'large', 'Answer button (moon)'],
  ['amber-950', 'amber-400', 'large', 'Answer button (star)'],
  ['white', 'indigo-600', 'large', 'Answer button (heart)'],
  ['white', 'emerald-700', 'normal', 'Practice feedback: Correct'],
  ['white', 'rose-700', 'normal', 'Practice feedback: Not this time'],
  ['white', 'slate-900', 'normal', 'Assignment feedback: Answer saved; notices'],
  ['slate-900', 'cream', 'normal', 'Page text'],
  ['slate-600', 'cream', 'normal', 'Secondary text on the page'],
  ['slate-500', 'white', 'normal', 'Small hints on cards'],
  ['rose-700', 'cream', 'normal', 'Header subtitle'],
  ['rose-700', 'white', 'normal', 'Error messages'],
  ['rose-800', 'rose-50', 'normal', 'Error boxes'],
  ['emerald-800', 'emerald-100', 'normal', 'Green pills'],
  ['amber-900', 'amber-100', 'normal', 'Amber pills'],
  ['sky-900', 'sky-50', 'normal', 'Answers-later note'],
  ['slate-700', 'slate-100', 'normal', 'Grey pills'],
  ['indigo-700', 'indigo-50', 'normal', 'Classic Quiz chip'],
  ['amber-800', 'amber-50', 'normal', 'Word Builder chip'],
  ['amber-950', 'amber-300', 'normal', 'Prototype/notice banner'],
  ['white', 'violet-900', 'normal', 'Live screens'],
  ['amber-300', 'indigo-950', 'normal', 'Live: GAME PIN label, points'],
]

function lum(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function ratio(a: string, b: string): number {
  const [x, y] = [lum(C[a]), lum(C[b])].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

let failures = 0
for (const [fg, bg, size, where] of PAIRS) {
  const r = ratio(fg, bg)
  const need = size === 'large' ? 3 : 4.5
  const ok = r >= need
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${r.toFixed(2).padStart(5)} (needs ${need})  ${fg} on ${bg}  — ${where}`)
}
console.log(failures ? `\n${failures} FAILURE(S)` : `\nPASS: ${PAIRS.length} colour pairs meet WCAG AA.`)
process.exit(failures ? 1 : 0)
