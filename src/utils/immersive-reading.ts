import { matchDomainPattern } from "./url"

export function getImmersiveReadingPatternForLocation(location: Pick<Location, "hostname" | "href"> = window.location): string {
  return location.hostname || location.href
}

export function isImmersiveReadingEnabledForUrl(enabledPatterns: string[] | undefined, url: string = window.location.href): boolean {
  return enabledPatterns?.some(pattern => pattern === url || matchDomainPattern(url, pattern)) ?? false
}
