// Tiny, dependency-light helpers for protecting canonical built-in
// content, imported by API routes. (Kept separate from catalog.ts's big
// content graph only for readability; isBuiltinSetId is the catalog's.)
export { isBuiltinSetId } from './catalog'

export const BUILTIN_READ_ONLY_ERROR = 'Built-in Tamil content is read-only. Duplicate it to My Question Sets to customise it.'

export function stripSystemTags(tags: string[]): string[] {
  return tags.filter((t) => !t.startsWith('sys:'))
}
