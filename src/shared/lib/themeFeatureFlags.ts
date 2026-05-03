type ThemeId = "theme1" | "theme2" | "theme3" | "builder";

const FALSE_LIKE_VALUES = new Set(["0", "false", "off", "no", "disabled"]);

function parseEnvFlag(rawValue: unknown, defaultValue = false): boolean {
  if (typeof rawValue === "boolean") return rawValue;
  if (typeof rawValue !== "string") return defaultValue;

  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) return defaultValue;
  return !FALSE_LIKE_VALUES.has(normalized);
}

export const DEFAULT_EDUCATOR_THEME: ThemeId = "theme2";

export const themeFeatureFlags = {
  theme1Unlocked: parseEnvFlag(import.meta.env.VITE_THEME_1_UNLOCKED, false),
  theme3Unlocked: parseEnvFlag(import.meta.env.VITE_THEME_3_UNLOCKED, false),
};

function isKnownThemeId(value: unknown): value is ThemeId {
  return value === "theme1" || value === "theme2" || value === "theme3" || value === "builder";
}

export function isThemeUnlocked(themeId: ThemeId): boolean {
  if (themeId === "theme1") return themeFeatureFlags.theme1Unlocked;
  if (themeId === "theme3") return themeFeatureFlags.theme3Unlocked;
  // "builder" and "theme2" are always available
  return true;
}

export function sanitizeEducatorTheme(rawThemeId: unknown): ThemeId {
  const requestedThemeId = isKnownThemeId(rawThemeId) ? rawThemeId : DEFAULT_EDUCATOR_THEME;
  return isThemeUnlocked(requestedThemeId) ? requestedThemeId : DEFAULT_EDUCATOR_THEME;
}
