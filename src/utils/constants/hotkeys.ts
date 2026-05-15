export const HOTKEYS = ["control", "alt", "shift", "backtick", "clickAndHold", "mouseButton4", "mouseButton5"] as const

export const HOTKEY_ICONS: Record<typeof HOTKEYS[number], string> = {
  control: "⌃",
  alt: "⌥",
  shift: "⇧",
  backtick: "`",
  clickAndHold: "⏱",
  mouseButton4: "M4",
  mouseButton5: "M5",
}

// Maps to actual keyboard event key (for keydown/keyup detection)
export const HOTKEY_EVENT_KEYS: Record<typeof HOTKEYS[number], string> = {
  control: "Control",
  alt: "Alt",
  shift: "Shift",
  backtick: "`",
  clickAndHold: "ClickAndHold", // Special handling, not a keyboard event
  mouseButton4: "MouseButton4", // Special handling, not a keyboard event
  mouseButton5: "MouseButton5", // Special handling, not a keyboard event
}
