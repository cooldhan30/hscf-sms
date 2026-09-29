// Suggested resource name for an uploaded file (Resources multi-upload).
//   .txt / .md -> first non-empty line
//   .pdf       -> the heading on page 1 (largest text near the top)
//   images     -> the title printed on it, read by AI (/api/resources/suggest-title)
//   anything else (Word, ...) or nothing found -> the file name, tidied
// Always just a suggestion: the upload form shows it in an editable field.

// Same hard-coded prefix as lib/gameRoom/sound.ts -- next.config.mjs basePath.
const BASE_PATH = '/tamizhi'
// Must match the installed pdfjs-dist version (package.json pins it exactly)
const PDF_WORKER_SRC = `${BASE_PATH}/pdfjs/pdf.worker-4.10.38.min.mjs`
const MAX_TITLE = 80

export function titleFromFileName(name: string): string {
  const base = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name
  return clip(base.replace(/[_]+/g, ' ').replace(/\s*-\s*/g, ' - ').replace(/\s+/g, ' ').trim()) || name
}

function clip(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= MAX_TITLE) return t
  const cut = t.slice(0, MAX_TITLE)
  return (cut.includes(' ') ? cut.slice(0, cut.lastIndexOf(' ')) : cut).trim()
}

// Rejects extraction junk: needs real letters, no control characters,
// can't start with a combining mark (e.g. a Tamil vowel sign), and next to
// no replacement or private-use characters (broken PDF font maps).
// Unicode property escapes built at runtime: tsconfig targets ES5, which
// rejects the `u` flag in regex literals, but every supported browser has it.
const LETTER = new RegExp('\\p{L}', 'gu')
const LEADING_MARK = new RegExp('^\\p{M}', 'u')

function looksReadable(text: string): boolean {
  const letters = (text.match(LETTER) ?? []).length
  const junk = (text.match(/[\uFFFD\uE000-\uF8FF]/g) ?? []).length
  // eslint-disable-next-line no-control-regex
  return letters >= 2 && junk <= text.length * 0.1 && !/[\u0000-\u001F]/.test(text) && !LEADING_MARK.test(text)
}

// PDFs often store Tamil in visual order: the prefix vowel signs ெ ே ை sit
// BEFORE their consonant ("ேம" for "மே"). Swap them back; NFC then joins
// split two-part vowels (க + ெ + ா -> கொ).
function fixTamilVisualOrder(text: string): string {
  return text.replace(/([\u0BC6-\u0BC8])([\u0B95-\u0BB9])/g, '$2$1').normalize('NFC')
}

function cleanLine(line: string): string {
  return clip(line.replace(/^[#*>\-\s"'“”]+/, '').replace(/["'“”\s:.-]+$/, ''))
}

async function headingFromText(file: File): Promise<string | null> {
  const text = await file.slice(0, 64 * 1024).text()
  const first = text.split(/\r?\n/).map(cleanLine).find((l) => l.length > 0)
  return first && looksReadable(first) ? first : null
}

interface PdfTextItem {
  str: string
  height: number
  transform: number[]
}

async function headingFromPdf(file: File): Promise<string | null> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  if (typeof window !== 'undefined') pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  try {
    const page = await doc.getPage(1)
    const content = await page.getTextContent()
    // Group text runs into lines by their baseline, top of page first
    const lines = new Map<number, { text: string; height: number }>()
    for (const item of content.items as PdfTextItem[]) {
      if (!('str' in item) || !item.str.trim()) continue
      const y = Math.round(item.transform[5])
      const line = lines.get(y) ?? { text: '', height: 0 }
      line.text += (line.text && !line.text.endsWith(' ') ? ' ' : '') + item.str
      line.height = Math.max(line.height, item.height)
      lines.set(y, line)
    }
    const top = Array.from(lines.entries())
      .sort(([a], [b]) => b - a)
      .map(([, l]) => ({ text: cleanLine(fixTamilVisualOrder(l.text)), height: l.height }))
      .filter((l) => l.text.length > 0)
      .slice(0, 8)
    if (top.length === 0) return null
    const biggest = Math.max(...top.map((l) => l.height))
    const heading = top.find((l) => l.height >= biggest * 0.8)?.text ?? top[0].text
    return looksReadable(heading) ? heading : null
  } finally {
    doc.destroy()
  }
}

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif']
// Groq's vision model reads titles reliably at this width (tested on real
// Tamil story pages) and a ~250 KB JPEG costs far less of the per-minute
// quota than the original multi-MB PNG.
const IMAGE_WIDTH = 1024

async function imageToJpegDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, IMAGE_WIDTH / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No canvas')
  ctx.fillStyle = '#fff' // transparent PNG areas would turn black in a JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}

// Images are read one at a time: the free Groq tier allows only a few per
// minute, so several at once would just trip the limit. When the server
// says to wait (429 retryAfter), this waits and tries the same image again.
let imageQueue: Promise<unknown> = Promise.resolve()
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = imageQueue.then(task, task)
  imageQueue = run.catch(() => undefined)
  return run
}

async function headingFromImage(file: File): Promise<string | null> {
  const image = await imageToJpegDataUrl(file)
  return enqueue(async () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      const res = await fetch('/api/resources/suggest-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, (Number(data.retryAfter) || 10) * 1000 + 500))
        continue
      }
      if (!res.ok || typeof data.title !== 'string') return null
      const title = cleanLine(data.title)
      return title && looksReadable(title) ? title : null
    }
    return null
  })
}

export async function suggestTitleFromFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  try {
    const heading =
      ext === 'txt' || ext === 'md'
        ? await headingFromText(file)
        : ext === 'pdf'
          ? await headingFromPdf(file)
          : IMAGE_EXTS.includes(ext) && typeof window !== 'undefined'
            ? await headingFromImage(file)
            : null
    if (heading) return heading
  } catch {
    // Unreadable or unusual file -- the file name is still a fine start
  }
  return titleFromFileName(file.name)
}
