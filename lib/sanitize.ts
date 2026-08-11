import 'server-only'
import sanitizeHtml from 'sanitize-html'

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'blockquote', 'code']
const ALLOWED_ATTRIBUTES = { a: ['href', 'target', 'rel'] }

// Sanitizes rich text HTML before it's ever stored. RichTextContent
// sanitizes again on render as defense-in-depth, but this is the primary
// line of defense -- nothing unsanitized should reach the database.
//
// Uses sanitize-html rather than isomorphic-dompurify: the latter's
// server-side path pulls in jsdom -> html-encoding-sniffer@6, which
// depends on an ESM-only package (@exodus/bytes) that a CommonJS
// require() can't load under Vercel's Node runtime (ERR_REQUIRE_ESM),
// crashing every render that touches it. sanitize-html has no DOM
// dependency at all, so it doesn't hit this class of bug.
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
  })
}
