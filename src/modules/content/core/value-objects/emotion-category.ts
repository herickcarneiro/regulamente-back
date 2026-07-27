export const EMOTION_CATEGORIES = [
  'anxiety',
  'anger',
  'sadness',
  'overload',
] as const;

export type EmotionCategory = (typeof EMOTION_CATEGORIES)[number];

export function isEmotionCategory(value: string): value is EmotionCategory {
  return (EMOTION_CATEGORIES as readonly string[]).includes(value);
}
