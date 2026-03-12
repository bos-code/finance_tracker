import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ThemeGradient = {
  colors: [string, string];  // start, end
  id: string;
};

export type ThemeConfig = {
  primary: string;          // solid accent colour used across the app
  gradient: ThemeGradient;  // gradient used on avatar / head cards
};

export type ThemeContextValue = {
  theme: ThemeConfig;
  setTheme: (config: ThemeConfig) => void;
};

// ─── Presets ──────────────────────────────────────────────────────────────────

export const SOLID_PRESETS: { id: string; color: string; label: string }[] = [
  { id: "blue",     color: "#1d4ed8", label: "Ocean" },
  { id: "indigo",   color: "#4f46e5", label: "Indigo" },
  { id: "violet",   color: "#7c3aed", label: "Violet" },
  { id: "rose",     color: "#e11d48", label: "Rose" },
  { id: "orange",   color: "#ea580c", label: "Ember" },
  { id: "amber",    color: "#d97706", label: "Amber" },
  { id: "emerald",  color: "#059669", label: "Emerald" },
  { id: "teal",     color: "#0d9488", label: "Teal" },
  { id: "sky",      color: "#0284c7", label: "Sky" },
  { id: "slate",    color: "#475569", label: "Slate" },
  { id: "pink",     color: "#db2777", label: "Candy" },
  { id: "midnight", color: "#1e293b", label: "Midnight" },
];

export const GRADIENT_PRESETS: ThemeGradient[] = [
  { id: "ocean",    colors: ["#1d4ed8", "#0ea5e9"] },
  { id: "aurora",   colors: ["#4f46e5", "#ec4899"] },
  { id: "sunset",   colors: ["#ea580c", "#f59e0b"] },
  { id: "forest",   colors: ["#059669", "#10b981"] },
  { id: "midnight", colors: ["#0f172a", "#1e3a5f"] },
  { id: "rose",     colors: ["#e11d48", "#f97316"] },
  { id: "cosmic",   colors: ["#7c3aed", "#3b82f6"] },
  { id: "mint",     colors: ["#0d9488", "#6366f1"] },
];

export const DEFAULT_THEME: ThemeConfig = {
  primary: SOLID_PRESETS[0].color,
  gradient: GRADIENT_PRESETS[0],
};

const STORAGE_KEY = "@finance_tracker_theme";

// ─── Context ──────────────────────────────────────────────────────────────────

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setThemeState] = useState<ThemeConfig>(DEFAULT_THEME);

  // Load persisted theme
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try { setThemeState(JSON.parse(raw)); } catch {}
      }
    });
  }, []);

  const setTheme = useCallback((config: ThemeConfig) => {
    setThemeState(config);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
