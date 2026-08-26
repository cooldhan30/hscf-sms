import type { InteractiveGameModule } from '@/lib/gameRoom/interactiveModule'

// maxScore is the theoretical ceiling used only for server-side sanity
// validation in /api/game-room/interactive/complete (score <=
// maxScore) -- the ACTUAL per-round max is however many positions that
// round marked missing (4-6 for Uyir, 6-8 for Mei), returned to the
// client as part of gameData.sequence and used for the real "X / Y"
// progress display and completion score.
export const uyirMissingLetterModule: InteractiveGameModule = {
  id: 'uyir-missing-letter',
  name: 'உயிரெழுத்துகளை நிரப்புவோம்!',
  description: 'Drag the missing Uyir Ezhuthukkal into their correct positions in the sequence (Nilai 1)',
  instructions: 'விடுபட்ட உயிரெழுத்தை சரியான இடத்தில் நிரப்புங்கள்!',
  maxScore: 12,
}

export const meiMissingLetterModule: InteractiveGameModule = {
  id: 'mei-missing-letter',
  name: 'மெய்யெழுத்துகளை நிரப்புவோம்!',
  description: 'Drag the missing Mei Ezhuthukkal into their correct positions in the sequence (Nilai 1)',
  instructions: 'விடுபட்ட மெய்யெழுத்தை சரியான இடத்தில் நிரப்புங்கள்!',
  maxScore: 18,
}
