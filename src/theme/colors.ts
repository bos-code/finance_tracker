/**
 * Obsidian Thread — dark-first finance tokens.
 *
 * Black, white, and graphite carry the product. Color appears only as a signal:
 * thin threads, hairline borders, background traces, and financial status.
 */
export const palette = {
  canvas: "#070707",
  canvasRaised: "#0B0B0B",
  surface: "#111111",
  surfaceRaised: "#181818",
  surfacePressed: "#202020",
  navigation: "#0C0C0C",
  text: "#F2F2F0",
  textMuted: "#A1A19D",
  textQuiet: "#6F6F6B",
  line: "#292927",
  lineStrong: "#40403C",
  signalAmber: "#D99A61",
  signalViolet: "#8E82C9",
  signalCyan: "#63A6B3",
  signalMoss: "#7E9E78",
  income: "#78B68C",
  expense: "#C77B70",
  warning: "#D1A064",
  info: "#72A5B0",
  white: "#FFFFFF",
  black: "#000000",
} as const;

/** Flat aliases kept for existing imports while screens migrate to palette. */
export const colors = {
  background: palette.canvas,
  surface: palette.surface,
  primary: palette.text,
  textPrimary: palette.text,
  textSecondary: palette.textMuted,
  success: palette.income,
  danger: palette.expense,
  border: palette.line,
} as const;

export const withAlpha = (hexColor: string, alpha: number) => {
  const hex = hexColor.replace("#", "");
  if (hex.length !== 6) return hexColor;

  const value = Number.parseInt(hex, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};
