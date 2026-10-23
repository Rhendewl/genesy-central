export type StoryGradient = {
  backgroundGradientEnabled?: boolean;
  backgroundGradientIntensity?: number;
  backgroundGradientLength?: number;
};
const percent = (value: number | undefined, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : fallback;
export function normalizeStoryGradient(value: StoryGradient) {
  return {
    backgroundGradientEnabled: value.backgroundGradientEnabled === true,
    backgroundGradientIntensity: percent(value.backgroundGradientIntensity, 100),
    backgroundGradientLength: percent(value.backgroundGradientLength, 65),
  };
}
export function storyGradientStyle(value: StoryGradient) {
  const settings = normalizeStoryGradient(value);
  return {
    height: `${settings.backgroundGradientLength}%`,
    background: `linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, ${settings.backgroundGradientIntensity / 100}) 100%)`,
  };
}
