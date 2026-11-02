import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";

import { useAppearanceStore } from "@/store/use-appearance-store";
import {
  DEFAULT_EFFECTS_LEVEL,
  DEFAULT_FONT_FAMILY_ID,
  DEFAULT_FONT_SCALE_ID,
  effectsOpacity,
  fontScaleValue,
  scaleLineHeight,
  scaleText,
  type EffectsLevel,
  type FontFamilyId,
  type FontScaleId,
} from "@/theme/appearance-options";
import { FONT_FAMILIES, type FontSet } from "@/theme/font-families";
import {
  DEFAULT_THEME_ID,
  THEMES,
  type AppPalette,
  type ThemeId,
} from "@/theme/themes";

export type AppTheme = {
  id: ThemeId;
  isDark: boolean;
  palette: AppPalette;
  fonts: FontSet;
  fontFamilyId: FontFamilyId;
  fontScaleId: FontScaleId;
  fontScale: number;
  /** The effects level actually in force (a theme may force it off). */
  effects: EffectsLevel;
  effectsOpacity: number;
  /** Font size for a design size: lifts tiny text, then applies the user's scale. */
  fs: (size: number) => number;
  /** Line height that follows `fs`. Pass the design font size when known. */
  lh: (fontSize: number | undefined, lineHeight: number) => number;
};

export function buildTheme({
  effects,
  fontFamilyId,
  fontScaleId,
  themeId,
}: {
  effects: EffectsLevel;
  fontFamilyId: FontFamilyId;
  fontScaleId: FontScaleId;
  themeId: ThemeId;
}): AppTheme {
  const definition = THEMES[themeId];
  const fontScale = fontScaleValue(fontScaleId);
  const effectiveEffects: EffectsLevel = definition.forceEffectsOff
    ? "off"
    : effects;

  return {
    effects: effectiveEffects,
    effectsOpacity: effectsOpacity(effectiveEffects),
    fontFamilyId,
    fontScale,
    fontScaleId,
    fonts: FONT_FAMILIES[fontFamilyId].fonts,
    fs: (size) => scaleText(size, fontScale),
    id: themeId,
    isDark: definition.isDark,
    lh: (fontSize, lineHeight) => scaleLineHeight(fontSize, lineHeight, fontScale),
    palette: definition.palette,
  };
}

const DEFAULT_THEME: AppTheme = buildTheme({
  effects: DEFAULT_EFFECTS_LEVEL,
  fontFamilyId: DEFAULT_FONT_FAMILY_ID,
  fontScaleId: DEFAULT_FONT_SCALE_ID,
  themeId: DEFAULT_THEME_ID,
});

const ThemeContext = createContext<AppTheme>(DEFAULT_THEME);

export function ThemeProvider({ children }: PropsWithChildren) {
  const themeId = useAppearanceStore((state) => state.themeId);
  const fontFamilyId = useAppearanceStore((state) => state.fontFamilyId);
  const fontScaleId = useAppearanceStore((state) => state.fontScaleId);
  const effects = useAppearanceStore((state) => state.effects);

  const theme = useMemo(
    () => buildTheme({ effects, fontFamilyId, fontScaleId, themeId }),
    [effects, fontFamilyId, fontScaleId, themeId],
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Builds a component's StyleSheet from the current theme. Pass a module-level
 * factory (`const createStyles = (theme: AppTheme) => StyleSheet.create({...})`)
 * so the styles are rebuilt only when the theme changes.
 */
export function useStyles<T>(factory: (theme: AppTheme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}
