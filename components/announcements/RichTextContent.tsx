import sanitizeHtml from 'sanitize-html'

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'blockquote', 'code']
const ALLOWED_ATTRIBUTES = { a: ['href', 'target', 'rel'] }

// Renders announcement body HTML. Sanitized again here as defense-in-depth
// even though the write path (Route Handlers) already sanitizes before
// storing -- cheap insurance against any future write path that forgets to.
// See lib/sanitize.ts for why sanitize-html rather than isomorphic-dompurify.
export function RichTextContent({ html, className = '' }: { html: string; className?: string }) {
  const clean = sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
  })

  return (
    <div
      className={`prose prose-sm dark:prose-invert max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  )
}
