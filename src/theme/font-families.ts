import { Platform } from "react-native";

import type { FontFamilyId } from "@/theme/appearance-options";

export type FontSet = {
  /** Large headings. */
  display: string;
  /** Body copy, buttons, and form text. */
  body: string;
  /** Small caps labels and money figures. */
  ledger: string;
};

const serif = Platform.select({
  android: "serif",
  default: "serif",
  ios: "Georgia",
  web: "Georgia, 'Times New Roman', serif",
});

const sans = Platform.select({
  android: "sans-serif",
  default: "System",
  ios: "System",
  web: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
});

/** Loaded in the root layout from src/assets/fonts. */
export const BUNDLED_MONO = "SpaceMono";
export const BUNDLED_READABLE = "AtkinsonHyperlegible";

export const FONT_FAMILIES: Record<
  FontFamilyId,
  { label: string; description: string; fonts: FontSet }
> = {
  obsidian: {
    description: "Serif headings, clean text, monospaced figures.",
    fonts: { body: sans, display: serif, ledger: BUNDLED_MONO },
    label: "Obsidian",
  },
  clean: {
    description: "One simple sans-serif font everywhere.",
    fonts: { body: sans, display: sans, ledger: sans },
    label: "Clean",
  },
  classic: {
    description: "Serif everywhere, like a printed ledger.",
    fonts: { body: serif, display: serif, ledger: serif },
    label: "Classic",
  },
  readable: {
    description:
      "Atkinson Hyperlegible, designed so similar letters are easy to tell apart.",
    fonts: {
      body: BUNDLED_READABLE,
      display: BUNDLED_READABLE,
      ledger: BUNDLED_READABLE,
    },
    label: "Readable",
  },
};
