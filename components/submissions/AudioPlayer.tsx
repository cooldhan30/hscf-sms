// Plain <audio> wrapper, shared by the student's own submission view and
// the teacher's gradebook/submission view -- avoids duplicating playback
// markup in both places.
export function AudioPlayer({ src }: { src: string }) {
  return <audio controls src={src} className="w-full" />
}
