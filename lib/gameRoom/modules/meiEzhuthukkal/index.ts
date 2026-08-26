import type { InteractiveGameModule } from '@/lib/gameRoom/interactiveModule'

export const meiOrderModule: InteractiveGameModule = {
  id: 'mei-order',
  name: 'மெய்யெழுத்து வரிசை',
  description: 'Drag the 18 Mei Ezhuthukkal into the correct order (Nilai 1)',
  instructions: 'மெய்யெழுத்துகளை சரியான வரிசையில் அமைக்கவும்!',
  maxScore: 18,
}

export const meiMemoryModule: InteractiveGameModule = {
  id: 'mei-memory',
  name: 'மெய்யெழுத்து நினைவகம்',
  description: 'Match pairs of the 18 Mei Ezhuthukkal to build memory (Nilai 1)',
  instructions: 'ஒரே மெய்யெழுத்தைக் கண்டுபிடித்து இணைக்கவும்!',
  maxScore: 18,
}
