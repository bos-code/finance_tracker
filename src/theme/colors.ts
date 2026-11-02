/**
 * Colour helpers. The colours themselves live in `themes.ts` and reach
 * components through `useTheme()`, so they change with the user's chosen theme.
 */
export const withAlpha = (hexColor: string, alpha: number) => {
  const hex = hexColor.replace("#", "");
  if (hex.length !== 6) return hexColor;

  const value = Number.parseInt(hex, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};
