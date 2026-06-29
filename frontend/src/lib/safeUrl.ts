/**
 * Returns true only for http:// or https:// URLs.
 * Rejects null/undefined, javascript:, data:, and other schemes.
 */
export function isSafeHttpUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}
