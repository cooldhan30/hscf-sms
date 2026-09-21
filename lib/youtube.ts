// Extracts the 11-character video ID from any common YouTube URL shape
// (watch?v=, youtu.be/, embed/, shorts/) -- used to derive a thumbnail
// and an embeddable player URL without calling the YouTube API, since
// this app has no API key/quota for it and doesn't need anything beyond
// "does this look like a YouTube link, and what's its ID."
export function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1).split('/')[0]
      return id.length === 11 ? id : null
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (parsed.pathname === '/watch') {
        const id = parsed.searchParams.get('v')
        return id && id.length === 11 ? id : null
      }
      const embedMatch = parsed.pathname.match(/^\/(embed|shorts)\/([A-Za-z0-9_-]{11})/)
      if (embedMatch) return embedMatch[2]
    }

    return null
  } catch {
    return null
  }
}

export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeId(url) !== null
}

export function youTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

export function youTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`
}

export function youTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}
