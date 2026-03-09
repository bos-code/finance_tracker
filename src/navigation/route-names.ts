export const ROUTES = {
  ONBOARDING: "/onboarding",
  AUTH: "/",
  TABS_HOME: "/(tabs)/home",
  TABS_CALENDAR: "/(tabs)/calender",
  TABS_STATS: "/(tabs)/chartpie",
  TABS_PROFILE: "/(tabs)/user",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
