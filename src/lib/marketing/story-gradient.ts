export type StoryGradient = {
  backgroundGradientEnabled?: boolean;
  backgroundGradientIntensity?: number;
  backgroundGradientLength?: number;
};
const percent = (value: number | undefined, fallback: number, max = 100) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : fallback;
export function normalizeStoryGradient(value: StoryGradient) {
  return {
    backgroundGradientEnabled: value.backgroundGradientEnabled === true,
    backgroundGradientIntensity: percent(value.backgroundGradientIntensity, 100, 200),
    backgroundGradientLength: percent(value.backgroundGradientLength, 65),
  };
}
export function storyGradientStyle(value: StoryGradient) {
  const settings = normalizeStoryGradient(value);
  const strength = settings.backgroundGradientIntensity / 100;
  // Keep the original appearance through 100%. Higher values compress the
  // transition so the base becomes solid black earlier within the chosen height.
  const background = strength <= 1
    ? `linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, ${strength}) 100%)`
    : `linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 1) ${100 / strength}%, rgba(0, 0, 0, 1) 100%)`;
  return {
    height: `${settings.backgroundGradientLength}%`,
    background,
  };
}
