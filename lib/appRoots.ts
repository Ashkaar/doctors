// The app's own first path segments. Anything else in first place is a
// clinic's address (proxy.ts). Ariloo must refuse these names as clinic
// addresses (tell the Ariloo project when one is added).
export const APP_ROOTS: ReadonlySet<string> = new Set([
  "api",
  "dashboard",
  "login",
  "owner-password",
  "screen",
  "sw.js",
  "offline.html",
  "manifest.webmanifest",
  "icon",
  "apple-icon",
]);
