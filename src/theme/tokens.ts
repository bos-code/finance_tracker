export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

export const radii = {
  small: 10,
  medium: 16,
  large: 24,
  sheet: 28,
  round: 999,
} as const;

export const motion = {
  quick: 140,
  standard: 220,
  deliberate: 360,
  spring: {
    damping: 40,
    stiffness: 500,
    mass: 1,
  },
} as const;
