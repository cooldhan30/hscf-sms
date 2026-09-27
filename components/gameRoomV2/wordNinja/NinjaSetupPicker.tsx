'use client'

import { WORD_NINJA_DIFFICULTY_SETTINGS, NINJA_TUNING, type WordNinjaDifficulty } from '@/lib/gameRoomV2/wordNinja'
import { ta } from '@/components/gameRoomV2/Bi'
import { TA } from '@/lib/gameRoomV2/i18n/ta'

const BLURB: Record<WordNinjaDifficulty, string> = {
  easy: 'மெதுவாக விழும், ஒரே நேரத்தில் இரண்டு சொற்கள். படிக்க நேரம் உண்டு.',
  normal: 'சீரான வேகம்; வெட்ட வெட்ட வேகம் கூடும்.',
  hard: 'வேகமாக விழும்; காற்றில் நான்கு சொற்கள் வரை.',
}

// The pre-run setup screen. Difficulty only changes the arcade (fall
// speed, words in the air, hearts); the words and categories always come
// from the session's CATEGORIZE Question Set.
export function NinjaSetupPicker({ onStart }: { onStart: (difficulty: WordNinjaDifficulty) => void }) {
  return (
    <div className="w-full max-w-xl mx-auto px-4 py-6">
      <div className="rounded-3xl bg-gradient-to-b from-indigo-950 to-slate-950 border border-white/10 p-6 text-white shadow-xl">
        <p className="text-sm font-semibold text-amber-300"><span className="font-tamil">சொல் வீரன்</span> · Word Ninja</p>
        <h1 className="font-tamil leading-relaxed text-2xl sm:text-3xl font-bold mt-1">சொல் பயிற்சிக் கூடம்</h1>
        <p className="text-sm text-indigo-200">The Word Dojo</p>
        <ul className="mt-4 space-y-2 text-sm text-slate-200">
          <li className="font-tamil">சொற்கள் மேலிருந்து விழும். தரையைத் தொடும் முன் ஒவ்வொன்றையும் சரியான பாதையில் வெட்டுங்கள் -- பாதைப் பொத்தானைத் தொடுங்கள், அல்லது 1, 2, 3 அழுத்துங்கள்.</li>
          <li className="font-tamil">தரையில் விழும் சொல் ஓர் இதயத்தை எடுக்கும், மீண்டும் விழும். உயரத்திலேயே வேகமாக வெட்டினால் தொடர் அடி கூடும்; பொன் சொற்களுக்கு மும்மடங்கு புள்ளிகள்.</li>
          <li className="font-tamil">எல்லாச் சொற்களும் வகைப்படுத்தப்பட்டதும் சுற்று சரிபார்க்கப்படும். முழுச் சரியான சுற்றுக்கு ஆற்றல் கிடைக்கும்; தவறான பாதைக்கு இரண்டு இதயங்கள் இழப்பு.</li>
          <li className="font-tamil">ஆற்றல்கள்: மெதுநேரம் (Z), கேடயம் (X).</li>
        </ul>
        <div className="mt-5 grid gap-2" role="radiogroup" aria-label={ta('difficulty', true)}>
          {WORD_NINJA_DIFFICULTY_SETTINGS.map((d) => (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={false}
              onClick={() => onStart(d.id)}
              className="text-left rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300 p-3 min-h-[44px] flex items-center gap-3"
            >
              <span className="flex-1">
                <span className="block font-semibold"><span className="font-tamil">{TA[d.id].ta}</span> <span className="text-xs opacity-70">· {d.label}</span></span>
                <span className="block text-xs text-slate-300 font-tamil">{BLURB[d.id]}</span>
              </span>
              <span className="text-xs text-rose-300 tabular-nums" aria-label={`${NINJA_TUNING[d.id].lives} இதயங்கள்`}>
                {NINJA_TUNING[d.id].lives} <span className="font-tamil">இதயங்கள்</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
