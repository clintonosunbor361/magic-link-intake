const PUBLIC_PREFIXES = ["/auth", "/setup", "/offline", "/i", "/intake", "/approve"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function decideRouteAccess(input: {
  pathname: string;
  configured: boolean;
  signedIn: boolean;
}): "allow" | "setup" | "sign_in" {
  if (isPublicPath(input.pathname)) return "allow";
  if (!input.configured) return "setup";
  return input.signedIn ? "allow" : "sign_in";
}
