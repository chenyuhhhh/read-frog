import { detectPlatform, formatForDisplay, hasNonModifierKey, parseHotkey, validateHotkey } from "@tanstack/hotkeys"
import { resolveKeyboardEventKey } from "./keyboard-event-key"

export type HotkeyPlatform = ReturnType<typeof detectPlatform>

export function isPageTranslationShortcutEmpty(hotkey: string | null | undefined): boolean {
  return !hotkey?.trim()
}

export function formatPageTranslationShortcut(hotkey: string | null | undefined, platform?: HotkeyPlatform): string {
  if (isPageTranslationShortcutEmpty(hotkey)) {
    return ""
  }

  const configuredHotkey = hotkey?.trim() ?? ""
  return formatForDisplay(configuredHotkey, platform ? { platform } : undefined)
}

export function isValidConfiguredPageTranslationShortcut(hotkey: string, platform: HotkeyPlatform = detectPlatform()): boolean {
  const normalizedHotkey = normalizePageTranslationShortcut(hotkey, platform)
  if (!normalizedHotkey) {
    return false
  }

  const parsedHotkey = parseHotkey(normalizedHotkey, platform)
  return parsedHotkey.modifiers.length > 0 && hasNonModifierKey(parsedHotkey, platform)
}

export function normalizePageTranslationShortcut(hotkey: string, platform: HotkeyPlatform = detectPlatform()): string | null {
  if (isPageTranslationShortcutEmpty(hotkey)) {
    return ""
  }

  const validation = validateHotkey(hotkey)
  if (!validation.valid) {
    return null
  }

  const parsedHotkey = parseHotkey(hotkey, platform)
  if (!parsedHotkey.key) {
    return null
  }

  const modifiers: string[] = []
  const shouldUseMod = platform === "mac"
    ? parsedHotkey.meta && !parsedHotkey.ctrl
    : parsedHotkey.ctrl && !parsedHotkey.meta

  if (shouldUseMod) {
    modifiers.push("Mod")
  }

  if (parsedHotkey.ctrl && !shouldUseMod) {
    modifiers.push("Control")
  }

  if (parsedHotkey.alt) {
    modifiers.push("Alt")
  }

  if (parsedHotkey.shift) {
    modifiers.push("Shift")
  }

  if (parsedHotkey.meta && !shouldUseMod) {
    modifiers.push("Meta")
  }

  modifiers.push(parsedHotkey.key)
  return modifiers.join("+")
}

export function keyboardEventToPageTranslationShortcut(
  event: KeyboardEvent,
  platform: HotkeyPlatform = detectPlatform(),
): string | null {
  const parts: string[] = []

  if (event.ctrlKey) {
    parts.push("Control")
  }

  if (event.altKey) {
    parts.push("Alt")
  }

  if (event.shiftKey) {
    parts.push("Shift")
  }

  if (event.metaKey) {
    parts.push("Meta")
  }

  parts.push(resolveKeyboardEventKey(event))
  return normalizePageTranslationShortcut(parts.join("+"), platform)
}
