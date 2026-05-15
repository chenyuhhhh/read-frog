import { isModifierKey } from "@tanstack/hotkeys"
import { HOTKEY_ICONS, HOTKEYS } from "@/utils/constants/hotkeys"
import { resolveKeyboardEventKey } from "./keyboard-event-key"

export const NODE_TRANSLATION_MOUSE_BUTTONS = {
  3: "mouseButton4",
  4: "mouseButton5",
} as const

export const NODE_TRANSLATION_MOUSE_BUTTON_BITS = {
  mouseButton4: 8,
  mouseButton5: 16,
} as const

const BUILT_IN_NODE_TRANSLATION_HOTKEYS = new Set<string>(HOTKEYS)
const MOUSE_NODE_TRANSLATION_HOTKEYS = new Set<string>(Object.values(NODE_TRANSLATION_MOUSE_BUTTONS))
const INVALID_KEYBOARD_HOTKEYS = new Set([
  "",
  "Escape",
  "Backspace",
  "Delete",
  "Tab",
  "Enter",
  "Dead",
  "Unidentified",
])

const MODIFIER_HOTKEYS: Record<string, string> = {
  Control: "control",
  Alt: "alt",
  Shift: "shift",
}

const BUILT_IN_EVENT_KEYS: Record<string, string> = {
  control: "Control",
  alt: "Alt",
  shift: "Shift",
  backtick: "`",
}

export function isClickAndHoldNodeTranslationHotkey(hotkey: string | null | undefined): boolean {
  return hotkey === "clickAndHold"
}

export function isMouseNodeTranslationHotkey(hotkey: string | null | undefined): boolean {
  return !!hotkey && MOUSE_NODE_TRANSLATION_HOTKEYS.has(hotkey)
}

export function keyboardEventToNodeTranslationHotkey(event: KeyboardEvent): string | null {
  if (event.key in MODIFIER_HOTKEYS) {
    return MODIFIER_HOTKEYS[event.key]
  }

  if (event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) {
    return null
  }

  const key = resolveKeyboardEventKey(event)
  if (key === "`") {
    return "backtick"
  }

  if (!isValidCustomKeyboardHotkey(key)) {
    return null
  }

  return key
}

export function mouseEventToNodeTranslationHotkey(event: Pick<MouseEvent, "button"> & Partial<Pick<MouseEvent, "buttons">>): string | null {
  const buttonHotkey = NODE_TRANSLATION_MOUSE_BUTTONS[event.button as keyof typeof NODE_TRANSLATION_MOUSE_BUTTONS]
  if (buttonHotkey)
    return buttonHotkey

  if (event.buttons === undefined)
    return null

  if ((event.buttons & NODE_TRANSLATION_MOUSE_BUTTON_BITS.mouseButton4) !== 0)
    return "mouseButton4"
  if ((event.buttons & NODE_TRANSLATION_MOUSE_BUTTON_BITS.mouseButton5) !== 0)
    return "mouseButton5"

  return null
}

export function isValidConfiguredNodeTranslationHotkey(hotkey: string): boolean {
  if (BUILT_IN_NODE_TRANSLATION_HOTKEYS.has(hotkey)) {
    return true
  }

  return isValidCustomKeyboardHotkey(hotkey)
}

export function formatNodeTranslationHotkey(hotkey: string | null | undefined): string {
  if (!hotkey) {
    return ""
  }

  if (hotkey in HOTKEY_ICONS) {
    return HOTKEY_ICONS[hotkey as keyof typeof HOTKEY_ICONS]
  }

  if (hotkey === "Space") {
    return "Space"
  }

  return hotkey
}

export function nodeTranslationHotkeyMatchesKeyboardEvent(hotkey: string, event: KeyboardEvent): boolean {
  if (isClickAndHoldNodeTranslationHotkey(hotkey) || isMouseNodeTranslationHotkey(hotkey)) {
    return false
  }

  const builtInEventKey = BUILT_IN_EVENT_KEYS[hotkey]
  if (builtInEventKey) {
    return event.key === builtInEventKey
  }

  if (event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) {
    return false
  }

  return keyboardEventToNodeTranslationHotkey(event) === hotkey
}

export function nodeTranslationHotkeyMatchesMouseEvent(hotkey: string, event: Pick<MouseEvent, "button"> & Partial<Pick<MouseEvent, "buttons">>): boolean {
  return mouseEventToNodeTranslationHotkey(event) === hotkey
}

function isValidCustomKeyboardHotkey(hotkey: string): boolean {
  if (!hotkey || INVALID_KEYBOARD_HOTKEYS.has(hotkey)) {
    return false
  }

  if (hotkey.includes("+")) {
    return false
  }

  if (/^mouseButton\d+$/i.test(hotkey)) {
    return false
  }

  if (isModifierKey(hotkey)) {
    return false
  }

  if (BUILT_IN_NODE_TRANSLATION_HOTKEYS.has(hotkey)) {
    return false
  }

  return true
}
