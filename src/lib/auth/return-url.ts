// Only ever redirect back to a local path. Anything that could leave the
// site ("https://evil.com", "//evil.com", "/\evil.com", "javascript:") is
// replaced by the fallback.
export function safeReturnUrl(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(trimmed)) return fallback;
  // "/login" as a return URL would loop; send those to the fallback instead.
  if (trimmed === "/login" || trimmed.startsWith("/login?") || trimmed.startsWith("/register")) {
    return fallback;
  }
  return trimmed;
}
