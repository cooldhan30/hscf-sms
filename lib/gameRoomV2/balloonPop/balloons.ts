// Balloon Pop (பலூன் உடைப்போம்) -- Little Learners (ages 4-9). Answer
// options ride up the sky in balloons; the child taps one to pop it. The
// shared kids' logic (options, reveal matching, sizing, motion) lives in
// lib/gameRoomV2/kids; these names stay for Balloon Pop's own callers.
export {
  choiceOptions as balloonOptions,
  risePosition as balloonPosition,
  KID_COLORS as BALLOON_COLORS,
  CHOICE_QUESTION_TYPES as BALLOON_QUESTION_TYPES,
  isRevealedAnswer,
  visibleLength,
  labelSizeStep,
  PRAISE,
  type ChoiceOption as BalloonOption,
  type KidsQuestion,
} from '../kids'
