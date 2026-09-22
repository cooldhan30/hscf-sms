// Tamil is first-class here: no transliteration, no normalization, no
// stripping of combining vowel signs -- these are plain controlled
// inputs that pass whatever Unicode the teacher types straight through
// to state and eventually straight into `payload`/`prompt`. The only
// thing this component adds over a bare <input>/<textarea> is
// typography tuned for Tamil legibility (see QuestionPanel.tsx's
// question-display equivalent) -- generous line-height and letter-
// spacing so vowel signs/conjuncts have room to render without
// visually clipping into the line above/below, which happens easily at
// tight line-heights tuned only for Latin text. Works identically for
// Tamil-only, English-only, or mixed Tamil+English text -- there is no
// per-script mode to choose.
export function TamilTextInput({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      lang="ta"
      className={`w-full px-4 py-3 rounded-2xl border-2 border-gamev2ink-200 dark:border-gamev2ink-700 bg-white dark:bg-gamev2ink-900 text-gamev2ink-900 dark:text-white font-tamil text-lg leading-[1.6] tracking-wide focus:outline-none focus:ring-4 focus:ring-gamev2spark-300 focus:border-gamev2spark-400 ${className}`}
    />
  )
}

export function TamilTextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      lang="ta"
      className={`w-full px-4 py-3 rounded-2xl border-2 border-gamev2ink-200 dark:border-gamev2ink-700 bg-white dark:bg-gamev2ink-900 text-gamev2ink-900 dark:text-white font-tamil text-lg leading-[1.7] tracking-wide focus:outline-none focus:ring-4 focus:ring-gamev2spark-300 focus:border-gamev2spark-400 resize-y ${className}`}
    />
  )
}
