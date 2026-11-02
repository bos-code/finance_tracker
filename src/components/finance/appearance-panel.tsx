import { ActionButton } from "@/components/finance/action-button";
import { useAppearanceStore } from "@/store/use-appearance-store";
import {
  EFFECT_LEVELS,
  FONT_FAMILY_IDS,
  FONT_SCALES,
  type EffectsLevel,
  type FontFamilyId,
  type FontScaleId,
} from "@/theme/appearance-options";
import { FONT_FAMILIES } from "@/theme/font-families";
import { type AppTheme, useStyles, useTheme } from "@/theme/theme-context";
import { THEME_IDS, THEMES, type ThemeId } from "@/theme/themes";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";

// Fixed glyph sizes so the "A A A A" scale picker reads the same in every theme.
const SCALE_GLYPH_SIZES: Record<FontScaleId, number> = {
  larger: 24,
  largest: 28,
  large: 20,
  standard: 16,
};

function pick() {
  void Haptics.selectionAsync();
}

/**
 * Theme, text size, font, and background-effect controls. Every option draws
 * itself in its own colours and font, so people choose by looking.
 */
export function AppearancePanel() {
  const theme = useTheme();
  const { palette } = theme;
  const styles = useStyles(createStyles);

  const themeId = useAppearanceStore((state) => state.themeId);
  const fontFamilyId = useAppearanceStore((state) => state.fontFamilyId);
  const fontScaleId = useAppearanceStore((state) => state.fontScaleId);
  const effects = useAppearanceStore((state) => state.effects);
  const setThemeId = useAppearanceStore((state) => state.setThemeId);
  const setFontFamilyId = useAppearanceStore((state) => state.setFontFamilyId);
  const setFontScaleId = useAppearanceStore((state) => state.setFontScaleId);
  const setEffects = useAppearanceStore((state) => state.setEffects);
  const reset = useAppearanceStore((state) => state.reset);

  const effectsLocked = THEMES[themeId].forceEffectsOff;

  const chooseTheme = (id: ThemeId) => {
    pick();
    setThemeId(id);
  };
  const chooseFont = (id: FontFamilyId) => {
    pick();
    setFontFamilyId(id);
  };
  const chooseScale = (id: FontScaleId) => {
    pick();
    setFontScaleId(id);
  };
  const chooseEffects = (id: EffectsLevel) => {
    pick();
    setEffects(id);
  };

  return (
    <View style={styles.root}>
      <View style={styles.preview}>
        <Text style={styles.previewLabel}>PREVIEW</Text>
        <Text style={styles.previewTitle}>Available this month</Text>
        <Text style={styles.previewAmount}>1,284.50</Text>
        <View style={styles.previewRow}>
          <View
            style={[styles.previewDot, { backgroundColor: palette.expense }]}
          />
          <Text style={styles.previewRowText}>Groceries</Text>
          <Text style={styles.previewRowAmount}>-42.80</Text>
        </View>
        <View style={styles.previewRow}>
          <View
            style={[styles.previewDot, { backgroundColor: palette.income }]}
          />
          <Text style={styles.previewRowText}>Salary</Text>
          <Text style={styles.previewRowAmount}>+950.00</Text>
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.groupLabel}>THEME</Text>
        <View style={styles.themeGrid}>
          {THEME_IDS.map((id) => {
            const option = THEMES[id];
            const selected = id === themeId;
            return (
              <Pressable
                accessibilityLabel={`${option.label} theme. ${option.description}`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={id}
                onPress={() => chooseTheme(id)}
                style={({ pressed }) => [
                  styles.themeCard,
                  selected ? styles.optionSelected : null,
                  { opacity: pressed ? 0.7 : 1 },
                ]}>
                <View
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: option.palette.canvas,
                      borderColor: option.palette.lineStrong,
                    },
                  ]}>
                  <Text
                    style={[styles.swatchText, { color: option.palette.text }]}>
                    Aa
                  </Text>
                  <View style={styles.swatchDots}>
                    {(
                      [
                        "signalAmber",
                        "signalViolet",
                        "signalCyan",
                        "signalMoss",
                      ] as const
                    ).map((token) => (
                      <View
                        key={token}
                        style={[
                          styles.swatchDot,
                          { backgroundColor: option.palette[token] },
                        ]}
                      />
                    ))}
                  </View>
                </View>
                <View style={styles.optionHeader}>
                  <Text style={styles.optionTitle}>{option.label}</Text>
                  {selected ? (
                    <MaterialCommunityIcons
                      color={palette.text}
                      name="check-circle"
                      size={18}
                    />
                  ) : null}
                </View>
                <Text style={styles.optionHint}>{option.description}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.groupLabel}>TEXT SIZE</Text>
        <View style={styles.scaleGrid}>
          {FONT_SCALES.map((option) => {
            const selected = option.id === fontScaleId;
            return (
              <Pressable
                accessibilityLabel={`Text size ${option.label}`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={option.id}
                onPress={() => chooseScale(option.id)}
                style={({ pressed }) => [
                  styles.scaleOption,
                  selected ? styles.optionSelected : null,
                  { opacity: pressed ? 0.7 : 1 },
                ]}>
                <Text
                  style={[
                    styles.scaleGlyph,
                    { fontSize: SCALE_GLYPH_SIZES[option.id] },
                  ]}>
                  A
                </Text>
                <Text style={styles.scaleLabel}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.groupLabel}>FONT</Text>
        <View style={styles.fontList}>
          {FONT_FAMILY_IDS.map((id) => {
            const option = FONT_FAMILIES[id];
            const selected = id === fontFamilyId;
            return (
              <Pressable
                accessibilityLabel={`${option.label} font. ${option.description}`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={id}
                onPress={() => chooseFont(id)}
                style={({ pressed }) => [
                  styles.fontRow,
                  selected ? styles.optionSelected : null,
                  { opacity: pressed ? 0.7 : 1 },
                ]}>
                <View style={styles.fontCopy}>
                  <Text
                    style={[
                      styles.fontName,
                      { fontFamily: option.fonts.display },
                    ]}>
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.fontSample,
                      { fontFamily: option.fonts.body },
                    ]}>
                    Spent 2,500 on lunch today
                  </Text>
                  <Text style={styles.optionHint}>{option.description}</Text>
                </View>
                {selected ? (
                  <MaterialCommunityIcons
                    color={palette.text}
                    name="check-circle"
                    size={20}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.groupLabel}>BACKGROUND EFFECTS</Text>
        <View style={[styles.effectsRow, effectsLocked ? styles.locked : null]}>
          {EFFECT_LEVELS.map((option) => {
            const selected = (effectsLocked ? "off" : effects) === option.id;
            return (
              <Pressable
                accessibilityLabel={`Background effects ${option.label}`}
                accessibilityRole="radio"
                accessibilityState={{ disabled: effectsLocked, selected }}
                disabled={effectsLocked}
                key={option.id}
                onPress={() => chooseEffects(option.id)}
                style={({ pressed }) => [
                  styles.effectOption,
                  selected ? styles.optionSelected : null,
                  { opacity: pressed ? 0.7 : 1 },
                ]}>
                <Text style={styles.effectLabel}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.optionHint}>
          {effectsLocked
            ? "High contrast keeps the background plain so nothing competes with the text."
            : "The thin animated lines behind some screens. Turn them off if they distract you."}
        </Text>
      </View>

      <ActionButton
        icon="restore"
        label="Reset to defaults"
        onPress={() => {
          pick();
          reset();
        }}
        tone="quiet"
      />
    </View>
  );
}

const createStyles = ({ palette, fonts, fs, lh }: AppTheme) =>
  StyleSheet.create({
    root: { gap: 26, paddingBottom: 8 },

    preview: {
      backgroundColor: palette.surface,
      borderColor: palette.lineStrong,
      borderWidth: 1,
      gap: 8,
      padding: 16,
    },
    previewLabel: {
      color: palette.textQuiet,
      fontFamily: fonts.ledger,
      fontSize: fs(10),
      letterSpacing: 1,
    },
    previewTitle: {
      color: palette.textMuted,
      fontFamily: fonts.body,
      fontSize: fs(13),
    },
    previewAmount: {
      color: palette.text,
      fontFamily: fonts.display,
      fontSize: fs(34),
      lineHeight: lh(34, 40),
    },
    previewRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
      minHeight: 28,
    },
    previewDot: { borderRadius: 4, height: 8, width: 8 },
    previewRowText: {
      color: palette.text,
      flex: 1,
      fontFamily: fonts.body,
      fontSize: fs(14),
    },
    previewRowAmount: {
      color: palette.textMuted,
      fontFamily: fonts.ledger,
      fontSize: fs(13),
    },

    group: { gap: 12 },
    groupLabel: {
      color: palette.textMuted,
      fontFamily: fonts.ledger,
      fontSize: fs(11),
      letterSpacing: 1,
    },

    optionSelected: {
      backgroundColor: palette.surfaceRaised,
      borderColor: palette.text,
      borderWidth: 2,
    },
    optionHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    optionTitle: {
      color: palette.text,
      fontFamily: fonts.body,
      fontSize: fs(15),
      fontWeight: "700",
    },
    optionHint: {
      color: palette.textMuted,
      fontFamily: fonts.body,
      fontSize: fs(12),
      lineHeight: lh(12, 18),
    },

    themeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    themeCard: {
      backgroundColor: palette.surface,
      borderColor: palette.line,
      borderWidth: 1,
      flexBasis: "47%",
      flexGrow: 1,
      gap: 8,
      padding: 10,
    },
    swatch: {
      borderWidth: 1,
      gap: 10,
      height: 76,
      justifyContent: "space-between",
      padding: 10,
    },
    swatchText: { fontFamily: fonts.display, fontSize: 22 },
    swatchDots: { flexDirection: "row", gap: 6 },
    swatchDot: { borderRadius: 5, height: 10, width: 10 },

    scaleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    scaleOption: {
      alignItems: "center",
      backgroundColor: palette.surface,
      borderColor: palette.line,
      borderWidth: 1,
      flexBasis: "47%",
      flexGrow: 1,
      gap: 4,
      justifyContent: "center",
      minHeight: 76,
      padding: 10,
    },
    scaleGlyph: { color: palette.text, fontFamily: fonts.display },
    scaleLabel: {
      color: palette.textMuted,
      fontFamily: fonts.body,
      fontSize: fs(12),
    },

    fontList: { gap: 10 },
    fontRow: {
      alignItems: "center",
      backgroundColor: palette.surface,
      borderColor: palette.line,
      borderWidth: 1,
      flexDirection: "row",
      gap: 12,
      minHeight: 76,
      padding: 14,
    },
    fontCopy: { flex: 1, gap: 4 },
    fontName: {
      color: palette.text,
      fontSize: fs(18),
      lineHeight: lh(18, 24),
    },
    fontSample: {
      color: palette.text,
      fontSize: fs(14),
      lineHeight: lh(14, 20),
    },

    effectsRow: { flexDirection: "row", gap: 10 },
    effectOption: {
      alignItems: "center",
      backgroundColor: palette.surface,
      borderColor: palette.line,
      borderWidth: 1,
      flex: 1,
      justifyContent: "center",
      minHeight: 48,
      padding: 10,
    },
    effectLabel: {
      color: palette.text,
      fontFamily: fonts.body,
      fontSize: fs(13),
      fontWeight: "600",
    },
    locked: { opacity: 0.5 },
  });
