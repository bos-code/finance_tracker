import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  DEFAULT_EFFECTS_LEVEL,
  DEFAULT_FONT_FAMILY_ID,
  DEFAULT_FONT_SCALE_ID,
  isEffectsLevel,
  isFontFamilyId,
  isFontScaleId,
  type EffectsLevel,
  type FontFamilyId,
  type FontScaleId,
} from "@/theme/appearance-options";
import { DEFAULT_THEME_ID, isThemeId, type ThemeId } from "@/theme/themes";

type AppearanceState = {
  themeId: ThemeId;
  fontFamilyId: FontFamilyId;
  fontScaleId: FontScaleId;
  effects: EffectsLevel;
  setThemeId: (themeId: ThemeId) => void;
  setFontFamilyId: (fontFamilyId: FontFamilyId) => void;
  setFontScaleId: (fontScaleId: FontScaleId) => void;
  setEffects: (effects: EffectsLevel) => void;
  reset: () => void;
};

const DEFAULTS = {
  effects: DEFAULT_EFFECTS_LEVEL,
  fontFamilyId: DEFAULT_FONT_FAMILY_ID,
  fontScaleId: DEFAULT_FONT_SCALE_ID,
  themeId: DEFAULT_THEME_ID,
} as const;

// Static web rendering has no storage; hydrate straight to the defaults.
const noStorage = {
  getItem: async () => null,
  removeItem: async () => undefined,
  setItem: async () => undefined,
};

const storage =
  Platform.OS === "web" && typeof window === "undefined"
    ? noStorage
    : AsyncStorage;

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      reset: () => set({ ...DEFAULTS }),
      setEffects: (effects) => set({ effects }),
      setFontFamilyId: (fontFamilyId) => set({ fontFamilyId }),
      setFontScaleId: (fontScaleId) => set({ fontScaleId }),
      setThemeId: (themeId) => set({ themeId }),
    }),
    {
      name: "finance-tracker-appearance",
      // An unknown stored value (older or newer app version) falls back to the
      // default instead of crashing the whole UI.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<AppearanceState>;
        return {
          ...current,
          effects: isEffectsLevel(saved.effects) ? saved.effects : current.effects,
          fontFamilyId: isFontFamilyId(saved.fontFamilyId)
            ? saved.fontFamilyId
            : current.fontFamilyId,
          fontScaleId: isFontScaleId(saved.fontScaleId)
            ? saved.fontScaleId
            : current.fontScaleId,
          themeId: isThemeId(saved.themeId) ? saved.themeId : current.themeId,
        };
      },
      partialize: (state) => ({
        effects: state.effects,
        fontFamilyId: state.fontFamilyId,
        fontScaleId: state.fontScaleId,
        themeId: state.themeId,
      }),
      storage: createJSONStorage(() => storage),
    },
  ),
);

/** True once saved appearance settings have been read, so the first paint is right. */
export function useAppearanceHydrated() {
  const [hydrated, setHydrated] = useState(() =>
    useAppearanceStore.persist.hasHydrated(),
  );

  useEffect(() => {
    if (useAppearanceStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return useAppearanceStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  return hydrated;
}
