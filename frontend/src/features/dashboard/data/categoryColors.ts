const CATEGORY_COLORS_KEY = "bolsi.category_colors";

export type CategoryColorsMap = Record<string, string>;

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function loadCategoryColors(): CategoryColorsMap {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(CATEGORY_COLORS_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      ([, value]) => isHexColor(value),
    );

    return Object.fromEntries(entries) as CategoryColorsMap;
  } catch {
    return {};
  }
}

export function saveCategoryColors(colors: CategoryColorsMap): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CATEGORY_COLORS_KEY, JSON.stringify(colors));
}

export function removeCategoryColor(categoryId: number): CategoryColorsMap {
  const previous = loadCategoryColors();
  const next = { ...previous };
  delete next[String(categoryId)];
  saveCategoryColors(next);
  return next;
}
