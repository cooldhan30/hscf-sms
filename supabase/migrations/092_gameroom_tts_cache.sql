-- 092: cache for Listen & Choose's spoken answers (Sarvam text-to-speech).
--
-- The Little Learners game Listen & Choose plays the right answer out loud
-- and the child taps what they heard. The audio is made by Sarvam TTS on
-- the server (app/api/gameroom-v2/sessions/[id]/listen) and stored here so
-- each word/letter is paid for once. Files are named by a hash of the
-- spoken text, so a file name doesn't reveal the answer.
--
-- Private bucket: only the server (service role) reads or writes it; the
-- browser gets a short-lived signed link. No RLS policies are needed for
-- that, and none are added -- nobody else can list or read the bucket.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('gameroom-tts', 'gameroom-tts', false, 2097152, ARRAY['audio/mpeg'])
ON CONFLICT (id) DO NOTHING;
