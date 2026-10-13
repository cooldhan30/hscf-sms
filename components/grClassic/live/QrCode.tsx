'use client'

import { useMemo } from 'react'
import qrcode from 'qrcode-generator'

// A QR code for the join link, drawn as an SVG (sharp on any projector).
export function QrCode({ text, size = 220, label }: { text: string; size?: number; label: string }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(text)
    qr.make()
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })
  }, [text])
  return <div role="img" aria-label={label} className="rounded-2xl bg-white p-2 [&>svg]:h-full [&>svg]:w-full" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />
}
