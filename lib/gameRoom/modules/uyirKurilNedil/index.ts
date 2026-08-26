import type { InteractiveGameModule } from '@/lib/gameRoom/interactiveModule'

export const uyirKurilNedilSortModule: InteractiveGameModule = {
  id: 'uyir-kuril-nedil-sort',
  name: 'குறில் / நெடில் வகைப்படுத்தல்',
  description: 'Drag each of the 12 Uyir Ezhuthukkal into the Kuril or Nedil box (Nilai 1)',
  instructions: 'எழுத்துகளை சரியான பெட்டியில் போடுங்கள்!',
  maxScore: 12,
}

export const uyirKurilNedilMemoryModule: InteractiveGameModule = {
  id: 'uyir-kuril-nedil-memory',
  name: 'குறில் / நெடில் நினைவகம்',
  description: 'Match pairs of Uyir Ezhuthukkal that share the same Kuril/Nedil type (Nilai 1)',
  instructions: 'ஒரே வகையைச் சேர்ந்த இரண்டு எழுத்துகளைக் கண்டுபிடிக்கவும்!',
  maxScore: 12,
}
