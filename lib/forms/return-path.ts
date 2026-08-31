export function safeReturnPath(value: string, fallback: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

export function withReturnError(returnTo: string, message: string): string {
  const separator = returnTo.includes("?") ? "&" : "?";
  return `${returnTo}${separator}error=${encodeURIComponent(message)}`;
}
