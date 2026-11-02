/**
 * Text size and effect options. Pure functions, no React Native imports.
 *
 * The app's original styles used very small type (6–11px for about 150 labels).
 * `readableSize` lifts that floor for everyone, and the user's text size setting
 * scales on top of it.
 */

export type FontScaleId = "standard" | "large" | "larger" | "largest";

export const FONT_SCALES: readonly {
  id: FontScaleId;
  label: string;
  value: number;
}[] = [
  { id: "standard", label: "Standard", value: 1 },
  { id: "large", label: "Large", value: 1.15 },
  { id: "larger", label: "Larger", value: 1.3 },
  { id: "largest", label: "Largest", value: 1.5 },
];

export const DEFAULT_FONT_SCALE_ID: FontScaleId = "standard";

export function isFontScaleId(value: unknown): value is FontScaleId {
  return FONT_SCALES.some((scale) => scale.id === value);
}

export function fontScaleValue(id: FontScaleId) {
  return FONT_SCALES.find((scale) => scale.id === id)?.value ?? 1;
}

export type FontFamilyId = "obsidian" | "clean" | "classic" | "readable";

export const FONT_FAMILY_IDS: readonly FontFamilyId[] = [
  "obsidian",
  "clean",
  "classic",
  "readable",
];

export const DEFAULT_FONT_FAMILY_ID: FontFamilyId = "obsidian";

export function isFontFamilyId(value: unknown): value is FontFamilyId {
  return FONT_FAMILY_IDS.includes(value as FontFamilyId);
}

export type EffectsLevel = "off" | "subtle" | "full";

export const EFFECT_LEVELS: readonly {
  id: EffectsLevel;
  label: string;
  /** Opacity of the decorative background lines. */
  opacity: number;
}[] = [
  { id: "off", label: "Off", opacity: 0 },
  { id: "subtle", label: "Subtle", opacity: 0.2 },
  { id: "full", label: "Full", opacity: 0.62 },
];

export const DEFAULT_EFFECTS_LEVEL: EffectsLevel = "subtle";

export function isEffectsLevel(value: unknown): value is EffectsLevel {
  return EFFECT_LEVELS.some((level) => level.id === value);
}

export function effectsOpacity(level: EffectsLevel) {
  return EFFECT_LEVELS.find((entry) => entry.id === level)?.opacity ?? 0;
}

const READABLE_FLOOR: Record<number, number> = {
  6: 11,
  7: 11,
  8: 11,
  9: 12,
  10: 12,
  11: 13,
  12: 14,
  13: 14,
  14: 15,
  15: 16,
  16: 17,
  17: 18,
};

/** The size the app actually draws for a design size: small text is lifted. */
export function readableSize(size: number) {
  if (size >= 18) return size;
  return READABLE_FLOOR[Math.round(size)] ?? Math.max(11, Math.round(size));
}

/** Big display type scales less than body text so headings still fit a phone. */
function effectiveScale(size: number, scale: number) {
  if (size >= 24) return 1 + (scale - 1) * 0.5;
  if (size >= 18) return 1 + (scale - 1) * 0.75;
  return scale;
}

export function scaleText(size: number, scale: number) {
  return Math.round(readableSize(size) * effectiveScale(size, scale));
}

/**
 * Line height that keeps the design's line-height-to-font-size ratio. When the
 * style has no font size, it simply follows the scale.
 */
export function scaleLineHeight(
  fontSize: number | undefined,
  lineHeight: number,
  scale: number,
) {
  if (!fontSize) return Math.round(lineHeight * scale);
  return Math.round(lineHeight * (scaleText(fontSize, scale) / fontSize));
}
