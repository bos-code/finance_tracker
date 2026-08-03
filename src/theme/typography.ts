import { Platform } from "react-native";

export const fonts = {
  display: Platform.select({
    android: "serif",
    ios: "Georgia",
    web: "Georgia, 'Times New Roman', serif",
  }),
  body: Platform.select({
    android: "sans-serif",
    ios: "System",
    web: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  }),
  ledger: "SpaceMono",
} as const;

export const typography = {
  display: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44 },
  heading: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34 },
  title: { fontFamily: fonts.body, fontSize: 17, lineHeight: 24, fontWeight: "700" },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  ledger: { fontFamily: fonts.ledger, fontSize: 13, lineHeight: 19 },
} as const;
