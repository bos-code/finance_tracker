/**
 * Colour themes. Pure data: no React Native imports, so the contrast of every
 * theme can be verified in unit tests (tests/backend/theme-contrast.test.mjs).
 *
 * Every text colour is chosen to meet WCAG AA (4.5:1) on every surface it can
 * appear on, and primary text to meet 7:1. Change a value and the test tells you
 * whether you broke readability.
 */

export type AppPalette = {
  canvas: string;
  canvasRaised: string;
  surface: string;
  surfaceRaised: string;
  surfacePressed: string;
  navigation: string;
  text: string;
  textMuted: string;
  textQuiet: string;
  line: string;
  lineStrong: string;
  signalAmber: string;
  signalViolet: string;
  signalCyan: string;
  signalMoss: string;
  income: string;
  expense: string;
  warning: string;
  info: string;
  /** Text and icons placed on a `text`-coloured fill (primary buttons, selected chips). */
  onPrimary: string;
  /** Faint overlay used to lift a surface: white on dark themes, black on light. */
  tint: string;
  white: string;
  black: string;
};

export type ThemeId = "obsidian" | "daylight" | "midnight" | "contrast";

export type ThemeDefinition = {
  id: ThemeId;
  label: string;
  description: string;
  isDark: boolean;
  /** Themes that must never show decorative background lines. */
  forceEffectsOff: boolean;
  palette: AppPalette;
};

export const THEME_IDS: readonly ThemeId[] = [
  "obsidian",
  "daylight",
  "midnight",
  "contrast",
];

export const DEFAULT_THEME_ID: ThemeId = "obsidian";

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  obsidian: {
    description: "Black and graphite. The original look, with stronger text.",
    forceEffectsOff: false,
    id: "obsidian",
    isDark: true,
    label: "Obsidian",
    palette: {
      black: "#000000",
      canvas: "#070707",
      canvasRaised: "#0B0B0B",
      expense: "#D68A7F",
      income: "#82C095",
      info: "#7FB4BF",
      line: "#333330",
      lineStrong: "#4D4D49",
      navigation: "#0C0C0C",
      onPrimary: "#000000",
      signalAmber: "#E0A46B",
      signalCyan: "#6FB5C2",
      signalMoss: "#8CAE86",
      signalViolet: "#A397DB",
      surface: "#111111",
      surfacePressed: "#202020",
      surfaceRaised: "#181818",
      text: "#F4F4F2",
      textMuted: "#BDBDB8",
      textQuiet: "#A3A39E",
      tint: "#FFFFFF",
      warning: "#DDAA6E",
      white: "#FFFFFF",
    },
  },
  daylight: {
    description: "Light and warm, easy to read in sunlight.",
    forceEffectsOff: false,
    id: "daylight",
    isDark: false,
    label: "Daylight",
    palette: {
      black: "#000000",
      canvas: "#F6F5F1",
      canvasRaised: "#FFFFFF",
      expense: "#A8352A",
      income: "#1B7339",
      info: "#1B6272",
      line: "#D6D5CE",
      lineStrong: "#A9A89F",
      navigation: "#FFFFFF",
      onPrimary: "#FFFFFF",
      signalAmber: "#8F5410",
      signalCyan: "#1C6877",
      signalMoss: "#44703D",
      signalViolet: "#5648A0",
      surface: "#FFFFFF",
      surfacePressed: "#E6E5DF",
      surfaceRaised: "#EFEEE9",
      text: "#14140F",
      textMuted: "#4A4A44",
      textQuiet: "#62625B",
      tint: "#000000",
      warning: "#855309",
      white: "#FFFFFF",
    },
  },
  midnight: {
    description: "Deep blue-black with softer, cooler contrast.",
    forceEffectsOff: false,
    id: "midnight",
    isDark: true,
    label: "Midnight",
    palette: {
      black: "#000000",
      canvas: "#0A0F1A",
      canvasRaised: "#0E1524",
      expense: "#EE9585",
      income: "#7FD39B",
      info: "#7CC4E6",
      line: "#2A3856",
      lineStrong: "#435580",
      navigation: "#0D1424",
      onPrimary: "#0A0F1A",
      signalAmber: "#E8B46E",
      signalCyan: "#6CCBE0",
      signalMoss: "#93C08A",
      signalViolet: "#B2A6F0",
      surface: "#121B2E",
      surfacePressed: "#1F2C49",
      surfaceRaised: "#18233B",
      text: "#EEF2FA",
      textMuted: "#B8C2D6",
      textQuiet: "#98A6C0",
      tint: "#FFFFFF",
      warning: "#E8B46E",
      white: "#FFFFFF",
    },
  },
  contrast: {
    description: "Maximum contrast: pure black, bright text, strong borders.",
    forceEffectsOff: true,
    id: "contrast",
    isDark: true,
    label: "High contrast",
    palette: {
      black: "#000000",
      canvas: "#000000",
      canvasRaised: "#000000",
      expense: "#FF8F80",
      income: "#7DFF9E",
      info: "#8FE3FF",
      line: "#8A8A8A",
      lineStrong: "#FFFFFF",
      navigation: "#000000",
      onPrimary: "#000000",
      signalAmber: "#FFC266",
      signalCyan: "#7FE3F5",
      signalMoss: "#B0E8A0",
      signalViolet: "#CBBFFF",
      surface: "#0A0A0A",
      surfacePressed: "#1E1E1E",
      surfaceRaised: "#141414",
      text: "#FFFFFF",
      textMuted: "#EAEAEA",
      textQuiet: "#D2D2D2",
      tint: "#FFFFFF",
      warning: "#FFD166",
      white: "#FFFFFF",
    },
  },
};

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && value in THEMES;
}

function channel(value: number) {
  const unit = value / 255;
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const clean = hex.replace("#", "");
  const red = Number.parseInt(clean.slice(0, 2), 16);
  const green = Number.parseInt(clean.slice(2, 4), 16);
  const blue = Number.parseInt(clean.slice(4, 6), 16);
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

/** WCAG 2.x contrast ratio between two #RRGGBB colours (1 to 21). */
export function contrastRatio(foreground: string, background: string) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
