// Plain (non-'use client') module. resolveSelectedChildId is called from
// Server Component pages -- if it lived in ChildSelector.tsx (a 'use
// client' file), the RSC boundary would turn it into an unusable client
// reference rather than a real callable function when imported server-side.
export interface ChildOption {
  id: string
  first_name: string
  last_name: string
}

export function resolveSelectedChildId(children: ChildOption[], requestedId?: string | null): string {
  if (requestedId && children.some((c) => c.id === requestedId)) return requestedId
  return children[0]?.id ?? ''
}
