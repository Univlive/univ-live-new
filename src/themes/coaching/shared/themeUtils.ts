export function initials(name: string): string {
  return (name || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join("");
}

export function isTruthyUrl(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
