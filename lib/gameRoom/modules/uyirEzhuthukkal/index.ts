import type { InteractiveGameModule } from '@/lib/gameRoom/interactiveModule'

export const uyirOrderModule: InteractiveGameModule = {
  id: 'uyir-order',
  name: 'உயிரெழுத்து வரிசை',
  description: 'Drag the 12 Uyir Ezhuthukkal into the correct order (Nilai 1)',
  instructions: 'உயிரெழுத்துகளை சரியான வரிசையில் அமைக்கவும்!',
  maxScore: 12,
}

export const uyirMemoryModule: InteractiveGameModule = {
  id: 'uyir-memory',
  name: 'உயிரெழுத்து நினைவகம்',
  description: 'Match pairs of the 12 Uyir Ezhuthukkal to build memory (Nilai 1)',
  instructions: 'ஒரே எழுத்தைக் கண்டுபிடித்து இணைக்கவும்!',
  maxScore: 12,
}
