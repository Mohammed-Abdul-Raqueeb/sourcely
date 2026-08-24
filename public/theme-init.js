/**
 * Applies the stored theme before first paint.
 *
 * External rather than inline so that no inline script of ours exists at all:
 * an inline script needs either a CSP nonce — which would force the root
 * layout to read headers() and opt all 84 prerendered pages out of static
 * generation — or 'unsafe-inline', which is the thing being removed. As an
 * ordinary same-origin script it is covered by script-src 'self' under both
 * policies.
 *
 * Loaded synchronously in <head>, so it runs before the body is painted and
 * a light-theme user never sees a dark flash. Wrapped in try/catch because
 * localStorage throws outright in some privacy modes.
 */
(function () {
  try {
    var stored = localStorage.getItem('sourcely-theme')
    document.documentElement.setAttribute('data-theme', stored === 'light' ? 'light' : 'dark')
  } catch {
    document.documentElement.setAttribute('data-theme', 'dark')
  }
})()
