export function getPersonInitials(
  name: string | null | undefined,
  fallback: string | null | undefined = undefined,
): string {
  const source = name?.trim() || fallback?.trim().split("@")[0] || "";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";

  const firstInitial = Array.from(parts[0] ?? "")[0] ?? "";
  const lastInitial =
    parts.length > 1
      ? Array.from(parts[parts.length - 1] ?? "")[0] ?? ""
      : "";

  return `${firstInitial}${lastInitial}`.toLocaleUpperCase("es-AR") || "U";
}
