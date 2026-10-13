import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { isGrClassicEnabled } from '@/lib/grClassic/release'
import { Frame } from '@/components/grClassic/Frame'

// No title while switched off, so the 404 page doesn't name the feature.
export function generateMetadata(): Metadata {
  return isGrClassicEnabled() ? { title: 'தமிழி GameRoom Classic' } : {}
}

// Read the release switch on every request, never baked in at build time.
export const dynamic = 'force-dynamic'

// GameRoom Classic -- a separate GameRoom, isolated from the legacy
// GameRoom and GameRoom V2. Hidden (404) unless GR_CLASSIC_ENABLED=true;
// always on under `next dev`. See lib/grClassic/release.ts.
export default function GrClassicLayout({ children }: { children: React.ReactNode }) {
  if (!isGrClassicEnabled()) notFound()
  return <Frame>{children}</Frame>
}
